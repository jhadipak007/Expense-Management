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
| expires_at | datetime | 30 minutes after issue; rotation issues a new row with a new 30-minute window (idle timeout) |
| revoked_at | datetime, nullable | set on refresh (rotation) or logout |
| created_at | datetime | UTC |

**pending_registrations**: a sign-up waiting for its OTP. The `users` row is created only when the OTP is verified; the pending row is then deleted. See [authentication.md](authentication.md).

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| token_hash | string, unique | SHA-256 of the registration id returned to the client |
| email | string | lowercase; not unique, so an abandoned sign-up does not block the email |
| display_name | string | |
| password_hash | string | bcrypt, copied to `users` on success |
| attempts | integer | wrong codes so far; the row is deleted at the limit (5) |
| expires_at | datetime | 10 minutes after sign-up starts |
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
| family_id | FK families.id | composite PK with user_id; `ON DELETE CASCADE` |
| user_id | FK users.id | indexed; `ON DELETE CASCADE` |
| role | string + CHECK | `owner` or `member` |
| joined_at | datetime | |

**family_invitations**: invitations for existing users to join a family. They appear on the invitee's dashboard; no email is sent.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| family_id | FK families.id | indexed |
| invitee_id | FK users.id | indexed; only registered users can be invited |
| invited_by | FK users.id | the owner who sent it |
| status | string + CHECK | `pending`, `accepted`, `declined`, `cancelled` |
| expires_at | datetime | 7 days after `created_at` (`INVITATION_DAYS`) |
| created_at | datetime | the date sent |

Expiry is not stored as a status. An invitation is **open** while it is `pending` and `expires_at` is in the future; only open invitations are listed, accepted, declined or cancelled. A user has at most one open invitation per family, and can be invited again once the previous one is declined, cancelled or expired. Status changes are one conditional `UPDATE ... WHERE status = 'pending' AND expires_at > now`, so a cancel and an accept cannot both succeed.

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
- Only members see a family and its member list (name, email, role). Only a family `owner` can search for users, invite, cancel invitations, remove other members or rename the family. A member may leave; an owner may not leave or remove themself. This ensures every family always has at least one owner. Ownership transfer is not supported by the current API.
- Reports are scoped either to the authenticated user's personal expenses (no `family_id`) or to one specified family (member access required); they do not combine personal and family expenses. Totals are grouped by `currency` (and by category or month), with no conversion.
- Indexes: `expenses(user_id, spent_on)`, `expenses(family_id, spent_on)`, `family_members(user_id)`.
