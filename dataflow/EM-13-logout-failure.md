# EM-13 Data Flow: Finishing a Logout That Failed to Reach the Server

This document explains what EM-13 changed and how a logout now always ends the server session, even when its request fails. It builds on [EM-2-login-dashboard-logout.md](EM-2-login-dashboard-logout.md) and [EM-8-login-return-to-page.md](EM-8-login-return-to-page.md).

Design references: [authentication.md](../planning/references/authentication.md), [frontend.md](../planning/references/frontend.md), [testing.md](../planning/references/testing.md).

## 1. The bug and its root cause

Reproduced 6 of 6 times with Playwright against the Docker app (3 runs each with a 500 response and a dropped connection on `POST /api/auth/logout`):

```
log in -> Logout from the user menu   -> POST /api/auth/logout fails
          the login page shows         (pageerror: "API error 500" / "Failed to fetch")
reload -> POST /api/auth/refresh 200   -> dashboard again
```

Only the logout request ends the session on the server: it revokes the refresh token row and clears the HttpOnly `refresh_token` cookie, which JavaScript cannot touch. The frontend switched to "logged out" first and ignored the result, so when the request failed both survived and the next app start restored the session from the cookie. The same happens when navigating away aborts the request. The rejected promise was also unhandled.

The backend needed no change: `/logout` needs only the cookie, and returns 204 for a valid, revoked, expired, unknown or missing one, so it is safe to retry later.

## 2. The fix: a pending-logout flag

| Part | Code | Change |
|---|---|---|
| Auth API | `frontend/src/api/auth.js` | `logout()` sets `localStorage['logout-pending']` before the request and removes it on success. `restoreSession()` retries a pending logout and returns false, else refreshes and returns true. `login()` and `verifyRegistration()` clear the flag through `startSession()` |
| Session | `frontend/src/auth/AuthProvider.jsx` | `logout()` catches the failure (retried later). `restore()` sets the session to logged out when `restoreSession()` returns false |

```
Logout (menu or idle)
  set logout-pending ─► session = SIGNED_OUT (login page) ─► POST /logout
                                                    204 ─► remove logout-pending
                                                   fail ─► flag stays

App start / back-forward cache restore
  logout-pending?  yes ─► POST /logout (retry) ─► logged out, /refresh not called
                                         204  ─► remove logout-pending
                   no  ─► POST /refresh ─► restore the session (as before)

Login or sign-up succeeds ─► remove logout-pending (the new cookie replaced the old one)
```

The flag holds no secret; the access token is still kept in memory only. It lives in `localStorage`, so it is shared by the tabs of the browser: when one tab's logout fails, another tab keeps working until it reloads, and that reload finishes the logout.

## 3. Tests

| Test | File |
|---|---|
| a failed logout is retried on the next app start instead of restoring the session | `frontend/src/auth/session.test.jsx` |
| after a retried logout succeeds, the next app start restores the session again | `frontend/src/auth/session.test.jsx` |
| logging in after a failed logout keeps the new session on the next app start | `frontend/src/auth/session.test.jsx` |
| a logout that fails to reach the server is finished on the next load | `frontend/e2e/login.spec.js` |

`src/test/setup.js` now clears `localStorage` after each test so the flag does not leak between tests.

## 4. Known limit

If a slow logout request is still in flight while the user logs in again, the logout response can clear the new session's cookie, so a reload shows the login page. It needs a slow logout plus a very fast re-login, existed before EM-13, and only costs a second login.
