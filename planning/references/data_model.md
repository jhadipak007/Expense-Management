# Expense Sarathi - Data Model

High-level data model. All tables are dialect-neutral (SQLite locally, PostgreSQL in production) and managed with Alembic migrations.

ORM mapping, relationships and migrations: see [database.md](database.md).

## User management

**users**: one row per login account.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| email | string, unique | login name, stored lowercase |
| password_hash | string | never the plain password |
| display_name | string | |
| is_active | boolean | deactivated users cannot log in |
| created_at, updated_at | datetime | UTC |

**refresh_tokens**: one row per issued refresh token. See [authentication.md](authentication.md).

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| user_id | FK users.id | indexed |
| token_hash | string, unique | SHA-256 of the token; the raw token is never stored |
| expires_at | datetime | 7 days after issue |
| revoked_at | datetime, nullable | set on refresh (rotation) or logout |
| created_at | datetime | UTC |

**families**: a group that shares expenses.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| name | string | e.g. "Jha Household" |
| created_by | FK users.id | |
| created_at | datetime | |

**family_members**: which users are in which families (many-to-many).

| Column | Type | Notes |
|---|---|---|
| family_id | FK families.id | composite PK with user_id |
| user_id | FK users.id | |
| role | string | `owner` or `member` |
| joined_at | datetime | |

**family_invitations**: pending invites to join a family.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| family_id | FK families.id | |
| email | string | invitee; may not have an account yet |
| invited_by | FK users.id | |
| token_hash | string, unique | hash of the invite link token |
| status | string | `pending`, `accepted`, `declined`, `expired` |
| expires_at | datetime | |
| created_at | datetime | |

## Expenses

**categories**: lookup table, seeded with Grocery, Eating Out, Trips.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| name | string, unique | |
| color | string | hex color from the [color scheme](frontend.md#color-scheme) |

**expenses**

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| user_id | FK users.id | who recorded it |
| family_id | FK families.id, nullable | null = personal; set = shared with that family |
| category_id | FK categories.id | |
| amount | Numeric(12, 2) | positive |
| currency | string(3) | ISO 4217 code, e.g. `INR`, `USD` |
| spent_on | date | date of the expense |
| description | string, nullable | |
| created_at, updated_at | datetime | UTC |

## Access rules
- A user sees an expense if they recorded it and `family_id` is null, or if they are a member of its `family_id`.
- Any family member can add expenses to that family. Only the recorder can edit or delete an expense.
- Only a family `owner` can invite, remove other members or rename the family. A member may leave; an owner may not leave or remove themself. This ensures every family always has at least one owner. Ownership transfer is not supported by the current API.
- Reports are scoped either to the authenticated user's personal expenses (no `family_id`) or to one specified family (member access required); they do not combine personal and family expenses. Totals are grouped by `currency` (and by category or month), with no conversion.
- Indexes: `expenses(user_id, spent_on)`, `expenses(family_id, spent_on)`, `family_members(user_id)`.
