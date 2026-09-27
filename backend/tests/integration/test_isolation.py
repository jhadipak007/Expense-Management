"""Guards the database setup: tests are isolated and SQLite enforces foreign keys."""

from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import RefreshToken, User
from app.models.base import utcnow


def test_first_test_commits_a_user(db, make_user):
    make_user(email="leak@example.com")
    assert db.scalar(select(func.count()).select_from(User)) == 1


def test_second_test_sees_no_users(db):
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_sqlite_enforces_foreign_keys(db):
    db.add(RefreshToken(user_id=999, token_hash="x" * 64, expires_at=utcnow() + timedelta(minutes=1)))
    with pytest.raises(IntegrityError):
        db.flush()
