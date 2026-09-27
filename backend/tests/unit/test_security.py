from datetime import timedelta

import jwt

from app.config import get_settings
from app.models.base import utcnow
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_token,
    verify_password,
)


def _encode(claims: dict, secret: str | None = None) -> str:
    secret = secret or get_settings().jwt_secret.get_secret_value()
    return jwt.encode(claims, secret, algorithm="HS256")


def test_hashed_password_verifies():
    assert verify_password("P@ssw0rd", hash_password("P@ssw0rd"))


def test_wrong_password_does_not_verify():
    assert not verify_password("wrong-pass", hash_password("P@ssw0rd"))


def test_password_over_72_bytes_does_not_verify():
    long_password = "a" * 73
    assert not verify_password(long_password, hash_password("a" * 72))


def test_access_token_round_trip_returns_user_id():
    assert decode_access_token(create_access_token(42)) == 42


def test_access_token_carries_type_and_expiry():
    claims = jwt.decode(
        create_access_token(7),
        get_settings().jwt_secret.get_secret_value(),
        algorithms=["HS256"],
    )
    assert claims["type"] == "access"
    assert claims["exp"] - claims["iat"] == 10 * 60


def test_expired_access_token_is_rejected():
    now = utcnow()
    token = _encode({"sub": "1", "type": "access", "iat": now - timedelta(minutes=20),
                     "exp": now - timedelta(minutes=10)})
    assert decode_access_token(token) is None


def test_tampered_access_token_is_rejected():
    token = create_access_token(1)
    assert decode_access_token(token[:-2] + "xx") is None


def test_token_signed_with_other_secret_is_rejected():
    now = utcnow()
    token = _encode({"sub": "1", "type": "access", "iat": now, "exp": now + timedelta(minutes=5)},
                    secret="another-secret-that-is-long-enough-too")
    assert decode_access_token(token) is None


def test_wrong_type_token_is_rejected():
    now = utcnow()
    token = _encode({"sub": "1", "type": "refresh", "iat": now, "exp": now + timedelta(minutes=5)})
    assert decode_access_token(token) is None


def test_hash_token_is_stable_sha256_hex():
    assert hash_token("abc") == hash_token("abc")
    assert len(hash_token("abc")) == 64
