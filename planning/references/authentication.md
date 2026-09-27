# Expense Sarathi - Authentication

JWT access tokens with database-backed refresh tokens. Refresh tokens are stored in the `refresh_tokens` table (PostgreSQL in production, SQLite locally). See [data_model.md](data_model.md).

## Tokens

| | Access token | Refresh token |
|---|---|---|
| Format | JWT, signed with HS256 | Random opaque string (`secrets.token_urlsafe(32)`) |
| Lifetime | 10 minutes | 7 days |
| Stored on server | No (stateless) | Yes, as a SHA-256 hash in `refresh_tokens` |
| Sent by client | `Authorization: Bearer <token>` header | HttpOnly cookie |
| Held by frontend | In memory only (not localStorage) | Browser cookie jar; not readable by JavaScript |

Access token claims: `sub` (user id), `iat`, `exp`, `type: "access"`.

Refresh cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`. The API and app share one origin, so no CORS setup is needed.

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
- **Refresh (rotation)**: atomically consume the cookie's token and issue a new refresh token and access token. If it is expired or unknown, return 401. Only one request using a token can succeed.
- **Reuse detection**: presenting an already-revoked token, including a duplicate concurrent refresh, is treated as token reuse and revokes all refresh tokens for that user (forces login everywhere). The client should share one in-flight refresh request; clients that race across tabs may need to log in again.
- **Logout**: this endpoint does not require an access token. Revoke the presented refresh token if it is valid, always clear the cookie, and return 204 even if the cookie is missing, expired or already revoked.
- **Frontend**: on a 401 from the API, call `/refresh` once and retry. If refresh fails, go to the login page. On page load, call `/refresh` to restore the session.

## Implementation notes

- Libraries: `PyJWT` for JWTs, `bcrypt` for password hashing (`bcrypt.hashpw` / `bcrypt.checkpw`, default cost factor 12).
- bcrypt only accepts passwords up to 72 bytes, so registration rejects passwords longer than 72 bytes (UTF-8).
- Settings (via the `Settings` class): `JWT_SECRET`, `ACCESS_TOKEN_MINUTES=10`, `REFRESH_TOKEN_DAYS=7`. In production `JWT_SECRET` comes from AWS Secrets Manager.
- Login errors do not reveal whether the email exists.
- Expired and revoked refresh token rows can be deleted by a periodic cleanup.
