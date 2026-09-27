"""Create the local test user. Runs only when ENVIRONMENT is local or test.

Usage: uv run python -m app.seed
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import User
from app.security import hash_password

TEST_USER_EMAIL = "test@gmail.com"
TEST_USER_PASSWORD = "P@ssw0rd"
TEST_USER_NAME = "Test User"


def seed_test_user(db: Session) -> bool:
    """Add the test user if missing. Return True if it was created."""
    if db.scalar(select(User).where(User.email == TEST_USER_EMAIL)):
        return False
    db.add(User(email=TEST_USER_EMAIL, password_hash=hash_password(TEST_USER_PASSWORD),
                display_name=TEST_USER_NAME))
    db.commit()
    return True


def main() -> None:
    environment = get_settings().environment
    if environment not in ("local", "test"):
        print(f"Seed skipped: ENVIRONMENT is {environment}")
        return
    with SessionLocal() as db:
        created = seed_test_user(db)
    print(f"Test user {TEST_USER_EMAIL} {'created' if created else 'already exists'}")


if __name__ == "__main__":
    main()
