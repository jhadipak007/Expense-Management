"""Unhandled errors are logged with a traceback, and secrets never reach the logs."""

import logging

from fastapi.testclient import TestClient

from app.main import create_app
from app.routers.auth import REFRESH_COOKIE

EMAIL, PASSWORD, OTP = "secret.person@example.com", "Very-Secret-Pass-9", "2211"


def all_log_text(caplog) -> str:
    """Every message and string field (`extra=`, traceback) captured, as one string.

    Numeric fields such as timestamps are skipped so digits in them cannot match the OTP.
    """
    return "\n".join(
        " ".join([record.getMessage(), *(v for v in vars(record).values() if isinstance(v, str))])
        for record in caplog.records
    )


def test_unhandled_error_returns_generic_500_and_logs_traceback(caplog):
    app = create_app()

    @app.get("/api/boom")
    def boom():
        raise RuntimeError("database password is hunter2")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/boom", headers={"X-Request-ID": "req-500"})
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert response.headers["X-Request-ID"] == "req-500"
    assert response.headers["Cache-Control"] == "no-store"
    [record] = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert "RuntimeError" in caplog.text
    assert record.exc_info is not None


def test_auth_flow_never_logs_secrets(client, caplog):
    caplog.set_level(logging.DEBUG)
    registration = client.post("/api/auth/register", json={
        "display_name": "Secret", "email": EMAIL, "password": PASSWORD,
    }).json()
    verified = client.post("/api/auth/register/verify", json={
        "registration_id": registration["registration_id"], "code": OTP,
    })
    client.post("/api/auth/login", json={"email": EMAIL, "password": "wrong-password-1"})
    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    access, refresh = login.json()["access_token"], login.cookies[REFRESH_COOKIE]
    client.get("/api/users/me", headers={"Authorization": f"Bearer {access}"})
    client.post("/api/auth/refresh")
    client.post("/api/auth/logout")

    logged = all_log_text(caplog)
    assert caplog.records, "the flow should produce log lines"
    secrets = [PASSWORD, "wrong-password-1", OTP, EMAIL, access, refresh,
               verified.json()["access_token"], registration["registration_id"]]
    for secret in secrets:
        assert secret not in logged
