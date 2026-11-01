from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models import BudgetPeriod
from app.schemas.base import InputModel


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
