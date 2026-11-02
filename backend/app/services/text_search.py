"""Case-insensitive substring search on user input, safe from LIKE wildcards."""

from sqlalchemy import ColumnElement


def contains(column, text: str) -> ColumnElement[bool]:
    r"""`column` contains `text`, with `%`, `_` and `\` in the text matched literally."""
    escaped = text.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    return column.ilike(f"%{escaped}%", escape="\\")
