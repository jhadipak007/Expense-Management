"""Error mapping shared by routers that take a category, currency or family."""

from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException, status

from app.services.expense_service import UnknownCategory, UnknownCurrency
from app.services.family_access import FamilyNotFound


@contextmanager
def lookup_errors() -> Iterator[None]:
    """An unknown category or currency is reported like any invalid field; a hidden family is 404."""
    try:
        yield
    except UnknownCategory:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, [
            {"loc": ["body", "category_id"], "msg": "Unknown category", "type": "value_error"},
        ])
    except UnknownCurrency:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, [
            {"loc": ["body", "currency"], "msg": "Unknown currency", "type": "value_error"},
        ])
    except FamilyNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family not found")
