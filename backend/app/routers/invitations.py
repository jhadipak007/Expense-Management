"""Invitee routes: list my open invitations, accept or decline one."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.deps import CurrentUser, DbSession, get_current_user
from app.schemas.family import FamilyOut
from app.schemas.invitation import MyInvitationOut
from app.services import invitation_service as service

router = APIRouter(prefix="/api/invitations", tags=["invitations"],
                   dependencies=[Depends(get_current_user)])

InvitationId = Annotated[int, Path(gt=0)]


@contextmanager
def invitation_errors() -> Iterator[None]:
    """Map invitation failures to 404 / 409 responses."""
    try:
        yield
    except service.UserNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    except service.AlreadyMember:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This person is already a member of the family")
    except service.AlreadyInvited:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This person already has a pending invitation to the family")
    except service.InvitationNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    except service.InvitationNotOpen:
        raise HTTPException(status.HTTP_409_CONFLICT, "This invitation is no longer available")


@router.get("")
def list_my_invitations(user: CurrentUser, db: DbSession) -> list[MyInvitationOut]:
    return [MyInvitationOut.from_invitation(i) for i in service.list_my_invitations(db, user.id)]


@router.post("/{invitation_id}/accept")
def accept(invitation_id: InvitationId, user: CurrentUser, db: DbSession) -> FamilyOut:
    """Join the family; returns it with the user's new role."""
    with invitation_errors():
        membership = service.accept(db, invitation_id, user.id)
    return FamilyOut.from_membership(membership)


@router.post("/{invitation_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline(invitation_id: InvitationId, user: CurrentUser, db: DbSession) -> None:
    with invitation_errors():
        service.decline(db, invitation_id, user.id)
