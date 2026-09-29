# EM-5 Data Flow: Adding an Expense Manually

This document explains what EM-5 added and how data moves between the React frontend, the FastAPI backend and the database when a logged-in user records an expense. Token handling (bearer header, 401 refresh and retry) is unchanged and described in [EM-2-login-dashboard-logout.md](EM-2-login-dashboard-logout.md). Family membership comes from EM-1.

Design references: [data_model.md](../planning/references/data_model.md), [api_design.md](../planning/references/api_design.md), [database.md](../planning/references/database.md), [frontend.md](../planning/references/frontend.md).

## 1. Overview

```
 Dashboard            Add expense page                        Dashboard
┌────────────┐ link  ┌──────────────────────────┐  201       ┌──────────────────────────┐
│ Welcome    │ ────► │ GET categories, families │ ────────►  │ "Expense saved: 42.50    │
│ Add expense│       │ fill form, Save          │  navigate  │  AUD for Grocery."       │
└────────────┘       └──────────────────────────┘  with state└──────────────────────────┘
                          │ POST /api/expenses
                          ▼
                     422 field errors / 404 family: shown on the form, input kept
```

| Part | Code | Role |
|---|---|---|
| Dashboard | `frontend/src/pages/Dashboard/Dashboard.jsx` | "Add expense" link; shows the confirmation from router state |
| Page | `frontend/src/pages/Expenses/NewExpense.jsx` | Loads categories and families; saves, then navigates to `/` |
| Form | `frontend/src/pages/Expenses/ExpenseForm.jsx` | Fields, browser validation, server error mapping, spinner |
| API functions | `frontend/src/api/expenses.js` | `listCategories()`, `createExpense()` |
| Routes | `backend/app/routers/categories.py`, `backend/app/routers/expenses.py` | `GET /api/categories`, `POST /api/expenses`, `GET /api/expenses/{id}` |
| Schemas | `backend/app/schemas/expense.py` | `CategoryOut`, `ExpenseIn`, `ExpenseOut` |
| Service | `backend/app/services/expense_service.py` | Category check, membership check, insert, visibility filter |
| Models | `backend/app/models/category.py`, `backend/app/models/expense.py` | `categories` and `expenses` tables |
| Migration | `backend/alembic/versions/0004_create_categories_and_expenses.py` | Creates both tables and seeds the three categories |

## 2. Database changes

Migration `0004` creates:

**categories**: `id`, `name` (unique), `color`. Seeded with Grocery `#8aa84a`, Eating Out `#e08e5a` and Trips `#3a9e84`, the same colors as the CSS tokens.

**expenses**: `id`, `user_id` (recorder), `family_id` (null = personal), `category_id`, `amount` `Numeric(12, 2)`, `currency` `String(3)`, `spent_on` `Date`, `description` (nullable, 500), `created_at`, `updated_at`.
- All three foreign keys are `RESTRICT`, so a user, family or category with expenses cannot be deleted by accident.
- Indexes `(user_id, spent_on)` and `(family_id, spent_on)` serve the upcoming list and report queries.
- `Expense.is_personal` is a hybrid property (`family_id IS NULL`) used in Python and in SQL; `Expense.category_name` is an association proxy.

`downgrade()` drops both tables; upgrade, downgrade and upgrade again were run cleanly.

## 3. Flow A: opening the form

