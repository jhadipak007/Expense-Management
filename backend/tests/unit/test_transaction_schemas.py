"""Transaction and audit log filters."""

import pytest
from pydantic import ValidationError

from app.schemas.transaction import AuditFilter, TransactionFilter


def test_defaults_are_the_first_page_of_personal_transactions():
    query = TransactionFilter()
    assert (query.family_id, query.limit, query.offset, query.category_id) == (None, 25, 0, [])


@pytest.mark.parametrize("fields", [
    {"date_from": "2026-09-02", "date_to": "2026-09-01"},
    {"user_id": 3},
    {"q": ""}, {"q": "x" * 101},
    {"limit": 0}, {"limit": 101}, {"offset": -1},
])
def test_invalid_transaction_filters(fields):
    with pytest.raises(ValidationError):
        TransactionFilter(**fields)


def test_audit_filter_accepts_known_actions_only():
    assert AuditFilter(action=["created", "deleted"]).action == ["created", "deleted"]
    with pytest.raises(ValidationError):
        AuditFilter(action=["edited"])
