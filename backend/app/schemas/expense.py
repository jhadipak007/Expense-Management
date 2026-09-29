from datetime import date, timedelta
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.base import utcnow
from app.schemas.base import InputModel


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str


class ExpenseIn(InputModel):
    """A new expense. The recorder comes from the access token, never the body."""

    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    category_id: int = Field(gt=0)
    spent_on: date
    description: str | None = Field(default=None, max_length=500)
    family_id: int | None = Field(default=None, gt=0)

    @field_validator("spent_on")
    @classmethod
    def not_in_future(cls, value: date) -> date:
        """Reject future dates.

        The server runs in UTC and no time zone is a full day ahead of UTC, so
        UTC tomorrow is the latest date that can still be "today" for a user.
        """
        if value > utcnow().date() + timedelta(days=1):
            raise ValueError("Date cannot be in the future")
        return value


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: Decimal
    currency: str
    category: CategoryOut
    spent_on: date
    description: str | None
    family_id: int | None
    user_id: int
