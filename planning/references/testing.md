# Expense Sarathi - Testing

Every feature PR adds or updates tests for the behavior it changes and runs the relevant suites (see `AGENTS.md`).

## Backend (pytest)

### Tools
- `pytest`, `pytest-cov`, and FastAPI's `TestClient` (httpx-based). Added with `uv add --dev`.
- Run: `uv run pytest` from `backend/`. Coverage: `uv run pytest --cov=app --cov-report=term-missing`.

### Layout
```
backend/tests/
├── conftest.py          # shared fixtures
├── unit/                # no database, no HTTP: services, schemas, security helpers
└── integration/         # real database + TestClient: routers end to end
```
- File names `test_<module>.py`; test names say the behavior: `test_member_cannot_edit_other_members_expense`.
- One behavior per test. Arrange, act, assert.

### Fixtures (`conftest.py`)
| Fixture | Scope | Provides |
|---|---|---|
| `settings` | session | `Settings` with `ENVIRONMENT=test`, fixed `JWT_SECRET`, temp SQLite path |
| `engine` | session | Engine after `alembic upgrade head` (migrations are tested too) |
| `db` | function | Session inside a transaction that is rolled back after each test |
| `client` | function | `TestClient` with `get_db` overridden to use `db` |
| `make_user`, `make_family`, `make_expense` | function | Factory functions that create rows with sensible defaults |
| `auth_headers(user)` | function | `Authorization` header with a valid access token for that user |

Tests never depend on each other or on execution order.

### Markers
- `@pytest.mark.postgres`: runs only when `USE_POSTGRESQL_DB=true` (release check against a local PostgreSQL container). Everything else runs on SQLite.
- Markers are registered in `pyproject.toml` under `[tool.pytest.ini_options]` with `--strict-markers`.

### What to test

**Unit**
- Password hashing: hash then verify succeeds; wrong password fails; password over 72 bytes is rejected.
- JWT: token encodes `sub`, `type`, `exp`; expired, tampered and wrong-type tokens are rejected.
- Schemas: each field rule in [api_design.md](api_design.md) (amount > 0 with 2 decimals, currency `^[A-Z]{3}$`, `date_from <= date_to`, unknown fields rejected, `password_hash` never in output models).
- Derived fields: `is_personal`, `is_open`, `is_active`, computed `month`.
- Budget periods (`test_budget_period.py`): weekly Monday to Sunday; fortnights from the anchor, including dates before it and across a new year; monthly with start days 1, 15 and 28, before and after the start day, across December and February; yearly in a leap year; status at 79.99%, 80%, 100% and 100.01%.

**Integration**
- Auth: register with OTP (correct code creates and logs in the user; wrong code; 5th wrong code ends the registration; expiry; abandoned sign-up does not block the email), duplicate email (409), login success and failure (401, same message for unknown email and wrong password), only one request using a refresh token succeeds and a duplicate/replayed use revokes all refresh tokens, logout works with a refresh cookie and no access token (including missing/expired/revoked cookie, always 204 and clears cookie), access token expiry.
- Every protected endpoint returns 401 without a token (one parametrized test over all routes).
- Expenses: create personal and family expenses; list returns only visible expenses; non-member gets 404 for a family expense; only the recorder can edit or delete; filters, sorting and pagination.
- Families: create (creator is owner), list with role, member sees members, non-member gets 404, owner-only actions return 403 for members.
- User search: exact email only, name needs 3+ characters, masked emails, at most 10 with `has_more`, owner and inactive users excluded, LIKE wildcards match literally.
- Invitations: 7-day expiry, duplicate member or open invitation returns 409, re-invite after decline/cancel/expiry, cancel removes it for both sides, accepted invitations cannot be cancelled, accept joins the family, decline does not, cancelled or expired invitations return 409, someone else's invitation returns 404.
- Reports: totals grouped by currency with no conversion; omitting `family_id` returns only the user's personal expenses, supplying a member family ID returns only that family's expenses, and no report combines personal and family expenses.
- Budgets (`test_budgets.py`): spent counts only the same scope, category (or all), currency and period, and a family budget counts every member's family expenses; one expense counts towards several budgets; status, remaining and over-by; members see family budgets, only the owner manages them (403), hidden budgets and families are 404; duplicates are 409, including an edit into an existing combination; edits apply at once, switching to fortnightly restarts on the edit day; a family's monthly budgets follow the owner's start day, and changing the start day moves them; delete keeps expenses; field and `today` validation.
- Settings (`test_users.py`): `PATCH /api/users/me` saves a month start day of 1 to 28 and rejects others.
- SQL injection: payloads such as `1 OR 1=1` and `'; DROP TABLE expenses;--` in path and query parameters return 422 and change nothing.
- Security headers present on `/api` responses; `/docs` disabled when `ENABLE_API_DOCS=false`.
- Logging ([logging.md](logging.md)): `X-Request-ID` is reused when safe and generated otherwise; one access line per request with `user_id`; unhandled errors return a generic 500 and log the traceback; each domain event is logged with ids; `/api/client-logs` rejects oversized or unknown input; the auth flow at DEBUG logs no password, OTP, email or token (`test_log_safety.py`). Tests read records with `caplog`; the JSON and text formatters have unit tests.
- Migrations: `upgrade head` then `downgrade base` runs cleanly.

