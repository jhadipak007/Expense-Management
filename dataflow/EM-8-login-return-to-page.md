# EM-8 Data Flow: Returning to the Requested Page After Login

This document explains what EM-8 changed and how the requested page travels from the route guard, through the login page, and back after login. It builds on [EM-2-login-dashboard-logout.md](EM-2-login-dashboard-logout.md).

Design references: [frontend.md](../planning/references/frontend.md), [authentication.md](../planning/references/authentication.md), [testing.md](../planning/references/testing.md).

## 1. The bug and its root cause

A logged-out user who opened `/families` was sent to `/login`, but after logging in always landed on `/`.

`RequireAuth` already saved `{ from: '/families' }` in the history state, and `Login` called `navigate(from)` after `login()`. Recording every router update in a test showed the real order:

```
before login: location=/login  state={"from":"/families"}
login() sets status=authenticated while the URL is still /login
GuestOnly renders <Navigate to="/" />           (logged: "GuestOnly renders Navigate to /")
location=/families                              (Login's navigate)
location=/                                      (GuestOnly's navigate, runs last and wins)
```

Two components redirected after login. `GuestOnly` (the parent route of `/login`) saw the authenticated session before the URL changed and queued its own redirect to `/`, which ran after Login's.

## 2. The fix: one redirect after login

| Part | Code | Change |
|---|---|---|
| Guard | `frontend/src/auth/guards.jsx` | `RequireAuth` saves `from` as path + query string + hash. `GuestOnly` redirects to `state.from ?? '/'` |
| Login page | `frontend/src/pages/Login/Login.jsx` | No longer navigates after `login()` |
| OTP step | `frontend/src/pages/Register/OtpForm.jsx` | No longer navigates after `completeRegistration()` |
| Session | `frontend/src/auth/AuthProvider.jsx` | `logout()` sets `SIGNED_OUT` (`signedOut: true`) |

```
logged out, opens /families?tab=mine
  RequireAuth ──► /login   history state { from: "/families?tab=mine" }
  Login form ──► login() ──► AuthProvider: status = authenticated
  GuestOnly  ──► <Navigate to={state.from ?? '/'} replace />  ──► /families?tab=mine
```

`from` is only written by the app into the history state; it is never read from the URL, so it cannot be used for an open redirect.

## 3. Logout forgets the page

The fix exposed a second issue, seen in the families e2e tests. When a user logged out on `/families/3`, `RequireAuth` remembered that page. Chromium keeps the history state when the same URL (`/login`) is opened again, so the next person to log in on that tab landed on the previous user's page ("Family not found").

`logout()` (the user menu and the 30-minute idle logout) now sets `signedOut: true`, and `RequireAuth` then sends the user to `/login` with no state. The next login goes to the dashboard. The flag disappears with the next `login`, `completeRegistration` or session restore, because each of them sets a new session object.

| How the user became logged out | Page remembered? |
|---|---|
| Opened a page with no session (fresh visit, reload) | yes |
| Session expired (refresh failed, `setSessionExpiredHandler`) | yes |
| Logout from the menu or after 30 idle minutes | no |

## 4. Tests

| Test | File |
|---|---|
| returns to the page asked for before login | `frontend/src/pages/Login/Login.test.jsx` |
| keeps the query string of the page asked for | `frontend/src/pages/Login/Login.test.jsx` |
| logout forgets the page, so the next login goes to the dashboard | `frontend/src/auth/session.test.jsx` |
| an expired session remembers the page, so login returns to it | `frontend/src/auth/session.test.jsx` |
| login returns to the page asked for, with its query string | `frontend/e2e/login.spec.js` |

## 5. Out of scope

- `/reports` has no page yet; it falls to the `*` route, which goes to `/`.
- Following the Sign up link from login drops the remembered page.
