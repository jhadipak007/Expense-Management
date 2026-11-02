"""Expenses: categories, currencies, recording, editing, deleting and restoring.

An expense is visible to its recorder while personal, and to every member of
the family it is shared with. Only the recorder changes it, and every change
is written to the audit trail in the same commit.
"""

import logging

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import AuditAction, Category, Currency, Expense, FamilyMember
from app.models.base import utcnow
from app.schemas.expense import ExpenseFields, ExpenseIn, ExpenseUpdateIn
from app.services import audit_service
from app.services.family_access import require_member

logger = logging.getLogger(__name__)


class UnknownCategory(Exception):
    """The category id does not exist."""


class UnknownCurrency(Exception):
    """The currency code is not in the currencies table."""


class ExpenseNotFound(Exception):
    """No such expense, or the user may not see it."""


class NotRecorder(Exception):
    """The user can see the expense but did not record it, so cannot change it."""


class ExpenseStateConflict(Exception):
    """The action does not fit the expense's state, e.g. editing a deleted expense."""


def list_categories(db: Session) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.id)))


def list_currencies(db: Session) -> list[Currency]:
    return list(db.scalars(select(Currency).order_by(Currency.code)))


def visible_to(user_id: int):
    """Filter condition for the expenses the user may see."""
    member_families = select(FamilyMember.family_id).where(FamilyMember.user_id == user_id)
    return or_(
        and_(Expense.is_personal, Expense.user_id == user_id),
        Expense.family_id.in_(member_families),
    )


def create_expense(db: Session, user_id: int, data: ExpenseIn) -> Expense:
    """Record the expense for the user; a family must be one they belong to."""
    _require_lookups(db, data)
    if data.family_id is not None:
        require_member(db, data.family_id, user_id)
    expense = Expense(user_id=user_id, **data.model_dump())
    db.add(expense)
    audit_service.record(db, expense, user_id, AuditAction.created)
    db.commit()
    db.refresh(expense)
    _log("expense created", expense, user_id)
    return expense


def get_expense(db: Session, expense_id: int, user_id: int) -> Expense:
    """The expense, deleted or not, if the user may see it."""
    expense = db.scalar(select(Expense).where(Expense.id == expense_id, visible_to(user_id)))
    if expense is None:
        raise ExpenseNotFound
    return expense


def update_expense(db: Session, expense_id: int, user_id: int, data: ExpenseUpdateIn) -> Expense:
    """Replace the editable fields; an edit that changes nothing is not audited."""
    expense = _recorded_by(db, expense_id, user_id)
    if not expense.is_active:
        raise ExpenseStateConflict("Restore the expense before editing it")
    category = _require_lookups(db, data)
    changes = audit_service.diff(expense, data, category.name)
    if not changes:
        return expense
    for field, value in data.model_dump().items():
        setattr(expense, field, value)
    audit_service.record(db, expense, user_id, AuditAction.updated, changes)
    db.commit()
    db.refresh(expense)
    _log("expense updated", expense, user_id)
    return expense


def delete_expense(db: Session, expense_id: int, user_id: int) -> None:
    """Soft delete: the expense leaves lists, reports and budgets but stays in the audit log."""
    expense = _recorded_by(db, expense_id, user_id)
    if not expense.is_active:
        raise ExpenseStateConflict("The expense is already deleted")
    expense.deleted_at = utcnow()
    audit_service.record(db, expense, user_id, AuditAction.deleted)
    db.commit()
    _log("expense deleted", expense, user_id)


def restore_expense(db: Session, expense_id: int, user_id: int) -> None:
    """Undo a delete: the expense counts again in lists, reports and budgets."""
    expense = _recorded_by(db, expense_id, user_id)
    if expense.is_active:
        raise ExpenseStateConflict("The expense is not deleted")
    expense.deleted_at = None
    audit_service.record(db, expense, user_id, AuditAction.restored)
    db.commit()
    _log("expense restored", expense, user_id)


def _recorded_by(db: Session, expense_id: int, user_id: int) -> Expense:
    """The expense if the user recorded it; NotRecorder if they can only see it."""
    expense = get_expense(db, expense_id, user_id)
    if expense.user_id != user_id:
        raise NotRecorder
    return expense


def _require_lookups(db: Session, data: ExpenseFields) -> Category:
    """The chosen category; raise if it or the currency does not exist."""
    category = db.get(Category, data.category_id)
    if category is None:
        raise UnknownCategory
    if db.get(Currency, data.currency) is None:
        raise UnknownCurrency
    return category


def _log(event: str, expense: Expense, user_id: int) -> None:
    logger.info(event, extra={"user_id": user_id, "expense_id": expense.id,
                              "family_id": expense.family_id})
