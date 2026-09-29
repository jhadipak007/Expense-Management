"""Expenses: categories, recording an expense, and who may see one.

An expense is visible to its recorder while personal, and to every member of
the family it is shared with.
"""

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import Category, Expense, FamilyMember
from app.schemas.expense import ExpenseIn
from app.services.family_access import require_member


class UnknownCategory(Exception):
    """The category id does not exist."""


class ExpenseNotFound(Exception):
    """No such expense, or the user may not see it."""


def list_categories(db: Session) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.id)))


def visible_to(user_id: int):
    """Filter condition for the expenses the user may see."""
    member_families = select(FamilyMember.family_id).where(FamilyMember.user_id == user_id)
    return or_(
        and_(Expense.is_personal, Expense.user_id == user_id),
        Expense.family_id.in_(member_families),
    )


def create_expense(db: Session, user_id: int, data: ExpenseIn) -> Expense:
    """Record the expense for the user; a family must be one they belong to."""
    if db.get(Category, data.category_id) is None:
        raise UnknownCategory
    if data.family_id is not None:
        require_member(db, data.family_id, user_id)
    expense = Expense(user_id=user_id, **data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def get_expense(db: Session, expense_id: int, user_id: int) -> Expense:
    expense = db.scalar(select(Expense).where(Expense.id == expense_id, visible_to(user_id)))
    if expense is None:
        raise ExpenseNotFound
    return expense
