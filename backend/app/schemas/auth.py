from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.base import InputModel


class LoginIn(InputModel):
    """Login credentials.

    `email` is a plain string so a malformed address gets the same generic
    "Incorrect email or password" answer as any other failed login.
    """

    email: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
