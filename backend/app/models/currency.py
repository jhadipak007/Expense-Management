from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Currency(Base):
    """An ISO 4217 currency, seeded by migration with the everyday national currencies."""

    __tablename__ = "currencies"

    code: Mapped[str] = mapped_column(String(3), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))

    expenses: Mapped[list["Expense"]] = relationship(back_populates="currency_ref")  # noqa: F821
