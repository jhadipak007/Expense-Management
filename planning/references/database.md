# Expense Sarathi - Database and Migrations

How the tables in [data_model.md](data_model.md) are mapped with the SQLAlchemy ORM and changed with Alembic.

## ORM

- SQLAlchemy 2.0 typed declarative style: `DeclarativeBase`, `Mapped[...]`, `mapped_column()`.
- All data access goes through the ORM (`select()`, `insert()`, `update()`, `delete()`). No raw SQL strings.
- Sync `Session` from `sessionmaker`; one session per request through a `get_db` FastAPI dependency.
- The base uses `MetaData(naming_convention=...)` so constraints get stable names. Alembic needs this, especially on SQLite.
- Dialect-neutral types only: `String(n)`, `Numeric(12, 2)`, `Date`, `UTCDateTime`, `Boolean`, and `Enum(StrEnum, native_enum=False, create_constraint=True)` (VARCHAR plus CHECK) for `role` and `status`. Migrations write these as `sa.String(n)` plus one named `sa.CheckConstraint`, because autogenerate emits the CHECK twice.
- `UTCDateTime` (in `app/models/base.py`) wraps `DateTime(timezone=True)`. SQLite drops the timezone, which makes values come back naive and makes non-UTC values compare wrongly, so the type stores UTC and returns aware datetimes. Migrations use plain `sa.DateTime(timezone=True)`.
- Timestamps are set in Python (`datetime.now(UTC)`), not by database-specific defaults.
- SQLite-only engine setup (`app/db.py`), applied in `connect` and `begin` events:
  - `PRAGMA foreign_keys=ON`, since SQLite does not enforce foreign keys by default.
  - SQLAlchemy emits `BEGIN IMMEDIATE` itself (the driver's own transaction handling is turned off). This gives real savepoints, so each test can be rolled back, and it makes concurrent writers wait instead of failing with "database is locked".

## Relationships

Every relationship is declared on both sides with `back_populates`.

| Model | Relationship | Target | Notes |
|---|---|---|---|
| User | `expenses` | Expense | |
| User | `memberships` | FamilyMember | |
| User | `families` | Family | `association_proxy("memberships", "family")` |
| User | `refresh_tokens` | RefreshToken | `cascade="all, delete-orphan"` |
| Family | `members` | FamilyMember | `cascade="all, delete-orphan"` |
| Family | `invitations` | FamilyInvitation | `cascade="all, delete-orphan"` |
| Family | `expenses` | Expense | |
| FamilyMember | `user`, `family` | User, Family | |
| FamilyInvitation | `family`, `invitee`, `inviter` | Family, User | `invitee` uses `invitee_id`, `inviter` uses `invited_by`; one-way (no collections on User) |
| Category | `expenses` | Expense | |
| Expense | `user`, `family`, `category` | User, Family, Category | `family` is optional (personal expense) |
| RefreshToken | `user` | User | |

- Foreign key `ondelete`: `CASCADE` for `family_members`, `family_invitations` and `refresh_tokens`; `RESTRICT` for all `expenses` foreign keys.
- Avoid N+1 queries: list queries load related rows explicitly with `selectinload()` or `joinedload()`.

## Derived fields on models

| Model | Field | Kind | Meaning |
|---|---|---|---|
| Expense | `is_personal` | `hybrid_property` | `family_id` is null; also usable in queries |
| Expense | `category_name` | `association_proxy` | the category's name |
| Family | `member_count` | `column_property` (scalar subquery) | number of members |
| FamilyInvitation | `is_open` | `hybrid_property` | `pending` and not expired; also used in queries and conditional updates |
| RefreshToken | `is_active` | `hybrid_property` | not revoked and not expired |

## Derived fields on response schemas

- Pydantic output models use `ConfigDict(from_attributes=True)` and are built directly from ORM objects.
- Relationships become nested models: `ExpenseOut.category: CategoryOut`, `FamilyOut.members: list[MemberOut]`.
- `@computed_field` adds display values:
  - `ExpenseOut.month`: `"YYYY-MM"` from `spent_on`, for grouping in the UI
  - `ExpenseOut.recorded_by`: the recorder's display name
  - `FamilyOut.member_count`: from the model's `member_count`

## Migrations (Alembic)

- `alembic/env.py` reads the database URL from `Settings` and uses `Base.metadata` as `target_metadata`.
- `render_as_batch=True`, so ALTER operations work on SQLite.
- Create migrations with `uv run alembic revision --autogenerate -m "<message>"`. Review every generated file before committing.
- Every migration has a working `downgrade()`.
- A data migration seeds the categories: Grocery, Eating Out and Trips, with their colors.
- Local: the container runs `alembic upgrade head` before starting uvicorn.
- Production: migrations run as a one-off ECS Fargate task during each release (see [aws_deployment.md](aws_deployment.md), section 7).
- Tests build the schema with `alembic upgrade head`, so migrations are tested too.
