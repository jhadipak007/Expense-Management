"""Expense routes: record, view, edit, delete and restore expenses."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.deps import CurrentUser, DbSession, get_current_user
from app.routers.errors import lookup_errors
from app.schemas.expense import ExpenseIn, ExpenseOut, ExpenseUpdateIn
from app.schemas.page import Page
from app.schemas.transaction import (
    AuditFilter, AuditLogEntryOut, TransactionDetailOut, TransactionFilter, TransactionOut,
)
from app.services import expense_service, transaction_service
from app.services.expense_service import ExpenseNotFound, ExpenseStateConflict, NotRecorder

router = APIRouter(prefix="/api/expenses", tags=["expenses"],
                   dependencies=[Depends(get_current_user)])

ExpenseId = Annotated[int, Path(gt=0)]


@contextmanager
def expense_errors() -> Iterator[None]:
    """Map service failures, including an unknown category, currency or family."""
    try:
        with lookup_errors():
            yield
    except ExpenseNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")
    except NotRecorder:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only the person who recorded this expense can change it")
    except ExpenseStateConflict as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_expense(body: ExpenseIn, user: CurrentUser, db: DbSession) -> ExpenseOut:
    with expense_errors():
        expense = expense_service.create_expense(db, user.id, body)
    return ExpenseOut.model_validate(expense)


@router.get("")
def list_transactions(query: Annotated[TransactionFilter, Query()], user: CurrentUser,
                      db: DbSession) -> Page[TransactionOut]:
    with expense_errors():
        return transaction_service.list_transactions(db, user.id, query)


@router.get("/audit-log")
def list_audit_log(query: Annotated[AuditFilter, Query()], user: CurrentUser,
                   db: DbSession) -> Page[AuditLogEntryOut]:
    with expense_errors():
        return transaction_service.list_audit_log(db, user.id, query)


@router.get("/{expense_id}")
def get_transaction(expense_id: ExpenseId, user: CurrentUser,
                    db: DbSession) -> TransactionDetailOut:
    with expense_errors():
        return transaction_service.get_transaction(db, expense_id, user.id)


@router.patch("/{expense_id}")
def update_expense(expense_id: ExpenseId, body: ExpenseUpdateIn, user: CurrentUser,
                   db: DbSession) -> ExpenseOut:
    with expense_errors():
        expense = expense_service.update_expense(db, expense_id, user.id, body)
    return ExpenseOut.model_validate(expense)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: ExpenseId, user: CurrentUser, db: DbSession) -> None:
    with expense_errors():
        expense_service.delete_expense(db, expense_id, user.id)


@router.post("/{expense_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
def restore_expense(expense_id: ExpenseId, user: CurrentUser, db: DbSession) -> None:
    with expense_errors():
        expense_service.restore_expense(db, expense_id, user.id)
