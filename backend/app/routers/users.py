from fastapi import APIRouter, Depends

from app.deps import CurrentUser, get_current_user
from app.schemas.user import UserOut

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(get_current_user)])


@router.get("/me")
def read_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
