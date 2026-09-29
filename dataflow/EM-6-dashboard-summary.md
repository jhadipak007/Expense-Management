# EM-6 Data Flow: Dashboard Spending Summaries

This document explains what EM-6 added and how data moves when a logged-in user looks at the dashboard summaries. It builds on the expense tables from [EM-5-add-expense.md](EM-5-add-expense.md) and the token handling in [EM-2-login-dashboard-logout.md](EM-2-login-dashboard-logout.md).

Design references: [api_design.md](../planning/references/api_design.md), [data_model.md](../planning/references/data_model.md), [frontend.md](../planning/references/frontend.md), [testing.md](../planning/references/testing.md).

## 1. Overview

```
 URL: /?from=2026-09-01&to=2026-09-30&category=1&category=3
                 │ parseFilters()
                 ▼
┌────────────────────────── Dashboard ──────────────────────────┐
│ Welcome, Add expense (link keeps ?search)                      │
│ DashboardFilters: Period (presets / Custom) · Categories · Reset│──► setSearchParams (replace)
│ ┌─ SummaryCard "Personal" ─┐ ┌─ SummaryCard "Jha Household" ─┐│
│ │ GET /api/reports/summary │ │ GET /api/reports/summary       ││
│ │   (no family_id)         │ │   ?family_id=3                 ││
│ └──────────────────────────┘ └────────────────────────────────┘│
│ Pending invitations                                              │
└──────────────────────────────────────────────────────────────────┘
```

| Part | Code | Role |
|---|---|---|
| Dashboard | `frontend/src/pages/Dashboard/Dashboard.jsx` | Reads filters from the URL, loads categories and families, renders filters and one card per scope |
| Filter rules | `frontend/src/pages/Dashboard/dashboardFilters.js` | Presets, URL parse/serialize, "custom" detection, summary text |
| Filter controls | `frontend/src/pages/Dashboard/DashboardFilters.jsx` | Period radios, custom From/To, category checkboxes, Reset |
| Card | `frontend/src/pages/Dashboard/SummaryCard.jsx` | Loads one summary; loading, empty, error + Retry; totals and bars |
| API function | `frontend/src/api/reports.js` | `getSummary(filters, signal)` |
| Loading hook | `frontend/src/hooks/useAsyncList.js` | Keeps only the newest result, shows loading on reload, aborts stale loads |
| Formatting | `frontend/src/utils/format.js` | `formatIsoDate` ("1 Sep 2026"), `formatMoney` ("INR 12,450.00") |
| Route | `backend/app/routers/reports.py` | `GET /api/reports/summary` |
| Schemas | `backend/app/schemas/report.py` | `ReportFilter`, `ReportSummaryOut`, `CurrencyTotalOut`, `CategoryTotalOut` |
| Service | `backend/app/services/report_service.py` | Scope check and the grouped query |

No tables or migrations were added.

## 2. The summary endpoint

`GET /api/reports/summary?date_from=2026-09-01&date_to=2026-09-30[&family_id=3][&category_id=1&category_id=3]`

- `ReportFilter` is a Pydantic query model (`InputModel`, so unknown parameters are rejected). `date_from` and `date_to` are required and inclusive; `date_from > date_to` returns 422. Ids must be positive integers, so payloads like `1 OR 1=1` return 422 before any query runs.
- **Scope**, never both at once:
  - no `family_id`: `Expense.is_personal AND Expense.user_id = me`
  - `family_id`: `require_member()` first (404 "Family not found" for a family that does not exist or that the user is not in), then `Expense.family_id = :id`, which includes every member's shared expenses.
- **Query**: one `SELECT currency, category id/name/color, SUM(amount)` joined to `categories`, filtered by scope, `spent_on BETWEEN`, and `category_id IN (...)` when categories are given, grouped by currency and category and ordered by currency then category id. Values are bound parameters.
- **Response**: rows are folded per currency with `itertools.groupby` (valid because the SQL orders by currency). Each currency's `total` is the sum of its category totals, so amounts in different currencies are never added together and there is no field that could hold a mixed total. Categories with no spending simply have no row, so they never appear.

```json
{ "currencies": [
  { "currency": "INR", "total": "12450.00", "categories": [
      { "category_id": 1, "name": "Grocery", "color": "#8aa84a", "total": "8000.00" },
      { "category_id": 3, "name": "Trips", "color": "#3a9e84", "total": "4450.00" } ] },
  { "currency": "USD", "total": "85.00", "categories": [ ... ] } ] }
```

