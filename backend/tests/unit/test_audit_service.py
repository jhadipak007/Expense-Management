"""The audit diff: changed fields only, as display-ready text."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.schemas.expense import ExpenseUpdateIn
from app.services.audit_service import diff

EXPENSE = SimpleNamespace(amount=Decimal("12.50"), currency="AUD", category_name="Grocery",
                          spent_on=date(2026, 9, 1), description=None)


def edit(**fields) -> ExpenseUpdateIn:
    return ExpenseUpdateIn(**({"amount": "12.5", "currency": "AUD", "category_id": 1,
                               "spent_on": "2026-09-01"} | fields))


def test_same_values_are_no_change():
    assert diff(EXPENSE, edit(), "Grocery") == {}


def test_each_changed_field_has_old_and_new_text():
    changes = diff(EXPENSE, edit(amount="3", currency="INR", spent_on="2026-08-31",
                                 description="Milk"), "Trips")
    assert changes == {
        "amount": ["12.50", "3.00"], "currency": ["AUD", "INR"], "category": ["Grocery", "Trips"],
        "spent_on": ["2026-09-01", "2026-08-31"], "description": [None, "Milk"],
    }
