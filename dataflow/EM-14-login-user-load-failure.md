# EM-14 Data Flow: A Login Whose User Cannot Be Loaded

This document explains what EM-14 changed so that a login or sign-up that cannot finish leaves no session behind. It builds on [EM-13-logout-failure.md](EM-13-logout-failure.md) and [EM-8-login-return-to-page.md](EM-8-login-return-to-page.md).

Design references: [authentication.md](../planning/references/authentication.md), [frontend.md](../planning/references/frontend.md).

## 1. The bug and its root cause

Reproduced 3 of 3 times with Playwright against the Docker app, using the steps in the issue:

```
GET /api/users/me fails once (page.route -> 500)
log in   -> POST /api/auth/login 200 (refresh_token cookie set, access token kept)
         -> GET /api/users/me 500 -> "Something went wrong. Please try again." on /login
reload   -> POST /api/auth/refresh 200 -> dashboard
```

Login is two steps. `authApi.login()` keeps the access token as soon as `POST /api/auth/login` succeeds, and the response sets the HttpOnly refresh cookie. `AuthProvider.login()` then loads the user. When that second step failed, the session stayed `unauthenticated` but nothing ended the server session or dropped the token, so the next app start restored it. `completeRegistration()` (sign-up verification) had the same two steps.

## 2. The fix

| Part | Code | Change |
|---|---|---|
| Session | `frontend/src/auth/AuthProvider.jsx` | `login()` and `completeRegistration()` call `enterSession()`, which loads the user and, if that fails, calls `authApi.logout()` (drops the token, sets `logout-pending`, posts `/logout`) and rethrows |

The backend needed no change.

```
login / verify succeeds ─► token kept, cookie set
  GET /api/users/me ok   ─► session = authenticated (as before)
  GET /api/users/me fail ─► authApi.logout(): token = null, logout-pending set, POST /logout
                               204  ─► logout-pending cleared, cookie cleared
                               fail ─► flag stays; the next app start retries /logout (EM-13)
                            ─► error rethrown: Login / Register show their message
```

## 3. Tests

| Test | Covers |
|---|---|
| `frontend/src/auth/session.test.jsx` | After login and after sign-up verification, a failed user load posts `/logout` and the next API call has no `Authorization` header; if that logout also fails, the next app start retries it and does not refresh. All three failed before the fix |
| `frontend/e2e/login.spec.js` | The issue's steps: the error shows, `/logout` returns 204, and a reload stays on login |
