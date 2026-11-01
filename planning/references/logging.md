# Expense Sarathi - Logging

Everything is written to stdout, one event per line. Each runtime already collects stdout: `docker compose logs` locally, CloudWatch Logs on Lambda (through Lambda Web Adapter) and on the Fargate migration task. There are no log files, shipping agents or third-party services.

```
Browser                          Backend (same image locally and on Lambda)
-------                          ------------------------------------------
utils/logger.js                  log_requests middleware: request ID + access line
  dev  -> console                services: logging.getLogger(__name__) events
  prod -> POST /api/client-logs  exception handler: traceback, generic 500
          (errors only) ------>  client_logs router -> logger "client" (WARNING)
                                        |
                                 stdout (JSON lines in production)
                                        |
                local: docker compose logs     AWS: CloudWatch Logs
                                                 -> Logs Insights queries
                                                 -> ERROR metric filter -> alarm -> SNS email
```

## Backend

- `app/logging_config.py` puts one stdout handler on the root logger. uvicorn's loggers propagate to it, so server messages share the format.
- `LOG_FORMAT=json` (production): one JSON object per line with `ts`, `level`, `logger`, `message`, `request_id`, any `extra=` fields, and `exc_info` for tracebacks. `LOG_FORMAT=text` (local): `time LEVEL logger [request_id] message key=value ...`. `LOG_LEVEL` sets the level. See [configuration.md](configuration.md).
- `app/request_logging.py` middleware (outermost, so it also sees host rejections):
  - Reuses an incoming `X-Request-ID` if it matches `[A-Za-z0-9-]{1,64}`, otherwise makes one (32 hex characters).
  - Holds it in a contextvar, so every line logged during the request carries it, and returns it in the `X-Request-ID` response header.
  - Logs one `app.access` line per request: `method`, `path` (no query string), `status`, `duration_ms`, `user_id` (set by `get_current_user` on `request.state`). `/api/health` is skipped because the container health check polls it.
- uvicorn runs with `--no-access-log`, so each request is logged once.
- The `Exception` handler logs unhandled errors with their traceback and returns `{"detail": "Internal server error"}` (500) with the security headers and `X-Request-ID`.

### Domain events

Services log fixed messages at INFO with ids as fields, after the change is committed:

| Logger | Message | Fields |
|---|---|---|
| `app.services.auth_service` | `login succeeded` / `login failed` | `user_id` (None for an unknown email) |
| `app.services.auth_service` | `refresh token reuse detected; all sessions revoked` (WARNING) | `user_id` |
| `app.services.registration_service` | `sign-up started`, `sign-up code incorrect` (`attempts`, `out_of_attempts`), `sign-up verified; user created` (`user_id`) | |
| `app.services.family_service` | `family created` | `user_id`, `family_id` |
| `app.services.invitation_service` | `invitation sent` / `cancelled` / `accepted` / `declined` | `user_id`, `family_id`, `invitation_id`, `invitee_id` (sent) |
| `app.services.expense_service` | `expense created` | `user_id`, `expense_id`, `family_id` |

### Never log

Passwords, OTPs, JWTs, refresh tokens, registration ids, `Authorization` and `Cookie` headers, request bodies, query strings, or emails. Log `user_id` instead. `tests/integration/test_log_safety.py` runs the whole auth flow at DEBUG and fails if any of these appear in a captured message or field.

## Frontend

- `src/utils/logger.js` has `debug`, `info`, `warn` and `error`. In development all go to the console. In production only `error` is kept: entries are batched (posted after 1 second or at 10 entries, and on `pagehide`), limited to 50 per page load, clipped to the endpoint's field limits, and sent with `fetch(..., { keepalive: true })`. The logger uses plain `fetch`, not the API client, so a failing post cannot log itself.
- Each entry has `message`, `stack`, `url` (page path without the query string) and `request_id`.
- Captured errors:
  - `window` `error` and `unhandledrejection` (`captureGlobalErrors()` in `main.jsx`).
  - Router render errors: the root route's `errorElement` is `components/RouteError.jsx`, which reports the error and offers Reload page.
  - In `api/client.js`: 5xx responses (with their `X-Request-ID`, which matches the backend's access line) and network failures. Aborted requests and 4xx are not logged. The logged path has no query string.
- The post goes to the same origin, so the CSP (`default-src 'self'`) needs no change. Sentry or similar would need CSP and privacy changes; not used.

### `POST /api/client-logs`

- Public, so errors on the login page are reported too. Body: `{"entries": [...]}` with 1-10 entries; `message` ≤ 1000 characters, `stack` ≤ 5000, `url` ≤ 500, `request_id` ≤ 64; unknown fields return 422. Returns 204.
- Each entry is logged on the `client` logger at **WARNING** with `client_message`, `stack`, `url`, `api_request_id` and `user_agent` (from the header, ≤ 300 characters). WARNING, not ERROR, because anyone can post here and must not be able to trigger the error alarm.

## Production (AWS)

Setup steps for each option are in [aws_deployment.md](aws_deployment.md) (A15, B15, C3).

- **Retention**: 30 days on `/aws/lambda/expense-sarathi-api` and `/ecs/expense-sarathi-migrate` (the default keeps logs forever).
- **Error alarm**: metric filter `{ $.level = "ERROR" }` on the Lambda log group -> metric `AppErrors` (namespace `expense-sarathi`) -> alarm at Sum >= 1 in 5 minutes -> SNS topic `expense-sarathi-alerts` (email).
- **Logs Insights** queries on the Lambda log group:
  ```
  fields @timestamp, level, logger, message, status, path, user_id
  | filter request_id = "<id from the X-Request-ID header or a client entry's api_request_id>"
  | sort @timestamp asc
  ```
  ```
  fields @timestamp, method, path, status, duration_ms
  | filter logger = "app.access" and status >= 500
  | sort @timestamp desc
  ```
  ```
  fields @timestamp, client_message, url, api_request_id
  | filter logger = "client"
  | sort @timestamp desc
  ```
- Lambda also writes its own `START`/`END`/`REPORT` lines, which are not JSON; filters on JSON fields skip them.
- API Gateway and CloudFront access logs are optional; enable them only for edge-level debugging.

## Local

`docker compose logs -f app` shows the lines. Set `LOG_FORMAT=text` in `.env` for readable output (`.env.example` does).
