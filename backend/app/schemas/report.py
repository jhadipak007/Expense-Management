from datetime import date
from decimal import Decimal
from typing import Annotated, Self

from pydantic import BaseModel, Field, model_validator

from app.schemas.base import InputModel


class ReportFilter(InputModel):
    """One scope (personal when `family_id` is omitted), a date range and optional categories."""

    family_id: int | None = Field(default=None, gt=0)
    date_from: date
    date_to: date
    category_id: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)

    @model_validator(mode="after")
    def dates_in_order(self) -> Self:
        if self.date_from > self.date_to:
            raise ValueError("date_from must not be after date_to")
        return self


class CategoryTotalOut(BaseModel):
    category_id: int
    name: str
    color: str
    total: Decimal


class CurrencyTotalOut(BaseModel):
    """Totals in one currency; amounts in different currencies are never added together."""

    currency: str
    total: Decimal
    categories: list[CategoryTotalOut]


class ReportSummaryOut(BaseModel):
    currencies: list[CurrencyTotalOut]
