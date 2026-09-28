from datetime import datetime

from pydantic import BaseModel, Field

from app.models import FamilyInvitation
from app.schemas.base import InputModel


class InvitationIn(InputModel):
    user_id: int = Field(gt=0)


class FamilyInvitationOut(BaseModel):
    """An open invitation as the family owner sees it."""

    id: int
    invitee_id: int
    invitee_name: str
    created_at: datetime
    expires_at: datetime

    @classmethod
    def from_invitation(cls, invitation: FamilyInvitation) -> "FamilyInvitationOut":
        return cls(id=invitation.id, invitee_id=invitation.invitee_id,
                   invitee_name=invitation.invitee.display_name,
                   created_at=invitation.created_at, expires_at=invitation.expires_at)


class MyInvitationOut(BaseModel):
    """An open invitation as the invitee sees it."""

    id: int
    family_id: int
    family_name: str
    inviter_name: str
    expires_at: datetime

    @classmethod
    def from_invitation(cls, invitation: FamilyInvitation) -> "MyInvitationOut":
        return cls(id=invitation.id, family_id=invitation.family_id,
                   family_name=invitation.family.name,
                   inviter_name=invitation.inviter.display_name,
                   expires_at=invitation.expires_at)
