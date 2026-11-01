from fastapi import APIRouter, Depends

from app.deps import CurrentUser, DbSession, get_current_user
from app.schemas.user import UserOut, UserSettingsIn
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(get_current_user)])


@router.get("/me")
def read_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me")
def update_me(body: UserSettingsIn, user: CurrentUser, db: DbSession) -> UserOut:
    """Change the user's settings (the month start day for monthly budgets)."""
    return UserOut.model_validate(user_service.update_settings(db, user, body))
