"""Expense routes: record an expense and view one you can see."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.deps import CurrentUser, DbSession, get_current_user
from app.schemas.expense import ExpenseIn, ExpenseOut
from app.services import expense_service
from app.services.expense_service import ExpenseNotFound, UnknownCategory
from app.services.family_access import FamilyNotFound

router = APIRouter(prefix="/api/expenses", tags=["expenses"],
                   dependencies=[Depends(get_current_user)])

ExpenseId = Annotated[int, Path(gt=0)]


@contextmanager
def expense_errors() -> Iterator[None]:
    """Map service failures; an unknown category is reported like any invalid field."""
    try:
        yield
    except UnknownCategory:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, [
            {"loc": ["body", "category_id"], "msg": "Unknown category", "type": "value_error"},
        ])
    except FamilyNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family not found")
    except ExpenseNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")


@router.post("", status_code=status.HTTP_201_CREATED)
def create_expense(body: ExpenseIn, user: CurrentUser, db: DbSession) -> ExpenseOut:
    with expense_errors():
        expense = expense_service.create_expense(db, user.id, body)
    return ExpenseOut.model_validate(expense)


@router.get("/{expense_id}")
def get_expense(expense_id: ExpenseId, user: CurrentUser, db: DbSession) -> ExpenseOut:
    with expense_errors():
        expense = expense_service.get_expense(db, expense_id, user.id)
    return ExpenseOut.model_validate(expense)
