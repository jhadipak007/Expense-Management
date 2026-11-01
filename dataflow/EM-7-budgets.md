# EM-7 Data Flow: Budgets and the Month Start Day

This document explains what EM-7 added and how data moves when a user sets a budget, adds an expense and sees their spending against it. It builds on the expense tables from [EM-5-add-expense.md](EM-5-add-expense.md) and the dashboard from [EM-6-dashboard-summary.md](EM-6-dashboard-summary.md).

Design references: [data_model.md](../planning/references/data_model.md) (Budgets), [api_design.md](../planning/references/api_design.md) (Budgets, Users), [frontend.md](../planning/references/frontend.md) (Dashboard budgets), [testing.md](../planning/references/testing.md).

## 1. Overview

```
 Browser (local date "today")                          FastAPI
┌──────────────── Dashboard ────────────────┐
│ Summary cards (EM-6)                      │
│ Budgets  [Create budget]                  │   GET /api/budgets?today=2026-11-01
│ ┌─ Personal ─────────┐ ┌─ Asha Home ────┐ │ ─────────────────────────────────► budget_service.list_budgets
│ │ Period▾ Category▾  │ │ (filters)      │ │                                    ├ _load_viewer: roles + start days (2 queries)
│ │ Grocery · Weekly   │ │ Trips · Yearly │ │ ◄───────────────────────────────── ├ per budget: current_period() + one SUM
│ │ ███████░░ Close…   │ │ ██░░ On track  │ │   [BudgetOut, ...]                 └ status, remaining, over_by, can_manage
│ │ [Edit] [Delete]    │ │                │ │
│ └────────────────────┘ └────────────────┘ │
└───────────────────────────────────────────┘
 /budgets/new, /budgets/:id/edit ─► POST / PATCH /api/budgets?today=…  ─► back to "/" (remount, refetch)
 /settings                       ─► PATCH /api/users/me {month_start_day}
```

| Part | Code | Role |
|---|---|---|
| Model | `backend/app/models/budget.py` | `Budget`, `BudgetPeriod` |
| User setting | `backend/app/models/user.py` | `month_start_day` (default 1) |
| Migration | `backend/alembic/versions/0006_create_budgets.py` | `budgets` table, `users.month_start_day` |
| Period maths | `backend/app/services/budget_period.py` | `current_period()`, `budget_status()`; pure functions |
| Service | `backend/app/services/budget_service.py` | Visibility, owner checks, uniqueness, spent per budget |
| Shared scope | `backend/app/services/report_service.py` | `scope_condition()`, used by reports and budgets |
| Settings service | `backend/app/services/user_service.py` | `update_settings()` |
| Routes | `backend/app/routers/budgets.py`, `routers/users.py` | `/api/budgets`, `PATCH /api/users/me` |
| Error mapping | `backend/app/routers/errors.py` | `lookup_errors()`: unknown category/currency (422), hidden family (404); shared with expenses |
| Schemas | `backend/app/schemas/budget.py`, `schemas/user.py` | `BudgetIn`, `BudgetUpdateIn`, `BudgetOut`, `TodayQuery`, `UserSettingsIn` |
| API functions | `frontend/src/api/budgets.js`, `api/users.js` | Every budget call adds `?today=` (local date) |
| Dashboard | `frontend/src/pages/Dashboard/BudgetsSection.jsx`, `BudgetGroup.jsx`, `BudgetItem.jsx` | Load, group, filter, show, delete |
| Form pages | `frontend/src/pages/Budgets/BudgetPage.jsx`, `BudgetForm.jsx`, `budgetLabels.js` | Create and edit; periods and status labels |
| Settings | `frontend/src/pages/Settings/Settings.jsx` | Month start day 1st to 28th |
| Shared form code | `frontend/src/components/FormSection.jsx`, `FormSkeleton.jsx`, `utils/formErrors.js` | Used by the expense and budget forms |

## 2. Storing a budget

`POST /api/budgets?today=2026-11-01` with `{family_id, category_id, period, amount, currency}`.

1. `TodayQuery` rejects a `today` more than one day from the UTC date (422 on `today`). Every time zone's date is within a day of UTC, so any real local date passes.
2. `BudgetIn` validates the body (`extra="forbid"`, amount > 0 with 2 decimals, `period` from `BudgetPeriod`, currency `^[A-Z]{3}$`). `family_id` null means personal; `category_id` null means all categories.
3. The service checks the category and currency exist (422 on the field, like expenses), and for a family budget calls `require_owner` (non-member 404, member 403).
4. It saves `anchor_date = today` (the first fortnight starts on the creation day) and `scope_key`:

   | Budget | scope_key |
   |---|---|
   | Personal, all categories (user 5) | `u5:all` |
   | Personal, Grocery (category 1) | `u5:1` |
   | Family 3, Trips (category 3) | `f3:3` |

   The table has `UNIQUE (scope_key, period, currency)`. Unique constraints ignore rows with NULLs, so a constraint on `(user_id, family_id, category_id, ...)` would let two personal "all categories" budgets through on both SQLite and PostgreSQL. The key column has no nulls, so the database itself rejects the duplicate. The commit's `IntegrityError` becomes `DuplicateBudget` and 409; no pre-check query means no race between two saves.
