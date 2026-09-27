"""Login and refresh-token lifecycle: issue, rotate, revoke."""

from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import RefreshToken, User
from app.models.base import utcnow
from app.security import hash_password, hash_token, new_refresh_token, verify_password

DUMMY_PASSWORD_HASH = hash_password("not-a-real-password")


class InvalidRefreshToken(Exception):
    """The refresh token is unknown, expired or already used."""


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Return the active user matching these credentials, or None.

    The password is always checked, against a dummy hash when there is no
    user, so response time does not reveal which emails have accounts.
    """
    user = db.scalar(select(User).where(User.email == email.lower()))
    db.commit()  # end the read transaction; don't hold database locks during the slow bcrypt check
    password_ok = verify_password(password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if user is None or not user.is_active or not password_ok:
        return None
    return user


def issue_refresh_token(db: Session, user_id: int) -> str:
    """Store a new refresh token that expires after the idle window; return the raw token."""
    raw = new_refresh_token()
    idle = timedelta(minutes=get_settings().refresh_token_idle_minutes)
    db.add(RefreshToken(user_id=user_id, token_hash=hash_token(raw), expires_at=utcnow() + idle))
    db.commit()
    return raw


def rotate_refresh_token(db: Session, raw: str) -> tuple[User, str]:
    """Consume a refresh token and issue a new one.

    The conditional UPDATE is an atomic compare-and-swap on SQLite and
    PostgreSQL, so only one request can consume a token. Presenting a token
    that was already revoked is treated as reuse and revokes every token the
    user holds.
    """
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    if token is None:
        raise InvalidRefreshToken
    consumed = db.execute(
        update(RefreshToken)
        .where(RefreshToken.id == token.id, RefreshToken.is_active)
        .values(revoked_at=utcnow())
    ).rowcount
    db.commit()
    if not consumed:
        db.refresh(token)
        if token.revoked_at is not None:
            revoke_all_refresh_tokens(db, token.user_id)
        raise InvalidRefreshToken
    user = db.get(User, token.user_id)
    if not user.is_active:
        raise InvalidRefreshToken
    return user, issue_refresh_token(db, user.id)


def revoke_refresh_token(db: Session, raw: str) -> None:
    """Revoke this token if it is still active; otherwise do nothing."""
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw), RefreshToken.is_active)
        .values(revoked_at=utcnow())
    )
    db.commit()


def revoke_all_refresh_tokens(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    db.commit()
