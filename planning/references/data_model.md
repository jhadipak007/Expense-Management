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
| month_start_day | integer, default 1 | 1 to 28 (checked by the API); the day monthly budget periods and the dashboard's This month / Last month start; changing it never changes stored expenses or budgets |
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

**currencies**: lookup table, seeded with the 155 national currencies of ISO 4217 List One (published 2026-09-17). Metals, bond units, the testing and "no currency" codes, and fund codes are left out.

| Column | Type | Notes |
|---|---|---|
| code | string(3) PK | ISO 4217 code, e.g. `AUD` |
| name | string | ISO name, e.g. "Australian Dollar" |

Changes to the ISO list are applied by a new migration. Removing a code fails while expenses still use it.

**expenses**

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| user_id | FK users.id | who recorded it |
| family_id | FK families.id, nullable | null = personal; set = shared with that family |
| category_id | FK categories.id | |
| amount | Numeric(12, 2) | positive |
| currency | FK currencies.code | e.g. `INR`, `USD`; `RESTRICT` |
| spent_on | date | date of the expense |
| description | string, nullable | |
| created_at, updated_at | datetime | UTC |

## Budgets

**budgets**: a spending limit that repeats every period, personal or for one family.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| user_id | FK users.id | creator; owns a personal budget; indexed |
| family_id | FK families.id, nullable | null = personal; set = that family's budget; indexed |
| category_id | FK categories.id, nullable | null = all categories |
| period | string + CHECK | `weekly`, `fortnightly`, `monthly`, `yearly` |
| amount | Numeric(12, 2) | the limit for each period, positive |
| currency | FK currencies.code | only expenses in this currency count; no conversion |
| anchor_date | date | first day of the first fortnight: the creation day, or the day the period was changed to fortnightly |
| scope_key | string | `u<user_id>` or `f<family_id>`, then `:<category_id>` or `:all`; no nulls, so the unique constraint works |
| created_at, updated_at | datetime | UTC |

Unique: `(scope_key, period, currency)`, so a scope has one budget per category, period and currency. All foreign keys are `RESTRICT`.

Periods are computed, never stored, from the user's local date:
- Weekly: Monday to Sunday.
- Fortnightly: 14-day steps from `anchor_date`.
- Monthly: from `month_start_day` to the day before it next month. A personal budget uses its creator's day; a family budget uses the family owner's day, so every member sees the same period.
- Yearly: 1 January to 31 December.

Spent = the sum of expenses in the current period with the same scope (personal: the creator's personal expenses; family: every member's expenses shared with the family), the same currency, and the same category unless the budget covers all. Status: `on_track` below 80%, `close` from 80% to 100%, `over` above 100%.

## Access rules
- A user sees an expense if they recorded it and `family_id` is null, or if they are a member of its `family_id`.
- Any family member can add expenses to that family. Only the recorder can edit or delete an expense.
- Only members see a family and its member list (name, email, role). Only a family `owner` can search for users, invite, cancel invitations, remove other members or rename the family. A member may leave; an owner may not leave or remove themself. This ensures every family always has at least one owner. Ownership transfer is not supported by the current API.
- A personal budget is seen and managed by its creator only. A family budget is seen by every member; only the family owner creates, changes or deletes it.
- Reports are scoped either to the authenticated user's personal expenses (no `family_id`) or to one specified family (member access required); they do not combine personal and family expenses. Totals are grouped by `currency` (and by category or month), with no conversion.
- Indexes: `expenses(user_id, spent_on)`, `expenses(family_id, spent_on)`, `family_members(user_id)`.
