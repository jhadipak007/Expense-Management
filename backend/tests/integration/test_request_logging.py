"""Request ID header and the access log line."""

import logging

import pytest


def access_records(caplog) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "app.access"]


@pytest.fixture(autouse=True)
def capture_info(caplog):
    caplog.set_level(logging.INFO)


def test_response_carries_a_generated_request_id(client):
    assert len(client.get("/api/categories").headers["X-Request-ID"]) == 32


def test_valid_incoming_request_id_is_reused(client):
    response = client.get("/api/categories", headers={"X-Request-ID": "abc-123"})
    assert response.headers["X-Request-ID"] == "abc-123"


def test_unsafe_incoming_request_id_is_replaced(client):
    response = client.get("/api/categories", headers={"X-Request-ID": "bad id\nforged"})
    assert response.headers["X-Request-ID"] != "bad id\nforged"


def test_access_line_records_request_fields(client, caplog):
    client.get("/api/categories")
    [record] = access_records(caplog)
    assert (record.method, record.path, record.status) == ("GET", "/api/categories", 401)
    assert record.user_id is None
    assert record.duration_ms >= 0


def test_access_line_records_the_authenticated_user(client, caplog, make_user, auth_headers):
    user = make_user()
    client.get("/api/categories", headers=auth_headers(user))
    [record] = access_records(caplog)
    assert (record.status, record.user_id) == (200, user.id)


def test_health_checks_are_not_logged(client, caplog):
    client.get("/api/health")
    assert access_records(caplog) == []
