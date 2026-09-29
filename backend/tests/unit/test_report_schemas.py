from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.report import ReportFilter

RANGE = {"date_from": "2026-09-01", "date_to": "2026-09-30"}


def test_personal_scope_and_all_categories_by_default():
    query = ReportFilter(**RANGE)
    assert query.family_id is None
    assert query.category_id == []


def test_one_day_range_is_allowed():
    query = ReportFilter(date_from="2026-09-05", date_to="2026-09-05")
    assert query.date_from == query.date_to == date(2026, 9, 5)


def test_from_after_to_is_rejected():
    with pytest.raises(ValidationError, match="date_from must not be after date_to"):
        ReportFilter(date_from="2026-09-30", date_to="2026-09-01")


@pytest.mark.parametrize("changes", [{"family_id": 0}, {"category_id": [1, 0]}, {"scope": "all"}])
def test_invalid_ids_and_unknown_fields_are_rejected(changes):
    with pytest.raises(ValidationError):
        ReportFilter(**RANGE, **changes)
