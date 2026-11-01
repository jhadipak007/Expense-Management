# EM-15 Data Flow: Structured Logging

This document explains what EM-15 changed and how a log line travels from the backend and the browser to `docker compose logs` locally and CloudWatch in production.

Design references: [logging.md](../planning/references/logging.md), [configuration.md](../planning/references/configuration.md), [aws_deployment.md](../planning/references/aws_deployment.md), [testing.md](../planning/references/testing.md).

## 1. Before

`main.py` called `logging.basicConfig(level=...)`. No module logged anything, uvicorn printed its own text access log, and browser errors went nowhere.

## 2. What changed

| Part | Code | Change |
|---|---|---|
| Settings | `backend/app/config.py` | `LOG_FORMAT` (`json` default, `text` in `.env.example`) next to `LOG_LEVEL` |
| Formatters | `backend/app/logging_config.py` | One stdout handler on the root logger; `JsonFormatter` (one object per line) or `TextFormatter` (`extra=` fields as key=value); `RequestIdFilter` stamps `request_id` from a contextvar; uvicorn loggers propagate to it |
| Request middleware | `backend/app/request_logging.py` | Reuses a safe `X-Request-ID` or makes one, sets the contextvar, echoes the header, logs one `app.access` line (skips `/api/health`) |
| Current user | `backend/app/deps.py` | `get_current_user` puts `user_id` on `request.state` for the access line |
| Errors | `backend/app/main.py` | `Exception` handler logs the traceback and returns a generic 500 with security headers and `X-Request-ID` |
| Domain events | `backend/app/services/*` | Fixed-message INFO events with ids (login, sign-up, family, invitations, expense); refresh token reuse at WARNING |
| Browser errors in | `backend/app/routers/client_logs.py`, `schemas/client_log.py` | Public `POST /api/client-logs`, capped input, logged on the `client` logger at WARNING |
| Browser logger | `frontend/src/utils/logger.js` | Console in development; errors batched and posted in production |
| Capture | `frontend/src/main.jsx`, `routes.jsx`, `components/RouteError.jsx`, `api/client.js` | Global errors and rejections, router render errors, API 5xx and network failures |
| Run commands | `Dockerfile`, `docker-compose.yml` | uvicorn `--no-access-log` |
| AWS | `planning/references/aws_deployment.md` | `AppErrors` metric filter on `{ $.level = "ERROR" }` and alarm (Console, CLI, Terraform); retention was already 30 days |

## 3. A request

```
Browser ── GET /api/expenses (X-Request-ID optional) ──► log_requests middleware
                                                          request_id = incoming if [A-Za-z0-9-]{1,64} else uuid4 hex
                                                          request_id_var.set(request_id)
             security headers, TrustedHost, router ◄──────┘
             get_current_user ─► request.state.user_id
             service ─► logger.info("expense created", extra={user_id, expense_id, family_id})
                          └─ handler: RequestIdFilter adds request_id ─► stdout
             response ◄── middleware logs app.access {method, path, status, duration_ms, user_id}
                          and sets X-Request-ID on the response
```

A production line:
```json
{"ts": "2026-11-01T03:51:52.842+00:00", "level": "INFO", "logger": "app.access", "message": "request", "request_id": "demo-1", "method": "GET", "path": "/api/categories", "status": 401, "duration_ms": 14, "user_id": null}
```

An unhandled exception passes through the middleware (which logs the access line with status 500) to Starlette's `ServerErrorMiddleware`, which calls the `Exception` handler. The contextvar is still set, so the traceback line and the 500 response carry the same request ID.

## 4. A browser error

```
throw / rejection / render error / API 5xx / network failure
  └─► logger.error(message, { error, requestId })
        dev:  console.error
        prod: queue entry {message, stack, url: pathname, request_id}
              ─► after 1 s, at 10 entries, or on pagehide:
                 fetch POST /api/client-logs {entries}  (keepalive, same origin: CSP allows it)
                   ─► ClientLogsIn validation (1-10 entries, length caps, no unknown fields)
                   ─► logger "client" WARNING {client_message, stack, url, api_request_id, user_agent}
                   ─► 204
```

For an API 5xx, `api_request_id` is the failing response's `X-Request-ID`, so a Logs Insights query on it finds the server's traceback and access line. Client entries are WARNING so anonymous posts cannot trigger the ERROR alarm.

## 5. Production

stdout ─► CloudWatch log group `/aws/lambda/expense-sarathi-api` (30-day retention) ─► metric filter `{ $.level = "ERROR" }` ─► `expense-sarathi/AppErrors` ─► alarm (Sum >= 1 in 5 minutes) ─► SNS `expense-sarathi-alerts` email. Logs Insights queries are in [logging.md](../planning/references/logging.md).

## 6. Tests

| Test | Covers |
|---|---|
| `backend/tests/unit/test_logging_config.py` | JSON line fields, `extra=` fields, traceback, request ID outside a request, text format |
| `backend/tests/integration/test_request_logging.py` | Generated, reused and replaced `X-Request-ID`; access line fields and `user_id`; health checks skipped |
| `backend/tests/integration/test_log_safety.py` | Generic 500 with traceback logged; the whole auth flow at DEBUG logs no password, OTP, email, token or registration id (checked to fail when a password is logged) |
| `backend/tests/integration/test_domain_logs.py` | Each domain event with its ids |
| `backend/tests/integration/test_client_logs.py` | Public endpoint logs entries at WARNING; oversized or unknown input is 422 |
| `frontend/src/utils/logger.test.js` | Batching, path without query, debug/info/warn not posted, clipping, 50-per-page cap, console in development |
| `frontend/src/api/client.test.js` | 5xx logged with request ID and no query string; network failure logged; abort and 404 not logged |
| `frontend/src/components/RouteError.test.jsx` | Render error reported, reload offered |
| `frontend/e2e/logging.spec.js` | Request ID header; an uncaught error in the built app is posted (204) without a CSP block |

Verified against the Docker app: the container log shows the JSON access lines and the `client` WARNING line from the e2e error. `RouteError` was screenshotted at 360, 768 and 1440 px with no horizontal scroll.

## 7. Known limits

- `/api/client-logs` is public with no rate limit; the input caps and the WARNING level limit the damage.
- The login page already logs two inline-style CSP messages on load (unrelated to logging; the e2e test checks only for blocked connections).
