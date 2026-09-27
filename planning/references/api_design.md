# Expense Sarathi - API Design

REST API under `/api`, JSON in and out. Data model: [data_model.md](data_model.md). Auth: [authentication.md](authentication.md).

## Authentication rule

Every endpoint requires a valid access token, except these, which cannot require one:

| Endpoint | Protection instead |
|---|---|
| `POST /api/auth/register` | Input validation, rate limiting |
| `POST /api/auth/login` | Input validation, rate limiting |
| `POST /api/auth/refresh` | Requires a valid refresh cookie |
| `POST /api/auth/logout` | Requires the refresh cookie; does not require an access token |
| `GET /api/health` | Returns only `{"status": "ok"}` |

Enforcement: each router is created with `dependencies=[Depends(get_current_user)]`, so a new route is protected by default. The public auth routes live on a separate router.

Authorization is checked in the service layer after authentication:
- Expenses: see the access rules in [data_model.md](data_model.md).
- Family management: owner only.
- A resource the user may not see returns **404**, not 403, so IDs cannot be probed.

## Endpoints

### Auth (`/api/auth`)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/register` | `RegisterIn` | `UserOut` (201) |
| POST | `/login` | `LoginIn` | `TokenOut` + refresh cookie |
| POST | `/refresh` | none (cookie) | `TokenOut` + new cookie |
| POST | `/logout` | none | 204 |

### Users (`/api/users`)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/me` | none | `UserOut` |
| PATCH | `/me` | `UserUpdateIn` | `UserOut` |
| POST | `/me/password` | `PasswordChangeIn` | 204; revokes all refresh tokens |

### Categories (`/api/categories`)
| Method | Path | Returns |
|---|---|---|
| GET | `/` | `list[CategoryOut]` |

### Families (`/api/families`)
| Method | Path | Body | Who | Returns |
|---|---|---|---|---|
| GET | `/` | none | any user | families the user belongs to |
| POST | `/` | `FamilyIn` | any user | `FamilyOut` (201); creator becomes owner |
| GET | `/{family_id}` | none | member | `FamilyOut` with members |
| PATCH | `/{family_id}` | `FamilyIn` | owner | `FamilyOut` |
| DELETE | `/{family_id}/members/{user_id}` | none | owner removing another member, or a member leaving; an owner cannot remove themself | 204; owner self-removal returns 409 |
| POST | `/{family_id}/invitations` | `InvitationIn` | owner | `InvitationOut` (201) with the one-time link token |
| GET | `/{family_id}/invitations` | none | owner | `list[InvitationOut]` (no tokens) |

### Invitations (`/api/invitations`)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/accept` | `InvitationTokenIn` | `FamilyOut`; user's email must match the invitation |
| POST | `/decline` | `InvitationTokenIn` | 204 |

### Expenses (`/api/expenses`)
| Method | Path | Input | Who | Returns |
|---|---|---|---|---|
| GET | `/` | `ExpenseFilter` query | any user | `Page[ExpenseOut]`, only visible expenses |
| POST | `/` | `ExpenseIn` | any user; member if `family_id` set | `ExpenseOut` (201) |
| GET | `/{expense_id}` | none | can see it | `ExpenseOut` |
| PATCH | `/{expense_id}` | `ExpenseUpdateIn` | recorder | `ExpenseOut` |
| DELETE | `/{expense_id}` | none | recorder | 204 |

### Reports (`/api/reports`)
| Method | Path | Input | Returns |
|---|---|---|---|
| GET | `/summary` | `ReportFilter` query | totals grouped by currency, then by category or month |

## Validation (Pydantic v2)

Every request body, query parameter and path parameter has a declared type. Nothing is read from the raw request.

Base config for all input models:
```python
model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
```
`extra="forbid"` rejects unknown fields, so a client cannot set `user_id`, `role`, `id` or timestamps. Separate input (`...In`) and output (`...Out`) models ensure `password_hash` and token hashes are never returned.

Path parameters: `Annotated[int, Path(gt=0)]`.

Field rules:

| Field | Type / constraint |
|---|---|
| email | `EmailStr`, lowercased |
| password | `str`, 8 to 72 bytes (UTF-8) |
| display_name, family name | `str`, 1 to 100 chars |
| description | `str | None`, max 500 chars |
| amount | `Decimal`, `gt=0`, `max_digits=12`, `decimal_places=2` |
| currency | `str`, pattern `^[A-Z]{3}$` |
| spent_on, date_from, date_to | `date`; `date_from <= date_to` (model validator) |
| category_id, family_id | `int`, `gt=0` |
| invitation token | `str`, 20 to 100 chars, URL-safe characters only |
| role, status, scope, group_by, sort | `Literal[...]` or `StrEnum` |

Query models (FastAPI `Annotated[Model, Query()]`):
- `ExpenseFilter`: `scope` (`personal` / `family` / `all`), `family_id`, `category_id`, `date_from`, `date_to`, `sort` (`spent_on` / `-spent_on` / `amount` / `-amount`), `limit` (1 to 100, default 50), `offset` (>= 0).
- `ReportFilter`: `family_id` (omit to report only the authenticated user's personal expenses; provide a family ID to report that family's expenses, if the user is a member), `date_from`, `date_to`, `group_by` (`category` / `month`). Reports do not combine personal and family expenses.

Invalid input returns FastAPI's standard **422** response.

## SQL injection prevention

Relevant endpoints: everything that takes a path parameter or filter, above all `GET /api/expenses` and `GET /api/reports/summary`.

- All queries use the SQLAlchemy 2.0 ORM/Core `select()`, `insert()`, `update()` and `delete()` constructs. Values are always bound parameters.
- No `text()` with string formatting or f-strings. If `text()` is ever needed, values go through `bindparams`.
- Sort fields and `group_by` come from a fixed enum mapped to column objects in code. User input never becomes a column or SQL fragment.
- Typed parameters reject anything that is not an int, date or allowed literal before any query runs.
- There is no free-text search. If one is added, escape `%` and `_` and pass the value as a bound parameter.
- Tests: send injection payloads (for example `1 OR 1=1`, `'; DROP TABLE expenses;--`) to path and query parameters and confirm 422 and no data leak.

## Security settings

| Setting | Where | Value |
|---|---|---|
| Security headers | FastAPI middleware (API); CloudFront response headers policy (static files) | `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'` |
| API caching | FastAPI middleware | `Cache-Control: no-store` on all `/api` responses |
| CORS | none | Same origin; no `CORSMiddleware` |
| Trusted hosts | `TrustedHostMiddleware` | Allowed hosts from `Settings` |
| API docs | FastAPI app | `/docs`, `/redoc`, `/openapi.json` disabled in production (`docs_url=None` etc., controlled by `Settings`) |
| Rate limiting | API Gateway throttling | Stricter limits on `/api/auth/login` and `/api/auth/register` |
| Error responses | Exception handler | Unhandled errors return a generic 500 message; details go only to logs |
| Secrets | `Settings` / AWS Secrets Manager | `JWT_SECRET`, database URL; never logged |
| CSRF | Design | Access token is sent in a header, not a cookie; the refresh cookie is `SameSite=Strict` |
| Logging | App | Never log passwords, tokens or `Authorization` headers |

## Status codes

| Code | When |
|---|---|
| 200 / 201 / 204 | Success |
| 401 | Missing, invalid or expired access token; bad login |
| 403 | Authenticated but not allowed, for a resource the user can already see (for example a member trying to rename the family) |
| 404 | Not found, or not visible to this user |
| 409 | Conflict, such as an email already registered or an already-accepted invitation |
| 422 | Validation failed |
| 429 | Rate limited |
