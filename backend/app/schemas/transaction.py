"""Transactions (expenses as listed, with who recorded them) and their audit trail."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import AuditAction
from app.schemas.expense import CategoryOut
from app.schemas.page import PageQuery


class TransactionFilter(PageQuery):
    """One space (personal when `family_id` is omitted) with optional filters.

    Dates are inclusive and filter the expense date. `user_id` is the member
    who recorded it (or, in the audit log, who acted) and needs a family.
    """

    family_id: int | None = Field(default=None, gt=0)
    date_from: date | None = None
    date_to: date | None = None
    category_id: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    user_id: int | None = Field(default=None, gt=0)
    q: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def check(self) -> Self:
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must not be after date_to")
        if self.user_id is not None and self.family_id is None:
            raise ValueError("user_id needs a family_id")
        return self


class AuditFilter(TransactionFilter):
    action: list[AuditAction] = Field(default_factory=list)


class UserRefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str


class TransactionSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: Decimal
    currency: str
    category: CategoryOut
    spent_on: date
    description: str | None
    family_id: int | None
    deleted_at: datetime | None


class TransactionOut(TransactionSummaryOut):
    model_config = ConfigDict(from_attributes=True, validate_by_name=True)

    created_by: UserRefOut = Field(validation_alias="user")
    created_at: datetime


class AuditEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: AuditAction
    performed_by: UserRefOut = Field(validation_alias="user")
    created_at: datetime
    changes: dict[str, list[Any]] | None


class AuditLogEntryOut(AuditEntryOut):
    expense: TransactionSummaryOut


class TransactionDetailOut(TransactionOut):
    """A transaction with its full history, oldest first.

    Last modified is the newest action after creation; null if never changed.
    """

    history: list[AuditEntryOut]
    last_modified_by: UserRefOut | None
    last_modified_at: datetime | None
    can_edit: bool
