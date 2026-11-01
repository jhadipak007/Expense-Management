"""The signed-in user's own settings."""

import logging

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user import UserSettingsIn

logger = logging.getLogger(__name__)


def update_settings(db: Session, user: User, data: UserSettingsIn) -> User:
    """Save the settings. Monthly budgets use the new start day from the next read."""
    user.month_start_day = data.month_start_day
    db.commit()
    logger.info("user settings updated", extra={"user_id": user.id})
    return user
