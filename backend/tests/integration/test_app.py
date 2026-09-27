"""Health, security settings, frontend serving, migrations and the seed command."""

from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import get_settings
from app.main import SECURITY_HEADERS, add_frontend_routes, create_app
from app.models import User
from app.seed import TEST_USER_EMAIL, TEST_USER_PASSWORD, seed_test_user
from app.security import verify_password
from tests.conftest import alembic_config


def test_health_is_public(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_responses_carry_security_headers_and_no_store(client):
    headers = client.get("/api/health").headers
    for name, value in SECURITY_HEADERS.items():
        assert headers[name] == value
    assert headers["Cache-Control"] == "no-store"


def test_unknown_host_is_rejected(client):
    assert client.get("/api/health", headers={"Host": "evil.example"}).status_code == 400


def test_docs_are_disabled_when_setting_is_off(monkeypatch):
    monkeypatch.setattr(get_settings(), "enable_api_docs", False)
    with TestClient(create_app()) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404


def test_frontend_serves_files_and_falls_back_to_index(tmp_path):
    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "robots.txt").write_text("robots")
    app = create_app()
    add_frontend_routes(app, tmp_path)
    with TestClient(app) as client:
        assert client.get("/robots.txt").text == "robots"
        assert client.get("/reports").text == "<html>app</html>"
        assert client.get("/../secret").text == "<html>app</html>"
        assert client.get("/api/unknown").status_code == 404


def test_seed_creates_the_test_user_once(db):
    assert seed_test_user(db) is True
    assert seed_test_user(db) is False
    user = db.scalar(select(User).where(User.email == TEST_USER_EMAIL))
    assert verify_password(TEST_USER_PASSWORD, user.password_hash)
    assert db.scalar(select(func.count()).select_from(User)) == 1


def test_migrations_downgrade_and_upgrade_cleanly(engine):
    command.downgrade(alembic_config(), "base")
    command.upgrade(alembic_config(), "head")