## Frontend (Vitest + React Testing Library + Playwright)

### Tools
- Unit and component tests: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.
- API mocking in component tests: `msw` (Mock Service Worker) with handlers per endpoint.
- End-to-end and responsive checks: `@playwright/test` against the app served by FastAPI.
- Run: `npm test` (Vitest), `npx playwright test` (e2e).

### Layout
- Component tests next to the component: `ExpenseForm.jsx` and `ExpenseForm.test.jsx`.
- MSW handlers in `src/test/handlers.js`; setup in `src/test/setup.js`.
- End-to-end tests in `frontend/e2e/`.
- Query by role and label (`getByRole`, `getByLabelText`), not by CSS class or test id, so tests also check accessibility.
- jsdom lacks two browser APIs the app uses; `src/test/setup.js` stubs them: `ResizeObserver` (Radix radios and checkboxes inside a `<form>`) and `window.matchMedia` (the layout's 1024px listener). No other Radix polyfills were needed. Add a stub only when a test proves it is missing.
- Currency, Category and Share with are native `<select>`s (shadcn `NativeSelect`), so `user.selectOptions` and Playwright's `selectOption` work. Radix `RadioGroup` and `Checkbox` render buttons with the `radio` and `checkbox` roles, so query by role and use `toBeChecked()`.
- The mobile nav is a modal Sheet (`role="dialog"`): while it is open the rest of the page is hidden from role queries, so close it with Escape, its Close button or a link, not by clicking Menu again.

### Test cases

**API client (`src/api/`)**
- Adds `Authorization: Bearer` when a token is held.
- On 401, calls `/api/auth/refresh` once and retries the request.
- Concurrent 401s trigger only one refresh call.
- Failed refresh clears the session and redirects to `/login`.
- The access token is never written to `localStorage` or `sessionStorage`.
- 5xx responses are logged with their `X-Request-ID` and without the query string; network failures are logged; aborted requests and 4xx are not.

**Logger (`src/utils/logger.js`)**
- Production: errors are batched into one post with page path (no query), stack and request id; debug/info/warn are not posted; messages are clipped and at most 50 errors are sent per page.
- Development: errors go to the console and nothing is posted.
- `RouteError` reports a render error and offers a reload. E2E (`e2e/logging.spec.js`): an uncaught error in the built app reaches `/api/client-logs` (204) without a CSP block.

**Auth pages**
- Login: shows field errors for empty inputs; shows the server error on 401; redirects to the originally requested page on success, keeping its query string, and to the dashboard when no page was asked for; shows the logo and "Welcome back"; the password toggle shows and hides the password; "Forgot password?" says reset is coming soon without calling the API; the button is disabled with a spinner while logging in, so only one request is sent.
- Register: each password field has its own show/hide toggle; missing fields are named, invalid email, password shorter than 8 characters and mismatched passwords are blocked; 409 shows "email already registered" with a login link; a non-4-digit code is blocked; a wrong code shows "Incorrect code, please try again"; a 404 returns to the details step.
- Route guard: a logged-out user opening a page is sent to `/login` and returned to it after login; an expired session also returns to the page; after a logout the next login goes to the dashboard; going back after logout shows login.
- App start: session is restored through `/refresh` when the cookie is valid.
- Failed logout: the next app start retries `/logout` instead of calling `/refresh`; once the retry succeeds, the next start restores normally; logging in after a failed logout keeps the new session. `src/test/setup.js` clears `localStorage` after each test so the flag does not leak.

**Expenses**
- List renders amount, currency, date, category name and category badge.
- Empty state is shown when there are no expenses.
- Filters (category, family, date range) update the request query.
- Form: amount must be > 0 with at most 2 decimals; currency is chosen from the server's list, defaulting to AUD, and an unknown currency from the server shows next to it; date defaults to today; Personal or a family must be chosen.
- 422 field errors from the API appear next to the matching inputs.
- Edit and delete are shown only for the recorder's own expenses.

**Families and invitations**
- Create family; the creator is shown as owner.
- Search and pending invitations are visible only to owners; email and name search, the 3-character rule, "No user found", the narrow-your-search message, duplicate-invite message, cancel.
- Dashboard invitations: accept shows the joined family, decline removes it, a cancelled invitation shows "no longer available".
- Navigation: Menu toggles the drawer, Escape and choosing a link close it, the current page is marked.

**Dashboard summaries**
- Personal card first, then one card per family; no families shows only Personal.
- Filters start on This month and All categories; presets, category checkboxes, a custom range and Reset change every card's request; a From date after the To date shows a message and keeps the results.
- Totals per currency with a category breakdown; empty, loading, and error with Retry per card.
- Filters survive Add expense and reload (they are in the URL).

**Budgets and settings**
- Form (`BudgetPage.test.jsx`): only Personal and owned families are offered; missing fields and bad amounts show messages next to the fields and save nothing; the payload sends All categories and Personal as null, with `today`; 409 is shown above the form; editing changes only amount and period; a non-owner sees a notice.
- Dashboard (`BudgetsSection.test.jsx`): empty state; groups per scope with h3 headings; dates, spent, left or over by, progress and status label; Edit and Delete only when manageable; per-group period and category filters; delete only after confirmation; error with Retry; budgets reload after joining a family and after adding an expense.
- Settings: opens from the nav and the user menu, shows the saved day, explains the chosen day, saves with a toast; a saved day reaches the dashboard without a reload. Unsaved changes: leaving asks first (Keep editing and Escape stay, Discard changes leaves), nothing is asked when unchanged, after saving, on a link to Settings itself or on logout, and `beforeunload` is prevented only while changed.
- Dashboard month presets (`dashboardFilters.test.js`, `Dashboard.test.jsx`): start days 1, 15 and 28, before and after the day, across a new year and in a leap February; a viewer with day 15 gets matching requests, the This month state and the footer dates.
- E2E (`e2e/budgets.spec.js`): a budget moves through On track, Close to limit and Over budget as expenses are added, with no CSP errors; duplicate, edit and delete; Settings explains the day, asks before leaving unsaved, and the saved day moves the monthly budget dates and the dashboard's This month without a reload; a family budget is grouped under the family; one column and no sideways scroll at 360px.

**Reports**
- Totals are grouped by currency; different currencies are never summed.
- Switching group by category / month updates the view.
- Category bars use the category color and also show the category name.

**Accessibility**
- Every form input has an accessible label.
- All actions can be reached and triggered with the keyboard.

**End to end (Playwright)**

Rules for the suite: it runs with one worker (`workers: 1`), because every test shares the seeded test user and one SQLite database. Tests reuse named families (`ensureFamily` in `e2e/helpers.js`) instead of creating one per run, so the test user's data does not grow. Checks that depend on exact dashboard contents sign up a fresh user (`e2e/dashboard-helpers.js`). Filters are controlled by the URL, so click them and wait for `toBeChecked()` rather than using `check()`.

- Register, log in, add an expense, see it in the list, log out.
- Dashboard: adding personal and family expenses updates the right card only; category, preset and Reset change the cards; filters survive Add expense and reload.
- Two users: owner creates a family and invites a newly registered user, who accepts from the dashboard and sees the family's members; a cancelled invitation disappears from the invitee's dashboard.
- Later (family expenses): both see a shared family expense; the second user's personal expense stays hidden from the owner.
- Session survives a page reload (refresh cookie); access token expiry is handled without logging the user out.
- Responsive: the main pages at 360px, 768px and 1440px have no horizontal scroll, and the navigation is a drawer below 1024px and a sidebar from 1024px. On login the brand highlights show only from 1024px, and the toggle and "Forgot password?" are at least 44px tall.
- Login works with the keyboard alone (tab order, Enter submits); the favicon is the Expense Sarathi icon.
- Opening a page with a query string while logged out returns to it, query string included, after login.
- A logout request that fails (network abort) is finished on the next page load; a further reload still shows login.
