"""Budget requests and responses."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models import BudgetPeriod
from app.models.base import utcnow
from app.schemas.base import InputModel


class TodayQuery(InputModel):
    """The user's local date, which picks each budget's current period."""

    today: date

    @field_validator("today")
    @classmethod
    def near_utc_today(cls, value: date) -> date:
        """Every time zone's date is within a day of the UTC date."""
        if abs(value - utcnow().date()) > timedelta(days=1):
            raise ValueError("Date must be within a day of today")
        return value


class BudgetUpdateIn(InputModel):
    """The parts of a budget that can change: its limit and its period."""

    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    period: BudgetPeriod


class BudgetIn(BudgetUpdateIn):
    """A new budget: personal when `family_id` is null, all categories when `category_id` is null."""

    family_id: int | None = Field(default=None, gt=0)
    category_id: int | None = Field(default=None, gt=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class BudgetOut(BaseModel):
    """A budget with its current period and the spending counted against it."""

    id: int
    family_id: int | None
    category_id: int | None
    period: BudgetPeriod
    amount: Decimal
    currency: str
    period_start: date
    period_end: date
    spent: Decimal
    remaining: Decimal
    over_by: Decimal
    status: Literal["on_track", "close", "over"]
    can_manage: bool
