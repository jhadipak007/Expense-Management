from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Numeric, String
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow


class Expense(Base):
    """An expense recorded by a user: personal, or shared with one family."""

    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_user_id_spent_on", "user_id", "spent_on"),
        Index("ix_expenses_family_id_spent_on", "family_id", "spent_on"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    family_id: Mapped[int | None] = mapped_column(ForeignKey("families.id", ondelete="RESTRICT"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(
        String(3), ForeignKey("currencies.code", ondelete="RESTRICT")
    )
    spent_on: Mapped[date]
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    """Set while the expense is deleted; it stays for the audit log."""

    user: Mapped["User"] = relationship(back_populates="expenses")  # noqa: F821
    family: Mapped["Family | None"] = relationship(back_populates="expenses")  # noqa: F821
    category: Mapped["Category"] = relationship(back_populates="expenses")  # noqa: F821
    history: Mapped[list["ExpenseAudit"]] = relationship(  # noqa: F821
        back_populates="expense", order_by="ExpenseAudit.id"
    )

    category_name: AssociationProxy[str] = association_proxy("category", "name")

    @hybrid_property
    def is_personal(self) -> bool:
        """Not shared with a family, so only the recorder sees it."""
        return self.family_id is None

    @is_personal.inplace.expression
    @classmethod
    def _is_personal_expression(cls):
        return cls.family_id.is_(None)

    @hybrid_property
    def is_active(self) -> bool:
        """Not deleted, so it counts in lists, reports and budgets."""
        return self.deleted_at is None

    @is_active.inplace.expression
    @classmethod
    def _is_active_expression(cls):
        return cls.deleted_at.is_(None)
