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
        event.listen(engine, "begin", _begin_immediate)
    return engine


def _configure_sqlite_connection(dbapi_connection, _record) -> None:
    """Turn on foreign keys and let SQLAlchemy, not sqlite3, emit BEGIN."""
    dbapi_connection.isolation_level = None
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


def _begin_immediate(connection) -> None:
    """Take the write lock when a transaction starts.

    A deferred transaction that reads and then writes deadlocks with another
    one doing the same, and SQLite fails it at once. IMMEDIATE makes the
    second transaction wait for the first instead.
    """
    connection.exec_driver_sql("BEGIN IMMEDIATE")


engine = build_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Yield one session per request."""
    with SessionLocal() as session:
        yield session
