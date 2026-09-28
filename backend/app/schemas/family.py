from typing import Self

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models import Family, FamilyMember, FamilyRole, User
from app.schemas.base import InputModel


class FamilyIn(InputModel):
    name: str = Field(min_length=1, max_length=100)


class FamilyOut(BaseModel):
    """A family as seen by one user, with that user's role in it."""

    id: int
    name: str
    role: FamilyRole

    @classmethod
    def from_membership(cls, membership: FamilyMember) -> "FamilyOut":
        return cls(id=membership.family_id, name=membership.family.name, role=membership.role)


class MemberOut(BaseModel):
    user_id: int
    display_name: str
    email: str
    role: FamilyRole


class FamilyDetailOut(FamilyOut):
    """A family with its members, owners first, then by name."""

    members: list[MemberOut]

    @classmethod
    def from_family(cls, family: Family, role: FamilyRole) -> "FamilyDetailOut":
        members = sorted(family.members,
                         key=lambda m: (m.role != FamilyRole.owner, m.user.display_name.lower()))
        return cls(id=family.id, name=family.name, role=role, members=[
            MemberOut(user_id=m.user_id, display_name=m.user.display_name,
                      email=m.user.email, role=m.role)
            for m in members
        ])


class UserSearchQuery(InputModel):
    """Search by exact `email` or by at least 3 characters of `name`; exactly one is given."""

    email: EmailStr | None = None
    name: str | None = Field(default=None, min_length=3, max_length=100)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str | None) -> str | None:
        return value.lower() if value else value

    @model_validator(mode="after")
    def exactly_one(self) -> Self:
        if (self.email is None) == (self.name is None):
            raise ValueError("Give either email or name")
        return self


class UserResultOut(BaseModel):
    user_id: int
    display_name: str
    email: str


class UserSearchOut(BaseModel):
    results: list[UserResultOut]
    has_more: bool

    @classmethod
    def from_users(cls, users: list[User], has_more: bool, mask: bool) -> "UserSearchOut":
        return cls(has_more=has_more, results=[
            UserResultOut(user_id=u.id, display_name=u.display_name,
                          email=mask_email(u.email) if mask else u.email)
            for u in users
        ])


def mask_email(email: str) -> str:
    """Keep the first character and the domain: `dipak@gmail.com` -> `d****@gmail.com`."""
    local, domain = email.split("@", 1)
    return f"{local[0]}****@{domain}"
