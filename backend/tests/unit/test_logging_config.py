"""JSON formatter and request ID stamping."""

import json
import logging
import sys

from app.logging_config import JsonFormatter, RequestIdFilter, request_id_var


def make_record(**extra) -> logging.LogRecord:
    record = logging.makeLogRecord({"name": "app.test", "levelname": "INFO", "msg": "hello %s",
                                    "args": ("world",), **extra})
    RequestIdFilter().filter(record)
    return record


def test_json_line_has_core_and_extra_fields():
    token = request_id_var.set("req-1")
    try:
        line = json.loads(JsonFormatter().format(make_record(user_id=7)))
    finally:
        request_id_var.reset(token)
    assert line["level"] == "INFO"
    assert line["logger"] == "app.test"
    assert line["message"] == "hello world"
    assert line["request_id"] == "req-1"
    assert line["user_id"] == 7
    assert "args" not in line


def test_json_line_includes_the_traceback():
    try:
        raise ValueError("boom")
    except ValueError:
        record = make_record(exc_info=sys.exc_info())
    line = json.loads(JsonFormatter().format(record))
    assert "ValueError: boom" in line["exc_info"]


def test_request_id_is_none_outside_a_request():
    assert json.loads(JsonFormatter().format(make_record()))["request_id"] is None
