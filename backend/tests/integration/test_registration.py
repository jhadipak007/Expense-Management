from datetime import timedelta

import pytest
from sqlalchemy import func, select, update

from app.models import PendingRegistration, User
from app.models.base import utcnow
from app.routers.auth import REFRESH_COOKIE

REGISTER = "/api/auth/register"
VERIFY = "/api/auth/register/verify"
LOGIN = "/api/auth/login"
ME = "/api/users/me"
DETAILS = {"display_name": "Asha", "email": "Asha@Example.com", "password": "longenough"}


def register(client, **overrides):
    return client.post(REGISTER, json=DETAILS | overrides)


def verify(client, registration_id, code="2211"):
    return client.post(VERIFY, json={"registration_id": registration_id, "code": code})


def user_count(db):
    return db.scalar(select(func.count()).select_from(User))


def test_register_returns_id_without_creating_user(client, db):
    response = register(client)
    assert response.status_code == 201
    assert response.json()["registration_id"]
    assert user_count(db) == 0


def test_correct_code_creates_user_and_logs_in(client, db):
    registration_id = register(client).json()["registration_id"]
    response = verify(client, registration_id)
    assert response.status_code == 200
    assert REFRESH_COOKIE in response.cookies
    me = client.get(ME, headers={"Authorization": f"Bearer {response.json()['access_token']}"})
    assert me.json()["display_name"] == "Asha"
    assert me.json()["email"] == "asha@example.com"
    assert db.scalar(select(func.count()).select_from(PendingRegistration)) == 0


def test_registered_user_can_log_in_without_otp(client):
    verify(client, register(client).json()["registration_id"])
    response = client.post(LOGIN, json={"email": "asha@example.com", "password": "longenough"})
    assert response.status_code == 200


def test_wrong_code_keeps_registration(client, db):
    registration_id = register(client).json()["registration_id"]
    response = verify(client, registration_id, code="1234")
    assert response.status_code == 400
    assert response.json() == {"detail": "Incorrect code, please try again"}
    assert user_count(db) == 0
    assert verify(client, registration_id).status_code == 200


def test_fifth_wrong_code_ends_registration(client, db):
    registration_id = register(client).json()["registration_id"]
    for _ in range(4):
        assert verify(client, registration_id, code="0000").status_code == 400
    assert verify(client, registration_id, code="0000").status_code == 404
    assert verify(client, registration_id).status_code == 404
    assert user_count(db) == 0


def test_expired_registration_is_rejected(client, db):
    registration_id = register(client).json()["registration_id"]
    db.execute(update(PendingRegistration).values(expires_at=utcnow() - timedelta(seconds=1)))
    db.commit()
    assert verify(client, registration_id).status_code == 404


def test_unknown_registration_is_rejected(client):
    assert verify(client, "not-a-real-registration-id").status_code == 404


def test_abandoned_registration_does_not_block_the_email(client):
    register(client)
    second = register(client).json()["registration_id"]
    assert verify(client, second).status_code == 200


def test_existing_email_is_rejected_case_insensitively(client, make_user):
    make_user(email="asha@example.com")
    response = register(client, email="ASHA@example.com")
    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}


def test_email_taken_while_pending_is_rejected_at_verify(client, make_user, db):
    registration_id = register(client).json()["registration_id"]
    make_user(email="asha@example.com")
    assert verify(client, registration_id).status_code == 409
    assert user_count(db) == 1


@pytest.mark.parametrize("code", ["abcd", "221", "22110", ""])
def test_code_must_be_four_digits(client, code):
    registration_id = register(client).json()["registration_id"]
    assert verify(client, registration_id, code=code).status_code == 422


@pytest.mark.parametrize("field,value", [
    ("email", "not-an-email"),
    ("password", "short"),
    ("password", "x" * 73),
    ("display_name", ""),
    ("display_name", "x" * 101),
])
def test_invalid_details_are_rejected(client, field, value):
    response = register(client, **{field: value})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]


@pytest.mark.parametrize("missing", ["display_name", "email", "password"])
def test_register_names_the_missing_field(client, missing):
    body = dict(DETAILS)
    del body[missing]
    response = client.post(REGISTER, json=body)
    assert response.json()["detail"][0]["loc"] == ["body", missing]


def test_register_rejects_unknown_fields(client):
    assert register(client, is_active=False).status_code == 422
