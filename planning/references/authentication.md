# Expense Sarathi - Authentication

JWT access tokens with database-backed refresh tokens. Refresh tokens are stored in the `refresh_tokens` table (PostgreSQL in production, SQLite locally). See [data_model.md](data_model.md).

## Tokens

| | Access token | Refresh token |
|---|---|---|
| Format | JWT, signed with HS256 | Random opaque string (`secrets.token_urlsafe(32)`) |
| Lifetime | 10 minutes | 30 minutes idle: each rotation issues a token valid for another 30 minutes |
| Stored on server | No (stateless) | Yes, as a SHA-256 hash in `refresh_tokens` |
| Sent by client | `Authorization: Bearer <token>` header | HttpOnly cookie |
| Held by frontend | In memory only (not localStorage) | Browser cookie jar; not readable by JavaScript |

Access token claims: `sub` (user id), `iat`, `exp`, `type: "access"`.

Refresh cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`, `Max-Age` equal to the idle window. The API and app share one origin, so no CORS setup is needed.

## Session inactivity

A session ends after 30 minutes without activity:
- **Server**: the refresh token expires 30 minutes after it is issued. Every refresh rotates it and starts a new 30-minute window, so an active user stays logged in and a returning user within the window goes straight to the dashboard.
- **Browser**: a 30-minute idle timer (no pointer, key, scroll or touch events) logs the user out and returns them to the login page, even if the tab stays open.

## Endpoints

All under `/api/auth`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Create a user (email, password, display name) |
| POST | `/login` | Check credentials; return access token and set refresh cookie |
| POST | `/refresh` | Exchange the refresh cookie for a new access token and a new refresh cookie |
| POST | `/logout` | Requires the refresh cookie but not an access token; revoke its token if valid and clear the cookie. Return 204 even if the cookie is missing, expired or already revoked. |

The current user is returned by `GET /api/users/me` (see [api_design.md](api_design.md)).

## Flows

- **Login**: verify the password hash, create a `refresh_tokens` row, return the access token and set the cookie.
- **Authenticated request**: a FastAPI dependency decodes the JWT, checks `exp` and `type`, loads the user and rejects inactive users with 401.
- **Refresh (rotation)**: atomically consume the cookie's token and issue a new refresh token and access token. If it is expired or unknown, return 401 and clear the cookie. Only one request using a token can succeed: consumption is a conditional `UPDATE ... WHERE revoked_at IS NULL AND expires_at > now`, and only the request that updates the row wins (dialect-neutral; no `SELECT ... FOR UPDATE`).
- **Reuse detection**: presenting an already-revoked token, including a duplicate concurrent refresh, is treated as token reuse and revokes all refresh tokens for that user (forces login everywhere). The client should share one in-flight refresh request; clients that race across tabs may need to log in again.
- **Logout**: this endpoint does not require an access token. Revoke the presented refresh token if it is valid, always clear the cookie, and return 204 even if the cookie is missing, expired or already revoked.
- **Frontend**: on a 401 from the API, call `/refresh` once and retry. If refresh fails, go to the login page. On page load, call `/refresh` to restore the session. Every `/refresh` call, including the one on page load, goes through one shared in-flight request; otherwise a double mount (React StrictMode) sends the same token twice and triggers reuse detection. When a page is restored from the browser's back-forward cache, the session is checked again.

## Implementation notes

- Libraries: `PyJWT` for JWTs, `bcrypt` for password hashing (`bcrypt.hashpw` / `bcrypt.checkpw`, default cost factor 12).
- bcrypt only accepts passwords up to 72 bytes, so registration rejects passwords longer than 72 bytes (UTF-8).
- Settings (via the `Settings` class): `JWT_SECRET`, `ACCESS_TOKEN_MINUTES=10`, `REFRESH_TOKEN_IDLE_MINUTES=30`. In production `JWT_SECRET` comes from AWS Secrets Manager.
- Login errors do not reveal whether the email exists. The login email is a plain string (not `EmailStr`), so a malformed address also gets "Incorrect email or password".
- Login ends its read transaction before the bcrypt check, so no database lock is held during the slow hash.
- Local and test environments seed one user, `test@gmail.com` / `P@ssw0rd` ("Test User"), with `python -m app.seed`. The command does nothing when `ENVIRONMENT=production`, and it is not a migration.
- Expired and revoked refresh token rows can be deleted by a periodic cleanup.
