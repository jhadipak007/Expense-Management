"""Currency routes: the ISO 4217 currencies an expense can be recorded in."""

from fastapi import APIRouter, Depends

from app.deps import DbSession, get_current_user
from app.schemas.expense import CurrencyOut
from app.services import expense_service

router = APIRouter(prefix="/api/currencies", tags=["currencies"],
                   dependencies=[Depends(get_current_user)])


@router.get("")
def list_currencies(db: DbSession) -> list[CurrencyOut]:
    """All currencies, sorted by code."""
    return [CurrencyOut.model_validate(c) for c in expense_service.list_currencies(db)]
