from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app.models import RefreshToken
from app.models.base import utcnow
from app.routers.auth import REFRESH_COOKIE
from tests.conftest import DEFAULT_PASSWORD

LOGIN = "/api/auth/login"
REFRESH = "/api/auth/refresh"
LOGOUT = "/api/auth/logout"


def login(client, email="priya@example.com", password=DEFAULT_PASSWORD):
    return client.post(LOGIN, json={"email": email, "password": password})


def use_cookie(client, token):
    """Make `token` the only refresh cookie the client sends."""
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, token)


def refresh_with(client, token):
    use_cookie(client, token)
    return client.post(REFRESH)


def test_login_returns_access_token_and_sets_refresh_cookie(client, make_user):
    make_user()
    response = login(client)
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Path=/api/auth" in cookie
    assert "SameSite=strict" in cookie and "Max-Age=1800" in cookie


def test_login_email_is_case_insensitive(client, make_user):
    make_user()
    assert login(client, email="PRIYA@Example.com").status_code == 200


@pytest.mark.parametrize("email,password", [
    ("priya@example.com", "wrong-password"),
    ("nobody@example.com", DEFAULT_PASSWORD),
    ("not-an-email", DEFAULT_PASSWORD),
])
def test_failed_login_gives_one_generic_message(client, make_user, email, password):
    make_user()
    response = login(client, email=email, password=password)
    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password"}


def test_inactive_user_cannot_log_in(client, make_user):
    make_user(is_active=False)
    assert login(client).status_code == 401


@pytest.mark.parametrize("missing", ["email", "password"])
def test_login_names_the_missing_field(client, missing):
    body = {"email": "priya@example.com", "password": DEFAULT_PASSWORD}
    del body[missing]
    response = client.post(LOGIN, json=body)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", missing]


def test_login_rejects_unknown_fields(client):
    body = {"email": "a@b.com", "password": "x", "is_admin": True}
    assert client.post(LOGIN, json=body).status_code == 422


def test_refresh_rotates_the_token(client, make_user):
    make_user()
    first = login(client).cookies[REFRESH_COOKIE]
    response = refresh_with(client, first)
    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.cookies[REFRESH_COOKIE] != first


def test_refresh_extends_the_idle_window(client, make_user, db):
    make_user()
    raw = login(client).cookies[REFRESH_COOKIE]
    db.execute(update(RefreshToken).values(expires_at=utcnow() + timedelta(minutes=1)))
    refresh_with(client, raw)
    newest = db.scalars(select(RefreshToken).order_by(RefreshToken.id.desc())).first()
    assert newest.expires_at > utcnow() + timedelta(minutes=29)


def test_refresh_without_cookie_is_rejected(client):
    assert client.post(REFRESH).status_code == 401


def test_refresh_with_unknown_token_is_rejected_and_clears_cookie(client):
    response = refresh_with(client, "unknown-token")
    assert response.status_code == 401
    assert 'refresh_token=""' in response.headers["set-cookie"]


def test_refresh_with_expired_token_is_rejected(client, make_user, db):
    make_user()
    raw = login(client).cookies[REFRESH_COOKIE]
    db.execute(update(RefreshToken).values(expires_at=utcnow() - timedelta(seconds=1)))
    assert refresh_with(client, raw).status_code == 401


def test_reusing_a_refresh_token_revokes_all_tokens(client, make_user, db):
    make_user()
    first = login(client).cookies[REFRESH_COOKIE]
    second = refresh_with(client, first).cookies[REFRESH_COOKIE]
    assert refresh_with(client, first).status_code == 401
    assert refresh_with(client, second).status_code == 401
    assert db.scalar(select(RefreshToken).where(RefreshToken.is_active)) is None


def test_refresh_fails_for_deactivated_user(client, make_user, db):
    user = make_user()
    raw = login(client).cookies[REFRESH_COOKIE]
    user.is_active = False
    db.commit()
    assert refresh_with(client, raw).status_code == 401


def test_logout_revokes_the_token_and_clears_cookie(client, make_user):
    make_user()
    raw = login(client).cookies[REFRESH_COOKIE]
    use_cookie(client, raw)
    response = client.post(LOGOUT)
    assert response.status_code == 204
    assert 'refresh_token=""' in response.headers["set-cookie"]
    assert refresh_with(client, raw).status_code == 401


@pytest.mark.parametrize("cookie", [None, "unknown-token"])
def test_logout_always_succeeds(client, cookie):
    if cookie:
        use_cookie(client, cookie)
    response = client.post(LOGOUT)
    assert response.status_code == 204
    assert 'refresh_token=""' in response.headers["set-cookie"]


def test_logout_with_already_revoked_token_succeeds(client, make_user):
    make_user()
    raw = login(client).cookies[REFRESH_COOKIE]
    use_cookie(client, raw)
    client.post(LOGOUT)
    use_cookie(client, raw)
    assert client.post(LOGOUT).status_code == 204
