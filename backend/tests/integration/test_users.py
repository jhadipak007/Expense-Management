from datetime import timedelta

import jwt
import pytest

from app.config import get_settings
from app.main import app
from app.models.base import utcnow

PUBLIC_PATHS = {
    "/api/health", "/api/auth/register", "/api/auth/register/verify",
    "/api/auth/login", "/api/auth/refresh", "/api/auth/logout",
}


def protected_routes():
    """Every (method, path) under /api except the public ones, read from the OpenAPI schema."""
    return [
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        if path not in PUBLIC_PATHS
        for method in operations
    ]


def test_me_returns_the_current_user(client, make_user, auth_headers):
    user = make_user()
    response = client.get("/api/users/me", headers=auth_headers(user))
    assert response.status_code == 200
    assert response.json() == {"id": user.id, "email": "priya@example.com", "display_name": "Priya"}


def test_me_never_returns_the_password_hash(client, make_user, auth_headers):
    user = make_user()
    assert "password_hash" not in client.get("/api/users/me", headers=auth_headers(user)).json()


def test_me_rejects_an_expired_access_token(client, make_user):
    user = make_user()
    now = utcnow()
    token = jwt.encode(
        {"sub": str(user.id), "type": "access", "iat": now - timedelta(minutes=11),
         "exp": now - timedelta(minutes=1)},
        get_settings().jwt_secret.get_secret_value(), algorithm="HS256",
    )
    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_me_rejects_an_inactive_user(client, make_user, auth_headers):
    user = make_user(is_active=False)
    assert client.get("/api/users/me", headers=auth_headers(user)).status_code == 401


def test_there_are_protected_routes_to_check():
    assert ("GET", "/api/users/me") in protected_routes()


@pytest.mark.parametrize("method,path", protected_routes())
def test_every_protected_route_requires_a_token(client, method, path):
    assert client.request(method, path).status_code == 401
