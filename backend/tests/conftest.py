"""Shared fixtures. Test settings are set before any app module is imported."""

import os
import tempfile
from pathlib import Path

TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="expense_sarathi_test_"))

# SQLite unless the release check sets USE_POSTGRESQL_DB=true explicitly (a value in .env is ignored).
os.environ.setdefault("USE_POSTGRESQL_DB", "false")
os.environ.update(
    ENVIRONMENT="test",
    JWT_SECRET="test-secret-that-is-long-enough-for-hs256",
    SQLITE_PATH=str(TEST_DB_DIR / "test.db"),
    COOKIE_SECURE="false",
    ALLOWED_HOSTS='["testserver"]',
    ENABLE_API_DOCS="true",
    FRONTEND_DIST_DIR=str(TEST_DB_DIR / "no-frontend"),
)

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import engine as app_engine  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Family, FamilyMember, FamilyRole, User  # noqa: E402
from app.security import create_access_token, hash_password  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_PASSWORD = "P@ssw0rd"


def alembic_config() -> Config:
    return Config(str(BACKEND_DIR / "alembic.ini"))


@pytest.fixture(scope="session")
def engine():
    """The app engine, with the schema built by running every migration."""
    command.upgrade(alembic_config(), "head")
    yield app_engine
    command.downgrade(alembic_config(), "base")


@pytest.fixture
def db(engine):
    """A session whose commits become savepoints; everything is rolled back after the test."""
    with engine.connect() as connection, connection.begin() as transaction:
        session = Session(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        yield session
        session.close()
        transaction.rollback()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db):
    def _make_user(email="priya@example.com", password=DEFAULT_PASSWORD,
                   display_name="Priya", is_active=True) -> User:
        user = User(email=email, password_hash=hash_password(password),
                    display_name=display_name, is_active=is_active)
        db.add(user)
        db.commit()
        return user
    return _make_user


@pytest.fixture
def make_family(db):
    """Create a family owned by `owner`, with `members` added as plain members."""
    def _make_family(owner: User, name="Jha Household", members=()) -> Family:
        family = Family(name=name, created_by=owner.id)
        family.members = [FamilyMember(user_id=owner.id, role=FamilyRole.owner)]
        family.members += [FamilyMember(user_id=m.id, role=FamilyRole.member) for m in members]
        db.add(family)
        db.commit()
        return family
    return _make_family


@pytest.fixture
def auth_headers():
    def _auth_headers(user: User) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(user.id)}"}
    return _auth_headers
