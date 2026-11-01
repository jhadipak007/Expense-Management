from pydantic import Field

from app.schemas.base import InputModel


class ClientLogIn(InputModel):
    """One browser error. Lengths are capped so a client cannot flood the logs."""

    message: str = Field(min_length=1, max_length=1000)
    stack: str | None = Field(default=None, max_length=5000)
    url: str = Field(max_length=500)
    request_id: str | None = Field(default=None, max_length=64)


class ClientLogsIn(InputModel):
    entries: list[ClientLogIn] = Field(min_length=1, max_length=10)
