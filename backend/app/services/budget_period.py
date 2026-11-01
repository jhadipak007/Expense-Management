"""Budget period dates and spending status. Pure functions, no database."""

from datetime import date, timedelta
from decimal import Decimal


def current_period(period: str, today: date, month_start_day: int,
                   anchor: date) -> tuple[date, date]:
    """First and last day (inclusive) of the budget period that contains `today`.

    Weekly runs Monday to Sunday, fortnightly in 14-day steps from `anchor`,
    monthly from `month_start_day` (1 to 28) to the day before it next month,
    and yearly from 1 January to 31 December.
    """
    match period:
        case "weekly":
            start = today - timedelta(days=today.weekday())
            return start, start + timedelta(days=6)
        case "fortnightly":
            start = anchor + timedelta(days=(today - anchor).days // 14 * 14)
            return start, start + timedelta(days=13)
        case "monthly":
            start = _month_start(today, month_start_day)
            return start, _add_month(start) - timedelta(days=1)
        case "yearly":
            return date(today.year, 1, 1), date(today.year, 12, 31)
    raise ValueError(f"Unknown period: {period}")


def _month_start(today: date, day: int) -> date:
    """The latest date on `day` of a month that is not after `today`."""
    start = today.replace(day=day)
    if today.day >= day:
        return start
    if start.month == 1:
        return start.replace(year=start.year - 1, month=12)
    return start.replace(month=start.month - 1)


def _add_month(start: date) -> date:
    """Same day next month; valid because the day is at most 28."""
    if start.month == 12:
        return start.replace(year=start.year + 1, month=1)
    return start.replace(month=start.month + 1)


def budget_status(spent: Decimal, amount: Decimal) -> str:
    """`on_track` below 80% of the amount, `close` from 80% to 100%, `over` above it."""
    if spent > amount:
        return "over"
    if spent * 5 >= amount * 4:
        return "close"
    return "on_track"
