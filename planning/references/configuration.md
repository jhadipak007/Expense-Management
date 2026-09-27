# Expense Sarathi - Configuration

## Loading

- One `Settings` class (pydantic-settings) in `backend/app/config.py` reads environment variables and the git-ignored `.env` file. No code reads `os.environ` directly.
- A single cached instance (`get_settings()` with `functools.lru_cache`) is used across the app and in FastAPI dependencies. It loads once per process, which keeps Lambda cold starts cheap.
- A missing or invalid required setting fails at startup, not mid-request.
- A committed `.env.example` lists every setting with safe sample values.

## Settings

| Setting | Type | Purpose | Local default | Production |
|---|---|---|---|---|
| `ENVIRONMENT` | `Literal["local", "test", "production"]` | Current environment | `local` | `production` |
| `USE_POSTGRESQL_DB` | `bool` | SQLite (`false`) or PostgreSQL (`true`) | `false` | `true` |
| `SQLITE_PATH` | `str` | SQLite file in the mounted `db/` directory | `db/expense_sarathi.db` | not used |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | `str`, `int`, `str` | PostgreSQL location | not used | Lambda env vars |
| `DB_USER`, `DB_PASSWORD` | `str`, `SecretStr` | PostgreSQL credentials | not used | Secrets Manager (`db_user`, `db_password`) |
| `JWT_SECRET` | `SecretStr` | Signs access tokens | dev value in `.env` | Secrets Manager (`jwt_secret`) |
| `ACCESS_TOKEN_MINUTES` | `int` | Access token lifetime | `10` | `10` |
| `REFRESH_TOKEN_IDLE_MINUTES` | `int` | Session idle timeout: refresh token and cookie lifetime, renewed on every refresh | `30` | `30` |
| `INVITATION_EXPIRY_DAYS` | `int` | Invitation link lifetime | `7` | `7` |
| `COOKIE_SECURE` | `bool` | `Secure` flag on the refresh cookie | `false` (http on localhost) | `true` |
| `ALLOWED_HOSTS` | `list[str]` | `TrustedHostMiddleware` hosts | `["localhost", "127.0.0.1"]` | API Gateway host (CloudFront does not forward the viewer host) |
| `AWS_SECRETS_MANAGER_SECRET_ID` | `str \| None` | Secret to load at startup | unset | `expense-sarathi/prod/app` |
| `ENABLE_API_DOCS` | `bool` | Serve `/docs`, `/redoc`, `/openapi.json` | `true` | `false` |
| `LOG_LEVEL` | `str` | Logging level | `DEBUG` | `INFO` |
| `FRONTEND_DIST_DIR` | `str` | Built frontend served by FastAPI | `frontend/dist` | not used (S3) |

The database URL is built in `Settings` from these fields (a computed property), using SQLAlchemy's `URL.create()` so special characters in the password are escaped.

## Secrets

- Secret fields use `SecretStr`, so they never appear in logs, `repr()` or error messages. Read them with `.get_secret_value()` only where needed.
- Production secrets live in one AWS Secrets Manager secret, `expense-sarathi/prod/app`, with JSON keys `db_user`, `db_password` and `jwt_secret` (keys match the field names).
- When `AWS_SECRETS_MANAGER_SECRET_ID` is set, `Settings` adds pydantic-settings' `AWSSecretsManagerSettingsSource` (extra `pydantic-settings[aws-secrets-manager]`) and loads the secret once at cold start. The secret id is read by a small bootstrap `BaseSettings`, so no code reads `os.environ`.
- Secrets are never put in Lambda environment variables or GitHub. Setup details: [aws_deployment.md](aws_deployment.md).
- `.env` holds development values only and is never committed.

## Environments

| | Local | Test | Production |
|---|---|---|---|
| Database | SQLite in `db/` | temporary SQLite file per test run | RDS PostgreSQL |
| Source of values | `.env` | test fixtures override `Settings` | Lambda environment + Secrets Manager |
| `JWT_SECRET` | dev value | fixed test value | Secrets Manager |
| API docs | on | on | off |

Release check: the test suite also runs with `USE_POSTGRESQL_DB=true` against a local PostgreSQL container.

## Frontend

No runtime configuration. The app and API share one origin, so the frontend calls `/api` with relative URLs. If a build-time value is ever needed, it uses a `VITE_` variable, and no secret may be stored in one.
