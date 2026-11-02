"""Offset pagination shared by list endpoints."""

from pydantic import BaseModel, Field

from app.schemas.base import InputModel


class PageQuery(InputModel):
    limit: int = Field(default=25, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class Page[T](BaseModel):
    """One page of results; `has_more` is true when another page follows."""

    items: list[T]
    has_more: bool
