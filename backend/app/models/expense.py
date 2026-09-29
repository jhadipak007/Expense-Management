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
    currency: Mapped[str] = mapped_column(String(3))
    spent_on: Mapped[date]
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="expenses")  # noqa: F821
    family: Mapped["Family | None"] = relationship(back_populates="expenses")  # noqa: F821
    category: Mapped["Category"] = relationship(back_populates="expenses")  # noqa: F821

    category_name: AssociationProxy[str] = association_proxy("category", "name")

    @hybrid_property
    def is_personal(self) -> bool:
        """Not shared with a family, so only the recorder sees it."""
        return self.family_id is None

    @is_personal.inplace.expression
    @classmethod
    def _is_personal_expression(cls):
        return cls.family_id.is_(None)
