"""Spending summaries for one scope: the user's personal expenses, or one family's."""

from itertools import groupby

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models import Category, Expense
from app.schemas.report import CategoryTotalOut, CurrencyTotalOut, ReportFilter, ReportSummaryOut
from app.services.family_access import require_member


def scope_condition(family_id: int | None, user_id: int):
    """The user's personal expenses, or every expense shared with the family."""
    if family_id is None:
        return and_(Expense.is_personal, Expense.user_id == user_id)
    return Expense.family_id == family_id


def summarize(db: Session, user_id: int, query: ReportFilter) -> ReportSummaryOut:
    """Totals by currency, then by category. Personal and family expenses are never combined."""
    if query.family_id is not None:
        require_member(db, query.family_id, user_id)
    conditions = [scope_condition(query.family_id, user_id), Expense.is_active,
                  Expense.spent_on.between(query.date_from, query.date_to)]
    if query.category_id:
        conditions.append(Expense.category_id.in_(query.category_id))
    rows = db.execute(
        select(Expense.currency, Category.id, Category.name, Category.color,
               func.sum(Expense.amount))
        .join(Expense.category)
        .where(*conditions)
        .group_by(Expense.currency, Category.id, Category.name, Category.color)
        .order_by(Expense.currency, Category.id)
    ).all()
    return ReportSummaryOut(currencies=[
        _currency_total(currency, list(group))
        for currency, group in groupby(rows, key=lambda row: row[0])
    ])


def _currency_total(currency: str, rows) -> CurrencyTotalOut:
    categories = [
        CategoryTotalOut(category_id=cid, name=name, color=color, total=total)
        for _, cid, name, color, total in rows
    ]
    return CurrencyTotalOut(currency=currency, total=sum(c.total for c in categories),
                            categories=categories)
