"""Services log one event per auditable action, keyed by ids rather than emails."""

import logging

import pytest

from app.routers.auth import REFRESH_COOKIE
from tests.conftest import DEFAULT_PASSWORD

LOGIN = "/api/auth/login"
NEW_EXPENSE = {"amount": "12.50", "currency": "AUD", "category_id": 1, "spent_on": "2026-09-01"}


@pytest.fixture(autouse=True)
def capture_info(caplog):
    caplog.set_level(logging.INFO, logger="app.services")


def events(caplog) -> list[tuple[str, str, dict]]:
    """(level, message, fields) for each service log line."""
    return [(r.levelname, r.getMessage(), vars(r)) for r in caplog.records
            if r.name.startswith("app.services")]


def last_event(caplog) -> tuple[str, str, dict]:
    return events(caplog)[-1]


def test_login_success_and_failure_are_logged(client, caplog, make_user):
    user = make_user()
    client.post(LOGIN, json={"email": user.email, "password": "wrong-password"})
    client.post(LOGIN, json={"email": "nobody@example.com", "password": "wrong-password"})
    client.post(LOGIN, json={"email": user.email, "password": DEFAULT_PASSWORD})
    logged = [(level, message, fields["user_id"]) for level, message, fields in events(caplog)]
    assert logged == [("INFO", "login failed", user.id), ("INFO", "login failed", None),
                      ("INFO", "login succeeded", user.id)]


def test_sign_up_steps_are_logged(client, caplog):
    details = {"display_name": "Asha", "email": "asha@example.com", "password": "longenough"}
    registration_id = client.post("/api/auth/register", json=details).json()["registration_id"]
    client.post("/api/auth/register/verify", json={"registration_id": registration_id,
                                                   "code": "0000"})
    client.post("/api/auth/register/verify", json={"registration_id": registration_id,
                                                   "code": "2211"})
    messages = [message for _, message, _ in events(caplog)]
    assert messages == ["sign-up started", "sign-up code incorrect",
                        "sign-up verified; user created"]
    assert last_event(caplog)[2]["user_id"] is not None


def test_refresh_token_reuse_is_a_warning(client, caplog, make_user):
    user = make_user()
    first = client.post(LOGIN, json={"email": user.email, "password": DEFAULT_PASSWORD})
    raw = first.cookies[REFRESH_COOKIE]
    for _ in range(2):
        client.cookies.clear()
        client.cookies.set(REFRESH_COOKIE, raw)
        client.post("/api/auth/refresh")
    level, message, fields = last_event(caplog)
    assert (level, fields["user_id"]) == ("WARNING", user.id)
    assert "reuse" in message


def test_family_and_invitation_events_are_logged(client, caplog, make_user, auth_headers):
    owner, invitee = make_user(), make_user(email="ravi@example.com", display_name="Ravi")
    family_id = client.post("/api/families", json={"name": "Jha Household"},
                            headers=auth_headers(owner)).json()["id"]
    _, message, fields = last_event(caplog)
    assert (message, fields["user_id"], fields["family_id"]) == (
        "family created", owner.id, family_id)

    invitation_id = client.post(f"/api/families/{family_id}/invitations",
                                json={"user_id": invitee.id},
                                headers=auth_headers(owner)).json()["id"]
    _, message, fields = last_event(caplog)
    assert (message, fields["invitation_id"], fields["invitee_id"]) == (
        "invitation sent", invitation_id, invitee.id)

    client.post(f"/api/invitations/{invitation_id}/accept", headers=auth_headers(invitee))
    _, message, fields = last_event(caplog)
    assert (message, fields["user_id"], fields["family_id"]) == (
        "invitation accepted", invitee.id, family_id)


def test_declined_invitation_is_logged(client, caplog, make_user, make_family, auth_headers):
    owner, invitee = make_user(), make_user(email="ravi@example.com", display_name="Ravi")
    family = make_family(owner)
    invitation_id = client.post(f"/api/families/{family.id}/invitations",
                                json={"user_id": invitee.id},
                                headers=auth_headers(owner)).json()["id"]
    client.post(f"/api/invitations/{invitation_id}/decline", headers=auth_headers(invitee))
    _, message, fields = last_event(caplog)
    assert (message, fields["user_id"], fields["invitation_id"]) == (
        "invitation declined", invitee.id, invitation_id)


def test_expense_created_is_logged(client, caplog, make_user, auth_headers):
    user = make_user()
    expense_id = client.post("/api/expenses", json=NEW_EXPENSE,
                             headers=auth_headers(user)).json()["id"]
    _, message, fields = last_event(caplog)
    assert (message, fields["user_id"], fields["expense_id"], fields["family_id"]) == (
        "expense created", user.id, expense_id, None)
