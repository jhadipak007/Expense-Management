from datetime import datetime
from enum import StrEnum

from sqlalchemy import Enum, ForeignKey, and_
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow


class InvitationStatus(StrEnum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    cancelled = "cancelled"


class FamilyInvitation(Base):
    """An invitation for an existing user to join a family.

    Expiry is not stored as a status: a pending invitation past `expires_at`
    is simply no longer open.
    """

    __tablename__ = "family_invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    invitee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    invited_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus, native_enum=False, create_constraint=True, name="status"),
        default=InvitationStatus.pending,
    )
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    family: Mapped["Family"] = relationship(back_populates="invitations")  # noqa: F821
    invitee: Mapped["User"] = relationship(foreign_keys=[invitee_id])  # noqa: F821
    inviter: Mapped["User"] = relationship(foreign_keys=[invited_by])  # noqa: F821

    @hybrid_property
    def is_open(self) -> bool:
        """Pending and not expired, so it can still be accepted, declined or cancelled."""
        return self.status == InvitationStatus.pending and self.expires_at > utcnow()

    @is_open.inplace.expression
    @classmethod
    def _is_open_expression(cls):
        return and_(cls.status == InvitationStatus.pending, cls.expires_at > utcnow())
