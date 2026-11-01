"""Logging to stdout: one JSON line per event in production, readable text locally."""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# Attributes every LogRecord has; anything else came from `extra=` and is emitted as a field.
# uvicorn adds `color_message`, an ANSI-coloured copy of the message.
STANDARD_ATTRS = set(vars(logging.makeLogRecord({}))) | {
    "message", "asctime", "request_id", "color_message",
}
TEXT_FORMAT = "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"

handler = logging.StreamHandler(sys.stdout)


class RequestIdFilter(logging.Filter):
    """Stamp each record with the current request's ID."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    """Format a record as one JSON object: core fields, `extra=` fields, then any traceback."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }
        entry |= {k: v for k, v in vars(record).items() if k not in STANDARD_ATTRS}
        if record.exc_info:
            entry["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def setup_logging(level: str, log_format: str) -> None:
    """Send app and uvicorn logs through one stdout handler on the root logger."""
    handler.setFormatter(JsonFormatter() if log_format == "json" else logging.Formatter(TEXT_FORMAT))
    handler.filters = [RequestIdFilter()]
    root = logging.getLogger()
    if handler not in root.handlers:
        root.addHandler(handler)
    root.setLevel(level)
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True
