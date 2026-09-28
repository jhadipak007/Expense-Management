from datetime import datetime
from enum import StrEnum

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow


class FamilyRole(StrEnum):
    owner = "owner"
    member = "member"


class FamilyMember(Base):
    """A user's membership of a family, with their role in it."""

    __tablename__ = "family_members"

    family_id: Mapped[int] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[FamilyRole] = mapped_column(
        Enum(FamilyRole, native_enum=False, create_constraint=True, name="role")
    )
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    family: Mapped["Family"] = relationship(back_populates="members")  # noqa: F821
    user: Mapped["User"] = relationship(back_populates="memberships")  # noqa: F821
