"""Budget routes: create, view, change and delete spending limits."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.deps import CurrentUser, DbSession, get_current_user
from app.routers.errors import lookup_errors
from app.schemas.budget import BudgetIn, BudgetOut, BudgetUpdateIn, TodayQuery
from app.services import budget_service
from app.services.budget_service import BudgetNotFound, DuplicateBudget
from app.services.family_access import NotFamilyOwner

router = APIRouter(prefix="/api/budgets", tags=["budgets"],
                   dependencies=[Depends(get_current_user)])

BudgetId = Annotated[int, Path(gt=0)]
Today = Annotated[TodayQuery, Query()]


@contextmanager
def budget_errors() -> Iterator[None]:
    """Map budget failures; unknown category, currency or family are handled like expenses."""
    try:
        with lookup_errors():
            yield
    except BudgetNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Budget not found")
    except NotFamilyOwner:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only the family owner can manage family budgets")
    except DuplicateBudget:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A budget for this scope, category, period and currency already exists",
        )


@router.get("")
def list_budgets(query: Today, user: CurrentUser, db: DbSession) -> list[BudgetOut]:
    """The user's personal budgets and their families' budgets, each in its current period."""
    return budget_service.list_budgets(db, user.id, query.today)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_budget(body: BudgetIn, query: Today, user: CurrentUser, db: DbSession) -> BudgetOut:
    with budget_errors():
        return budget_service.create_budget(db, user.id, body, query.today)


@router.get("/{budget_id}")
def get_budget(budget_id: BudgetId, query: Today, user: CurrentUser,
               db: DbSession) -> BudgetOut:
    with budget_errors():
        return budget_service.get_budget(db, budget_id, user.id, query.today)


@router.patch("/{budget_id}")
def update_budget(budget_id: BudgetId, body: BudgetUpdateIn, query: Today,
                  user: CurrentUser, db: DbSession) -> BudgetOut:
    with budget_errors():
        return budget_service.update_budget(db, budget_id, user.id, body, query.today)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: BudgetId, user: CurrentUser, db: DbSession) -> None:
    with budget_errors():
        budget_service.delete_budget(db, budget_id, user.id)
