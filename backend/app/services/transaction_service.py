"""Reading a space's transactions and audit log, and one transaction's history.

A space is the user's personal expenses or one family's. Deleted expenses are
left out of the transaction list but stay in the audit log and history.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import AuditAction, Expense, ExpenseAudit
from app.schemas.page import Page
from app.schemas.transaction import (
    AuditEntryOut, AuditFilter, AuditLogEntryOut, TransactionDetailOut, TransactionFilter,
    TransactionOut, UserRefOut,
)
from app.services.expense_service import get_expense
from app.services.family_access import require_member
from app.services.pagination import fetch_page
from app.services.report_service import scope_condition
from app.services.text_search import contains


def list_transactions(db: Session, user_id: int, query: TransactionFilter) -> Page[TransactionOut]:
    """Live expenses in the space, latest expense date first."""
    conditions = _space_conditions(db, user_id, query)
    if query.user_id is not None:
        conditions.append(Expense.user_id == query.user_id)
    stmt = (select(Expense).options(joinedload(Expense.category), joinedload(Expense.user))
            .where(Expense.is_active, *conditions)
            .order_by(Expense.spent_on.desc(), Expense.id.desc()))
    rows, has_more = fetch_page(db, stmt, query)
    return Page[TransactionOut](items=[TransactionOut.model_validate(r) for r in rows],
                                has_more=has_more)


def list_audit_log(db: Session, user_id: int, query: AuditFilter) -> Page[AuditLogEntryOut]:
    """Every action on the space's expenses, deleted ones included, newest first."""
    conditions = _space_conditions(db, user_id, query)
    if query.user_id is not None:
        conditions.append(ExpenseAudit.user_id == query.user_id)
    if query.action:
        conditions.append(ExpenseAudit.action.in_(query.action))
    stmt = (select(ExpenseAudit).join(ExpenseAudit.expense)
            .options(joinedload(ExpenseAudit.user),
                     joinedload(ExpenseAudit.expense).joinedload(Expense.category))
            .where(*conditions)
            .order_by(ExpenseAudit.id.desc()))
    rows, has_more = fetch_page(db, stmt, query)
    return Page[AuditLogEntryOut](items=[AuditLogEntryOut.model_validate(r) for r in rows],
                                  has_more=has_more)


def get_transaction(db: Session, expense_id: int, user_id: int) -> TransactionDetailOut:
    """The transaction, deleted or not, with its history and who changed it last."""
    expense = get_expense(db, expense_id, user_id)
    last = expense.history[-1] if expense.history else None
    modified = last is not None and last.action != AuditAction.created
    return TransactionDetailOut(
        **dict(TransactionOut.model_validate(expense)),
        history=[AuditEntryOut.model_validate(entry) for entry in expense.history],
        last_modified_by=UserRefOut.model_validate(last.user) if modified else None,
        last_modified_at=last.created_at if modified else None,
        can_edit=expense.user_id == user_id,
    )


def _space_conditions(db: Session, user_id: int, query: TransactionFilter) -> list:
    """The space (membership checked), expense dates, categories and description search."""
    if query.family_id is not None:
        require_member(db, query.family_id, user_id)
    conditions = [scope_condition(query.family_id, user_id)]
    if query.date_from:
        conditions.append(Expense.spent_on >= query.date_from)
    if query.date_to:
        conditions.append(Expense.spent_on <= query.date_to)
    if query.category_id:
        conditions.append(Expense.category_id.in_(query.category_id))
    if query.q:
        conditions.append(contains(Expense.description, query.q))
    return conditions
