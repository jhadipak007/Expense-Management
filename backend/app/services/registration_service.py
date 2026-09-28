"""Sign-up with OTP: store a pending registration, check its code, create the user.

`_expected_code` is the only place that knows the code is fixed; when codes
are emailed, only it and `start_registration` change.
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import PendingRegistration, User
from app.models.base import utcnow
from app.security import hash_password, hash_token, new_token


class EmailAlreadyRegistered(Exception):
    """A user already has this email."""


class RegistrationNotFound(Exception):
    """The registration is unknown, expired or out of attempts."""


class IncorrectCode(Exception):
    """The code is wrong; attempts remain."""


def start_registration(db: Session, display_name: str, email: str, password: str) -> str:
    """Store a pending registration and return its raw registration id."""
    password_hash = hash_password(password)  # before any query: don't hold the write lock during bcrypt
    if _email_taken(db, email):
        raise EmailAlreadyRegistered
    raw = new_token()
    expires_at = utcnow() + timedelta(minutes=get_settings().registration_minutes)
    db.add(PendingRegistration(
        token_hash=hash_token(raw), email=email, display_name=display_name,
        password_hash=password_hash, expires_at=expires_at,
    ))
    db.commit()
    return raw


def verify_registration(db: Session, registration_id: str, code: str) -> User:
    """Check the code and create the user. The last allowed wrong code deletes the registration."""
    pending = _find_pending(db, registration_id)
    if pending is None:
        raise RegistrationNotFound
    if code != _expected_code(pending):
        pending.attempts += 1
        out_of_attempts = pending.attempts >= get_settings().registration_max_attempts
        if out_of_attempts:
            db.delete(pending)
        db.commit()
        raise RegistrationNotFound if out_of_attempts else IncorrectCode
    if _email_taken(db, pending.email):
        db.delete(pending)
        db.commit()
        raise EmailAlreadyRegistered
    user = User(email=pending.email, display_name=pending.display_name,
                password_hash=pending.password_hash)
    db.add(user)
    db.delete(pending)
    db.commit()
    return user


def _email_taken(db: Session, email: str) -> bool:
    return db.scalar(select(User.id).where(User.email == email)) is not None


def _find_pending(db: Session, registration_id: str) -> PendingRegistration | None:
    pending = db.scalar(select(PendingRegistration)
                        .where(PendingRegistration.token_hash == hash_token(registration_id)))
    if pending is None or pending.expires_at <= utcnow():
        return None
    return pending


def _expected_code(pending: PendingRegistration) -> str:
    return get_settings().registration_otp