5. `db.refresh()` reloads the stored values, so `"50"` comes back as `"50.00"`.

Editing (`PATCH`) changes only `amount` and `period`. Switching to fortnightly sets `anchor_date` to the edit day. An edit into an existing combination (for example yearly to weekly when a weekly budget exists) fails at the same constraint with 409, and nothing changes.

## 3. Computing the current period and spending

Nothing about periods is stored; each read computes them from `today`:

| Period | Current period |
|---|---|
| Weekly | Monday to Sunday containing `today` |
| Fortnightly | `anchor + 14·n` days, with `n = (today - anchor) // 14` (floor division also works for dates before the anchor) |
| Monthly | From the start day to the day before it next month: start day 15 on 1 Nov gives 15 Oct to 14 Nov |
| Yearly | 1 January to 31 December |

The start day is the creator's for a personal budget and the family owner's for a family budget, so every member sees the same dates. Days are 1 to 28, so the date always exists and there is no clamping. Changing the start day in Settings moves monthly budgets on the next read; nothing stored changes.

`_load_viewer` runs two queries per request: the user's role in each family, and the start days of the user and of each family's owner. Each budget then needs only its spending query:

```sql
SELECT SUM(amount) FROM expenses
WHERE <scope> AND currency = :currency AND spent_on BETWEEN :start AND :end
  [AND category_id = :category_id]          -- omitted for "all categories"
```

`<scope>` is `scope_condition()` from `report_service`, the same rule as the dashboard summaries: personal means the creator's own expenses with no family; family means every expense shared with that family, whoever recorded it. Because each budget is summed on its own, one expense counts towards every budget it matches (a weekly Grocery budget and a monthly all-categories budget).

`budget_status()` compares decimals without rounding: `over` when spent > amount, `close` when spent·5 >= amount·4 (80% or more, including exactly 100%), else `on_track`. `remaining` and `over_by` are floored at `0.00`.

## 4. The dashboard

- `BudgetsSection` loads `GET /api/budgets?today=` once on mount. Saving an expense, budget or deletion navigates back to `/` (or reloads after delete), so progress is fresh without a page reload.
- It is keyed on the family ids. Accepting an invitation reloads the family list, the key changes, and the section remounts and loads the new family's budgets.
- Budgets are grouped: Personal first, then each family in the order of `GET /api/families`; scopes with no budgets are left out. With no budgets at all, an empty state offers Create budget.
- Each `BudgetGroup` keeps its own Period and Category filter state (not in the URL). "Any category" shows everything; "All categories" shows only budgets that cover every category.
- `BudgetItem` shows the dates (`formatPeriod`: "15 Oct – 14 Nov 2026", both years when they differ), the bar, "X spent of Y", "Z left" or "Over by Z", and a status badge with a text label. Edit and Delete appear only when `can_manage`; Delete confirms in an `AlertDialog`.
- The bar's width is set with React's `style` prop. React writes `element.style.width`, which `default-src 'self'` allows; only style attributes in HTML and `<style>` elements are blocked. The e2e test fails if a CSP error appears while bars render.

## 5. Settings

`/settings` loads `GET /api/users/me` itself (the user held by the auth provider is not refreshed after a save), shows a select of 1st to 28th, and saves with `PATCH /api/users/me {"month_start_day": 15}`. `UserSettingsIn` allows only that field and only 1 to 28; the service logs `user settings updated` with the user id.

## 6. Migration 0006

- Creates `budgets` with its foreign keys (`RESTRICT`), the `period` CHECK, the unique constraint and indexes on `user_id` and `family_id`.
- Adds `users.month_start_day INTEGER NOT NULL DEFAULT 1` with a plain `ALTER TABLE`. Batch mode would rebuild `users` (copy, drop, rename), and on SQLite the drop fails with `FOREIGN KEY constraint failed` once any expense references a user. This was reproduced on a scratch database before choosing the plain ALTER; downgrade uses `DROP COLUMN` the same way.

## 7. Tests

- Backend unit: period boundaries and status thresholds (`tests/unit/test_budget_period.py`).
- Backend integration: `tests/integration/test_budgets.py` (scope, currency, category, period, access, 409s, edits, start day, validation, injection), `test_users.py` (settings), `test_domain_logs.py` (budget and settings events).
- Frontend: `BudgetPage.test.jsx`, `BudgetsSection.test.jsx`, `Settings.test.jsx`, `utils/format.test.js`.
- E2E: `e2e/budgets.spec.js`, against the running app.
