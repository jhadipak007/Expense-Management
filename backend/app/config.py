"""Application settings read from environment variables and `.env`."""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    """All configuration for the app. No other module reads the environment."""

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    environment: Literal["local", "test", "production"] = "local"
    use_postgresql_db: bool = False
    sqlite_path: str = "db/expense_sarathi.db"
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "expense_sarathi"
    db_user: str = "expense"
    db_password: SecretStr = SecretStr("")
    jwt_secret: SecretStr
    access_token_minutes: int = 10
    refresh_token_idle_minutes: int = 30  # keep equal to IDLE_MINUTES in frontend/src/auth/useIdleLogout.js
    registration_otp: str = "2211"  # fixed until codes are sent by email
    registration_minutes: int = 10
    registration_max_attempts: int = 5
    cookie_secure: bool = True
    allowed_hosts: list[str] = ["localhost", "127.0.0.1"]
    enable_api_docs: bool = False
    log_level: str = "INFO"
    frontend_dist_dir: str = "frontend/dist"

    @computed_field
    @property
    def database_url(self) -> URL:
        """SQLAlchemy URL for SQLite or PostgreSQL, selected by `use_postgresql_db`."""
        if not self.use_postgresql_db:
            return URL.create("sqlite+pysqlite", database=self.sqlite_path)
        return URL.create(
            "postgresql+psycopg",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    return Settings()
