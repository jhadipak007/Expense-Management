"""The expense audit trail: one immutable row per create, update, delete and restore.

Rows are added to the caller's session and committed with the change they
describe, so an action and its audit entry are saved together or not at all.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditAction, Expense, ExpenseAudit
from app.schemas.expense import ExpenseUpdateIn


def record(db: Session, expense: Expense, user_id: int, action: AuditAction,
           changes: dict[str, Any] | None = None) -> None:
    """Add an audit row for the action; the caller commits."""
    db.add(ExpenseAudit(expense=expense, user_id=user_id, action=action, changes=changes))


def diff(expense: Expense, data: ExpenseUpdateIn, category_name: str) -> dict[str, list]:
    """Changed fields as {field: [old, new]}; empty when the edit changes nothing."""
    old = _display(expense.amount, expense.currency, expense.category_name,
                   expense.spent_on, expense.description)
    new = _display(data.amount, data.currency, category_name, data.spent_on, data.description)
    return {field: [old[field], new[field]] for field in old if old[field] != new[field]}


def _display(amount, currency, category, spent_on, description) -> dict[str, str | None]:
    """Editable fields as display-ready text: 2-decimal amount, category name, ISO date."""
    return {"amount": f"{amount:.2f}", "currency": currency, "category": category,
            "spent_on": spent_on.isoformat(), "description": description}
