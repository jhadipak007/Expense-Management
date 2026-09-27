from datetime import datetime

from sqlalchemy import ForeignKey, String, and_
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow


class RefreshToken(Base):
    """One issued refresh token, stored only as a SHA-256 hash."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")  # noqa: F821

    @hybrid_property
    def is_active(self) -> bool:
        """Not revoked and not expired."""
        return self.revoked_at is None and self.expires_at > utcnow()

    @is_active.inplace.expression
    @classmethod
    def _is_active_expression(cls):
        return and_(cls.revoked_at.is_(None), cls.expires_at > utcnow())
