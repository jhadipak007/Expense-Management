"""Case-insensitive substring search on user input, safe from LIKE wildcards."""

from sqlalchemy import ColumnElement


def contains(column, text: str) -> ColumnElement[bool]:
    """`column` contains `text`, with `%`, `_` and `\` in the text matched literally."""
    escaped = text.replace("\\", "\\\\").replace("%", "\%").replace("_", "\_")
    return column.ilike(f"%{escaped}%", escape="\\")
