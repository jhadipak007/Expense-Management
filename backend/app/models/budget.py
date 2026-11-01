from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Enum, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCDateTime, utcnow


class BudgetPeriod(StrEnum):
    weekly = "weekly"
    fortnightly = "fortnightly"
    monthly = "monthly"
    yearly = "yearly"


class Budget(Base):
    """A spending limit that repeats every period: personal, or for one family.

    `scope_key` names the scope and category ("u5:all", "f3:2") without nulls,
    so the unique constraint also catches duplicate personal or all-category budgets.
    """

    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("scope_key", "period", "currency"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("families.id", ondelete="RESTRICT"), index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT")
    )
    period: Mapped[BudgetPeriod] = mapped_column(
        Enum(BudgetPeriod, native_enum=False, create_constraint=True, name="period")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(
        String(3), ForeignKey("currencies.code", ondelete="RESTRICT")
    )
    anchor_date: Mapped[date]
    scope_key: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
