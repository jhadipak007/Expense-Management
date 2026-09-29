from datetime import date, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models import Expense
from app.models.base import utcnow
from app.schemas.expense import ExpenseIn

VALID = {"amount": "12.50", "currency": "AUD", "category_id": 1, "spent_on": "2026-09-01"}


def expense_in(**changes) -> ExpenseIn:
    return ExpenseIn(**(VALID | changes))


def test_valid_expense_keeps_amount_and_currency_exactly():
    expense = expense_in(amount="1234.5", currency="USD")
    assert expense.amount == Decimal("1234.5")
    assert expense.currency == "USD"
    assert expense.family_id is None


@pytest.mark.parametrize("amount", ["0", "-1", "12.345", "abc", "1234567890123"])
def test_amount_must_be_positive_with_two_decimals(amount):
    with pytest.raises(ValidationError):
        expense_in(amount=amount)


@pytest.mark.parametrize("currency", ["aud", "AU", "AUDD", "A1D", ""])
def test_currency_must_be_three_uppercase_letters(currency):
    with pytest.raises(ValidationError):
        expense_in(currency=currency)


def test_description_is_limited_to_500_characters():
    assert expense_in(description="x" * 500).description == "x" * 500
    with pytest.raises(ValidationError):
        expense_in(description="x" * 501)


@pytest.mark.parametrize("field", ["category_id", "family_id"])
def test_ids_must_be_positive(field):
    with pytest.raises(ValidationError):
        expense_in(**{field: 0})


def test_client_cannot_set_the_recorder():
    with pytest.raises(ValidationError):
        expense_in(user_id=99)


def test_date_up_to_utc_tomorrow_is_accepted():
    tomorrow = utcnow().date() + timedelta(days=1)
    assert expense_in(spent_on=tomorrow.isoformat()).spent_on == tomorrow


def test_date_after_utc_tomorrow_is_rejected():
    with pytest.raises(ValidationError, match="Date cannot be in the future"):
        expense_in(spent_on=(utcnow().date() + timedelta(days=2)).isoformat())


def test_is_personal_when_no_family():
    assert Expense(family_id=None, spent_on=date(2026, 9, 1)).is_personal
    assert not Expense(family_id=3, spent_on=date(2026, 9, 1)).is_personal
