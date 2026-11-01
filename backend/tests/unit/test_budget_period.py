from datetime import date
from decimal import Decimal

import pytest

from app.services.budget_period import budget_status, current_period

ANCHOR = date(2026, 9, 1)


@pytest.mark.parametrize("today", [date(2026, 9, 14), date(2026, 9, 17), date(2026, 9, 20)])
def test_weekly_runs_monday_to_sunday(today):
    assert current_period("weekly", today, 1, ANCHOR) == (date(2026, 9, 14), date(2026, 9, 20))


@pytest.mark.parametrize("today, expected", [
    (date(2026, 9, 1), (date(2026, 9, 1), date(2026, 9, 14))),
    (date(2026, 9, 14), (date(2026, 9, 1), date(2026, 9, 14))),
    (date(2026, 9, 15), (date(2026, 9, 15), date(2026, 9, 28))),
    (date(2026, 8, 31), (date(2026, 8, 18), date(2026, 8, 31))),
    (date(2027, 1, 4), (date(2026, 12, 22), date(2027, 1, 4))),
    (date(2027, 1, 5), (date(2027, 1, 5), date(2027, 1, 18))),
])
def test_fortnightly_counts_14_days_from_the_anchor(today, expected):
    assert current_period("fortnightly", today, 1, ANCHOR) == expected


@pytest.mark.parametrize("today, day, expected", [
    (date(2026, 9, 1), 1, (date(2026, 9, 1), date(2026, 9, 30))),
    (date(2026, 9, 30), 1, (date(2026, 9, 1), date(2026, 9, 30))),
    (date(2026, 9, 15), 15, (date(2026, 9, 15), date(2026, 10, 14))),
    (date(2026, 10, 14), 15, (date(2026, 9, 15), date(2026, 10, 14))),
    (date(2026, 9, 14), 15, (date(2026, 8, 15), date(2026, 9, 14))),
    (date(2027, 1, 10), 15, (date(2026, 12, 15), date(2027, 1, 14))),
    (date(2026, 12, 20), 15, (date(2026, 12, 15), date(2027, 1, 14))),
    (date(2027, 2, 28), 28, (date(2027, 2, 28), date(2027, 3, 27))),
    (date(2028, 2, 29), 1, (date(2028, 2, 1), date(2028, 2, 29))),
])
def test_monthly_follows_the_month_start_day(today, day, expected):
    assert current_period("monthly", today, day, ANCHOR) == expected


def test_yearly_is_the_calendar_year():
    assert current_period("yearly", date(2028, 2, 29), 15, ANCHOR) == (
        date(2028, 1, 1), date(2028, 12, 31))


@pytest.mark.parametrize("spent, status", [
    ("0", "on_track"), ("79.99", "on_track"), ("80", "close"), ("100", "close"), ("100.01", "over"),
])
def test_status_thresholds(spent, status):
    assert budget_status(Decimal(spent), Decimal("100")) == status