1. The dashboard's **Add expense** link goes to `/expenses/new`. The route sits under `RequireAuth`, so a logged-out visitor is sent to `/login`.
2. `NewExpense` calls `useAsyncList(loadOptions)`, which runs `GET /api/categories` and `GET /api/families` in parallel through `request()`.
3. The form starts with currency `AUD`, date = local today (also the date input's `max`), and **Share with** = Personal. The category starts empty, so the user must choose one.
4. The **Share with** dropdown lists Personal and only the families returned by `GET /api/families` (the user's memberships). A user with no families sees only Personal.

## 4. Flow B: saving

```mermaid
sequenceDiagram
    participant F as ExpenseForm
    participant P as NewExpense
    participant C as client.js request()
    participant R as routers/expenses.py
    participant S as expense_service
    participant DB as Database

    F->>F: validate() amount, currency, date (stop on any error)
    F->>P: onSubmit(payload)
    P->>C: createExpense(payload)
    C->>R: POST /api/expenses (Bearer token)
    R->>R: get_current_user; ExpenseIn validation (422 on failure)
    R->>S: create_expense(db, user.id, body)
    S->>DB: SELECT category by id (UnknownCategory -> 422)
    S->>DB: SELECT family_members (family_id, user_id) (FamilyNotFound -> 404)
    S->>DB: INSERT expense; COMMIT; refresh
    R-->>C: 201 ExpenseOut
    P->>P: navigate('/', { state: { savedExpense } })
```

Payload sent by the form:

```json
{ "amount": "42.50", "currency": "AUD", "category_id": 1, "spent_on": "2026-09-29",
  "description": "Weekly shop", "family_id": null }
```

- **Amount** is sent as a string and parsed as `Decimal`, so no floating point value is involved anywhere. `max_digits=12, decimal_places=2` matches the column. After commit the row is refreshed, so the response shows the stored value (`1999.9` is returned as `"1999.90"`, the same as a later GET).
- **Currency** is stored as typed (upper-cased by the form). No conversion happens.
- **Recorder**: `user_id` always comes from the access token. `ExpenseIn` inherits `InputModel` (`extra="forbid"`), so a body containing `user_id` is rejected with 422.
- **Family**: `require_member()` from EM-1 is reused. A family that does not exist and one the user is not in both raise `FamilyNotFound` -> 404, so family ids cannot be probed. The check runs before the insert, so nothing is saved.
- **Unknown category**: returns 422 shaped like FastAPI's own errors (`loc: ["body", "category_id"]`), because categories are public lookup data, not access-controlled.
- **Future dates**: the server rejects `spent_on` later than UTC tomorrow. No time zone is a full day ahead of UTC, so a user in Australia recording "today" is never rejected, while the form's `max` keeps the browser at the user's local today.
- **SQL injection**: every value is a bound parameter through the ORM. Typed fields (`amount`, `category_id`, `family_id`, `currency`, path `expense_id`) reject payloads such as `1 OR 1=1` with 422; free text in `description` is stored literally.

## 5. Browser-side behaviour

| Rule | Where |
|---|---|
| Save disabled until amount, currency, category and date are filled | `complete` in `ExpenseForm`; `SubmitButton` got a `disabled` prop |
| Zero, negative, non-numeric or 3-decimal amount shows a message and sends nothing | `validate()`; the amount is a text input with `inputMode="decimal"` so a non-numeric entry can be explained |
| Currency must be 3 letters | `validate()` |
| Server 422 | `serverFieldErrors()` maps `loc[1]` onto the same field keys (form keys equal API field names); if no field matches, "Please check the form and try again." |
| Server 404 (family) | Form-level alert: "Family not found. Choose Personal or one of your families." |
| Other errors | "Something went wrong. Please try again." |
| Double submit | `SubmitButton` shows a spinner and "Saving..." and is disabled while the request runs |
| Input kept on error | Form state is never reset on failure |

On success the dashboard reads `location.state.savedExpense` and shows a `role="status"` message such as "Expense saved: 42.50 AUD for Grocery."

## 6. Flow C: who can see an expense

`GET /api/expenses/{expense_id}` returns the expense only if `visible_to(user_id)` matches, otherwise 404:

```python
or_(
    and_(Expense.is_personal, Expense.user_id == user_id),
    Expense.family_id.in_(select(FamilyMember.family_id).where(FamilyMember.user_id == user_id)),
)
```

- A personal expense is visible only to its recorder, even to people who share a family with them.
- A family expense is visible to every member of that family, whoever recorded it.

This filter is a SQL condition, so the future expense list and report endpoints can reuse it unchanged.

## 7. Tests

| Suite | File | Covers |
|---|---|---|
| Backend unit | `backend/tests/unit/test_expense_schemas.py` | Amount, currency, description, ids, `user_id` rejected, UTC-tomorrow date boundary, `is_personal` |
| Backend integration | `backend/tests/integration/test_expenses.py` | Seeded categories, personal and family create, non-member and unknown family 404 with nothing saved, unknown category 422, exact amount and currency, injection payloads, 401, visibility rules |
| Backend integration | `backend/tests/integration/test_users.py` | The existing all-routes 401 test now also covers the three new routes |
| Frontend | `frontend/src/pages/Expenses/NewExpense.test.jsx` | Dashboard link, login redirect, defaults, family list, disabled Save, amount and currency messages, payload, confirmation, 422 and 404 handling, spinner and single submit |
| E2E | `frontend/e2e/expenses.spec.js` | Personal expense, family expense (reuses one family), logged-out redirect |
| Responsive | `frontend/e2e/responsive.spec.js` | Form at 360, 768 and 1440 px: no horizontal scroll, 44 px touch targets |

## 8. Known issue found while testing (not part of EM-5)

After logging in from a redirect, the app always lands on the dashboard instead of the page the user asked for (reproduced on `main` with `/families`). It is tracked as EM-8.
