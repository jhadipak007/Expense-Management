"""Password hashing, access-token JWTs and refresh-token helpers."""

import hashlib
import secrets
from datetime import timedelta

import bcrypt
import jwt

from app.config import get_settings
from app.models.base import utcnow

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Check a password; passwords over bcrypt's 72-byte limit never match."""
    encoded = password.encode()
    if len(encoded) > 72:
        return False
    return bcrypt.checkpw(encoded, password_hash.encode())


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = utcnow()
    claims = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Return the user id from a valid access token, or None."""
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat", "type"]},
        )
    except jwt.InvalidTokenError:
        return None
    if claims["type"] != "access":
        return None
    return int(claims["sub"])


def new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
