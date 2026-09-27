from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.base import InputModel


class RegisterIn(InputModel):
    """Sign-up details, submitted before the OTP step."""

    display_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value: str) -> str:
        """bcrypt only uses the first 72 bytes, so the limit is in bytes."""
        if not 8 <= len(value.encode()) <= 72:
            raise ValueError("Password must be 8 to 72 bytes")
        return value


class RegistrationOut(BaseModel):
    registration_id: str


class VerifyRegistrationIn(InputModel):
    registration_id: str = Field(min_length=1, max_length=100)
    code: str = Field(pattern=r"^\d{4}$")


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
