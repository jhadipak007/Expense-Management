"""Fetch one page of a query, detecting whether more rows follow."""

from sqlalchemy import Select
from sqlalchemy.orm import Session

from app.schemas.page import PageQuery


def fetch_page(db: Session, stmt: Select, page: PageQuery) -> tuple[list, bool]:
    """Rows for the page and whether another page follows (one extra row is fetched)."""
    rows = list(db.scalars(stmt.limit(page.limit + 1).offset(page.offset)).unique())
    return rows[:page.limit], len(rows) > page.limit
