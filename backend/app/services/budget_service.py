"""Budgets: spending limits that repeat every period, personal or for one family.

A personal budget is visible to and managed by its creator only. A family budget
is visible to every member and managed by the family owner only.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import NamedTuple

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Budget, BudgetPeriod, Category, Currency, Expense, FamilyMember, FamilyRole, User,
)
from app.schemas.budget import BudgetIn, BudgetOut, BudgetUpdateIn
from app.services.budget_period import budget_status, current_period
from app.services.expense_service import UnknownCategory, UnknownCurrency
from app.services.family_access import require_owner
from app.services.report_service import scope_condition

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")


class BudgetNotFound(Exception):
    """No such budget, or the user may not see it."""


class DuplicateBudget(Exception):
    """A budget with the same scope, category, period and currency already exists."""


class Viewer(NamedTuple):
    """What decides how a user sees budgets, loaded once per request.

    `roles` maps each of the user's families to their role in it. `start_days` maps
    None to the user's own month start day and each family to its owner's.
    """

    roles: dict[int, FamilyRole]
    start_days: dict[int | None, int]


def list_budgets(db: Session, user_id: int, today: date) -> list[BudgetOut]:
    viewer = _load_viewer(db, user_id)
    budgets = db.scalars(select(Budget).where(_visible_to(user_id)).order_by(Budget.id))
    return [_to_out(db, budget, viewer, today) for budget in budgets]


def get_budget(db: Session, budget_id: int, user_id: int, today: date) -> BudgetOut:
    budget = _get_visible(db, budget_id, user_id)
    return _to_out(db, budget, _load_viewer(db, user_id), today)


def create_budget(db: Session, user_id: int, data: BudgetIn, today: date) -> BudgetOut:
    """Save a new budget; a family budget needs the family owner. Fortnights count from `today`."""
    if data.category_id is not None and db.get(Category, data.category_id) is None:
        raise UnknownCategory
    if db.get(Currency, data.currency) is None:
        raise UnknownCurrency
    if data.family_id is not None:
        require_owner(db, data.family_id, user_id)
    budget = Budget(user_id=user_id, anchor_date=today,
                    scope_key=_scope_key(user_id, data.family_id, data.category_id),
                    **data.model_dump())
    db.add(budget)
    _commit(db, budget)
    _log("budget created", budget, user_id)
    return _to_out(db, budget, _load_viewer(db, user_id), today)


def update_budget(db: Session, budget_id: int, user_id: int, data: BudgetUpdateIn,
                  today: date) -> BudgetOut:
    """Change the amount and period. Switching to fortnightly starts the first fortnight today."""
    budget = _get_managed(db, budget_id, user_id)
    if data.period == BudgetPeriod.fortnightly and budget.period != BudgetPeriod.fortnightly:
        budget.anchor_date = today
    budget.amount = data.amount
    budget.period = data.period
    _commit(db, budget)
    _log("budget updated", budget, user_id)
    return _to_out(db, budget, _load_viewer(db, user_id), today)


def delete_budget(db: Session, budget_id: int, user_id: int) -> None:
    """Delete the budget. Expenses are not affected."""
    budget = _get_managed(db, budget_id, user_id)
    db.delete(budget)
    db.commit()
    _log("budget deleted", budget, user_id)


def _scope_key(user_id: int, family_id: int | None, category_id: int | None) -> str:
    """Scope and category without nulls, so the unique constraint catches every duplicate."""
    scope = f"f{family_id}" if family_id is not None else f"u{user_id}"
    return f"{scope}:{category_id if category_id is not None else 'all'}"


def _visible_to(user_id: int):
    member_families = select(FamilyMember.family_id).where(FamilyMember.user_id == user_id)
    return or_(
        and_(Budget.family_id.is_(None), Budget.user_id == user_id),
        Budget.family_id.in_(member_families),
    )


def _get_visible(db: Session, budget_id: int, user_id: int) -> Budget:
    budget = db.scalar(select(Budget).where(Budget.id == budget_id, _visible_to(user_id)))
    if budget is None:
        raise BudgetNotFound
    return budget


def _get_managed(db: Session, budget_id: int, user_id: int) -> Budget:
    """A budget the user may change; a family member who is not the owner gets NotFamilyOwner."""
    budget = _get_visible(db, budget_id, user_id)
    if budget.family_id is not None:
        require_owner(db, budget.family_id, user_id)
    return budget


def _commit(db: Session, budget: Budget) -> None:
    """Commit and reload the stored values; the only constraint left to fail is uniqueness."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DuplicateBudget
    db.refresh(budget)


def _load_viewer(db: Session, user_id: int) -> Viewer:
    """Two queries: the user's roles, and the start day of the user and each family owner."""
    roles = dict(db.execute(
        select(FamilyMember.family_id, FamilyMember.role).where(FamilyMember.user_id == user_id)
    ).all())
    owner_days = db.execute(
        select(FamilyMember.family_id, User.month_start_day)
        .join(User, User.id == FamilyMember.user_id)
        .where(FamilyMember.family_id.in_(list(roles)), FamilyMember.role == FamilyRole.owner)
    ).all()
    return Viewer(roles, {None: db.get(User, user_id).month_start_day, **dict(owner_days)})


def _to_out(db: Session, budget: Budget, viewer: Viewer, today: date) -> BudgetOut:
    """The budget in the period containing `today`; monthly periods use the creator's or owner's day."""
    start, end = current_period(budget.period, today, viewer.start_days[budget.family_id],
                                budget.anchor_date)
    spent = _spent(db, budget, start, end)
    return BudgetOut(
        id=budget.id, family_id=budget.family_id, category_id=budget.category_id,
        period=budget.period, amount=budget.amount, currency=budget.currency,
        period_start=start, period_end=end, spent=spent,
        remaining=max(budget.amount - spent, ZERO),
        over_by=max(spent - budget.amount, ZERO),
        status=budget_status(spent, budget.amount),
        can_manage=budget.family_id is None or viewer.roles[budget.family_id] == FamilyRole.owner,
    )


def _spent(db: Session, budget: Budget, start: date, end: date) -> Decimal:
    """Matching expenses in the period: same scope and currency, same category unless all."""
    conditions = [scope_condition(budget.family_id, budget.user_id),
                  Expense.currency == budget.currency, Expense.spent_on.between(start, end)]
    if budget.category_id is not None:
        conditions.append(Expense.category_id == budget.category_id)
    return db.scalar(select(func.sum(Expense.amount)).where(*conditions)) or ZERO


def _log(event: str, budget: Budget, user_id: int) -> None:
    logger.info(event, extra={"user_id": user_id, "budget_id": budget.id,
                              "family_id": budget.family_id})
