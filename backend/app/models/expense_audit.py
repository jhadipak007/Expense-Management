from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow


class AuditAction(StrEnum):
    created = "created"
    updated = "updated"
    deleted = "deleted"
    restored = "restored"


class ExpenseAudit(Base):
    """One action on an expense. Written by the services only, never changed or deleted."""

    __tablename__ = "expense_audit"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_id: Mapped[int] = mapped_column(
        ForeignKey("expenses.id", ondelete="RESTRICT"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction, native_enum=False, create_constraint=True, name="action")
    )
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    """For updates: {field: [old, new]} with display-ready values; null otherwise."""
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    expense: Mapped["Expense"] = relationship(back_populates="history")  # noqa: F821
    user: Mapped["User"] = relationship(back_populates="audit_entries")  # noqa: F821
