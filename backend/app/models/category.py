from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Category(Base):
    """An expense category, seeded by migration: Grocery, Eating Out, Trips."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    color: Mapped[str] = mapped_column(String(7))

    expenses: Mapped[list["Expense"]] = relationship(back_populates="category")  # noqa: F821
