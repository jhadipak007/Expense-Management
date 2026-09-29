"""Category routes: the fixed list of expense categories."""

from fastapi import APIRouter, Depends

from app.deps import DbSession, get_current_user
from app.schemas.expense import CategoryOut
from app.services import expense_service

router = APIRouter(prefix="/api/categories", tags=["categories"],
                   dependencies=[Depends(get_current_user)])


@router.get("")
def list_categories(db: DbSession) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in expense_service.list_categories(db)]
