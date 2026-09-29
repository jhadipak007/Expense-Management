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

**Integration**
- Auth: register with OTP (correct code creates and logs in the user; wrong code; 5th wrong code ends the registration; expiry; abandoned sign-up does not block the email), duplicate email (409), login success and failure (401, same message for unknown email and wrong password), only one request using a refresh token succeeds and a duplicate/replayed use revokes all refresh tokens, logout works with a refresh cookie and no access token (including missing/expired/revoked cookie, always 204 and clears cookie), access token expiry.
- Every protected endpoint returns 401 without a token (one parametrized test over all routes).
- Expenses: create personal and family expenses; list returns only visible expenses; non-member gets 404 for a family expense; only the recorder can edit or delete; filters, sorting and pagination.
- Families: create (creator is owner), list with role, member sees members, non-member gets 404, owner-only actions return 403 for members.
- User search: exact email only, name needs 3+ characters, masked emails, at most 10 with `has_more`, owner and inactive users excluded, LIKE wildcards match literally.
- Invitations: 7-day expiry, duplicate member or open invitation returns 409, re-invite after decline/cancel/expiry, cancel removes it for both sides, accepted invitations cannot be cancelled, accept joins the family, decline does not, cancelled or expired invitations return 409, someone else's invitation returns 404.
- Reports: totals grouped by currency with no conversion; omitting `family_id` returns only the user's personal expenses, supplying a member family ID returns only that family's expenses, and no report combines personal and family expenses.
- SQL injection: payloads such as `1 OR 1=1` and `'; DROP TABLE expenses;--` in path and query parameters return 422 and change nothing.
- Security headers present on `/api` responses; `/docs` disabled when `ENABLE_API_DOCS=false`.
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
- shadcn/ui components use Radix, which needs browser APIs jsdom lacks. `src/test/setup.js` stubs `Element.prototype.hasPointerCapture`, `releasePointerCapture`, `scrollIntoView` and `ResizeObserver`.
- A shadcn `Select` is not a native `<select>`: click the `combobox` trigger with `user-event`, then click the `option`. Do not use `selectOptions`.

### Test cases

**API client (`src/api/`)**
- Adds `Authorization: Bearer` when a token is held.
- On 401, calls `/api/auth/refresh` once and retries the request.
- Concurrent 401s trigger only one refresh call.
- Failed refresh clears the session and redirects to `/login`.
- Token is never written to `localStorage` or `sessionStorage`.

**Auth pages**
- Login: shows field errors for empty inputs; shows the server error on 401; redirects to the originally requested page on success; shows the logo and "Welcome back"; the password toggle shows and hides the password; "Forgot password?" says reset is coming soon without calling the API; the button is disabled with a spinner while logging in, so only one request is sent.
- Register: each password field has its own show/hide toggle; missing fields are named, invalid email, password shorter than 8 characters and mismatched passwords are blocked; 409 shows "email already registered" with a login link; a non-4-digit code is blocked; a wrong code shows "Incorrect code, please try again"; a 404 returns to the details step.
- Route guard: a logged-out user opening `/reports` is sent to `/login` and returned after login.
- App start: session is restored through `/refresh` when the cookie is valid.

**Expenses**
- List renders amount, currency, date, category name and category badge.
- Empty state is shown when there are no expenses.
- Filters (category, family, date range) update the request query.
- Form: amount must be > 0 with at most 2 decimals; currency must be 3 letters; date defaults to today; Personal or a family must be chosen.
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
