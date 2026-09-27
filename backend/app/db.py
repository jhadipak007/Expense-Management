"""Database engine, session factory and the `get_db` dependency."""

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def build_engine(url) -> Engine:
    """Create an engine; on SQLite, enforce foreign keys and use real transactions."""
    engine = create_engine(url)
    if engine.dialect.name == "sqlite":
        event.listen(engine, "connect", _configure_sqlite_connection)
    return engine


def _configure_sqlite_connection(dbapi_connection, _record) -> None:
    """Turn on foreign keys, then switch sqlite3 to standard transaction control.

    The pragma is a no-op inside a transaction, so it must run before
    `autocommit = False` (Python 3.12+), which opens one immediately.
    """
    dbapi_connection.execute("PRAGMA foreign_keys=ON")
    dbapi_connection.autocommit = False


engine = build_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Yield one session per request."""
    with SessionLocal() as session:
        yield session
