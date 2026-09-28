from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow


class Family(Base):
    """A group of users who share expenses."""

    __tablename__ = "families"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    members: Mapped[list["FamilyMember"]] = relationship(  # noqa: F821
        back_populates="family", cascade="all, delete-orphan"
    )
    invitations: Mapped[list["FamilyInvitation"]] = relationship(  # noqa: F821
        back_populates="family", cascade="all, delete-orphan"
    )