**Exact totals on SQLite**: SQLite computes `SUM` in floating point (`0.1 + 0.2` comes back from the driver as `0.30000000000000004`). SQLAlchemy's `Numeric(12, 2)` result processor turns it back into `Decimal('0.30')`, which was verified by running it, and `test_totals_are_exact` guards it. PostgreSQL sums `NUMERIC` exactly.

## 3. Filters in the URL

| Parameter | Meaning |
|---|---|
| `from`, `to` | Applied range, `YYYY-MM-DD`, inclusive. Missing or invalid (bad format, or from after to) means This month |
| `category` | Repeated category id; none means All categories |

- Presets (`presetRange`) use the browser's local calendar: This month, Last month (January goes back to December of the previous year), This year. The highlighted period is derived: `matchingPreset()` compares the applied range with each preset, and anything else is Custom.
- Changing a filter calls `setSearchParams(..., { replace: true })`. Reset clears the search string.
- A custom range is kept as a local draft until both dates are set and in order. A From date after the To date shows "The From date must be on or before the To date." next to From, does not change the URL, and the cards keep their results.
- When the applied range changes outside the controls (Reset, the Dashboard nav link), the controls drop any open draft and show what is applied.
- `Dashboard` memoizes `parseFilters(searchParams)`, so the filters object, and the card's `load` callback built from it, only change when the URL does.

**Add expense round trip**: the dashboard's Add expense link carries the current search string. `NewExpense` returns to `/` with the same search (and `state.savedExpense` for the confirmation), so the filters are kept and the remounted cards load fresh totals that include the new expense.

## 4. One request per card

Each card calls the endpoint on its own, which is what gives it its own loading line, empty message and error with Retry, and a failing card does not affect the others.

`useAsyncList` was changed for this:

1. **Stale responses**: before, when `load` changed quickly (for example two filter clicks), a slower earlier response could finish last and overwrite the newer one. A test reproduced it (`Received: "old"`) before the fix.
2. **Loading on reload**: before, `loading` was only true on the first load, so a card showed no indicator when filters changed or on Retry.
3. **Abort**: every load gets an `AbortController` signal (passed to `fetch` through `request(path, { signal })`). A new load aborts the previous one, and unmounting aborts the one in flight. Leaving the dashboard therefore frees the browser's connection queue for the next page, which matters when there are many cards.

## 5. Display

- Amounts: `formatMoney(amount, currency)` gives the code and `en-US` grouping with 2 decimals ("INR 12,450.00"). The API returns amounts as strings, which `Intl.NumberFormat` formats without losing precision.
- Dates: `formatIsoDate` builds "1 Sep 2026" from the parts of `YYYY-MM-DD`, avoiding both the UTC day shift of `new Date("2026-09-01")` and `en-GB`'s newer "Sept".
- Category bars: width is the category's share of that currency's total, filled with the category's colour from the API. The category name and amount are always shown next to the bar, so colour is never the only signal.
- Layout: filters above the cards; the cards grid is one column on phones and `auto-fill, minmax(18rem, 1fr)` from 768px.

## 6. Tests

| Suite | File | Covers |
|---|---|---|
| Backend unit | `backend/tests/unit/test_report_schemas.py` | Defaults, one-day range, from after to, invalid ids, unknown fields |
| Backend integration | `backend/tests/integration/test_reports.py` | Personal only, family includes all members, 404 for non-members, currencies never combined, exact totals, inclusive range, category filter, no matches, 422s, injection payloads, 401 |
| Frontend | `frontend/src/hooks/useAsyncList.test.js` | Newest result wins, loading on reload and retry, abort on change and unmount |
| Frontend | `frontend/src/pages/Dashboard/dashboardFilters.test.js` | Presets incl. year and leap-year edges, URL parsing and round trip, summary text |
| Frontend | `frontend/src/pages/Dashboard/Dashboard.test.jsx` | Card order, requests per scope, defaults, totals and formatting, empty, loading, per-card retry, presets, categories, custom range and its error, URL filters and Reset, Add expense round trip, controls follow URL changes |
| E2E | `frontend/e2e/dashboard.spec.js` | Real totals per card, category and preset filters, Reset, filters survive Add expense and reload |
| Responsive | `frontend/e2e/responsive.spec.js` | Cards stack at 360px and sit side by side from 768px, touch targets, no horizontal scroll |

## 7. E2E suite changes found while building this

- The shared test user had about 150 leftover families, because each `families.spec` and `responsive.spec` run created new ones. Its dashboard then fired about 150 summary requests. Combined with 4 parallel workers against one SQLite database, where every transaction takes the write lock, other tests' logins waited up to the 5 second busy timeout.
- Fixes: `workers: 1` in `playwright.config.js`; tests reuse named families through `ensureFamily`; dashboard checks sign up a fresh user; the leftover families were deleted from the local database.
