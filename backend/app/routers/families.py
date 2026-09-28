"""Family routes: create, list and view families; owner-only search and invitations."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.deps import CurrentUser, DbSession, get_current_user
from app.routers.invitations import InvitationId, invitation_errors
from app.schemas.family import (
    FamilyDetailOut, FamilyIn, FamilyOut, UserSearchOut, UserSearchQuery,
)
from app.schemas.invitation import FamilyInvitationOut, InvitationIn
from app.services import family_service, invitation_service
from app.services.family_access import FamilyNotFound, NotFamilyOwner

router = APIRouter(prefix="/api/families", tags=["families"],
                   dependencies=[Depends(get_current_user)])

FamilyId = Annotated[int, Path(gt=0)]


@contextmanager
def family_access_errors() -> Iterator[None]:
    """Map membership failures: not a member -> 404, member but not owner -> 403."""
    try:
        yield
    except FamilyNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family not found")
    except NotFamilyOwner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the family owner can do this")


@router.get("")
def list_families(user: CurrentUser, db: DbSession) -> list[FamilyOut]:
    return [FamilyOut.from_membership(m) for m in family_service.list_my_families(db, user.id)]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_family(body: FamilyIn, user: CurrentUser, db: DbSession) -> FamilyOut:
    return FamilyOut.from_membership(family_service.create_family(db, user.id, body.name))


@router.get("/{family_id}")
def get_family(family_id: FamilyId, user: CurrentUser, db: DbSession) -> FamilyDetailOut:
    with family_access_errors():
        family, role = family_service.get_family(db, family_id, user.id)
    return FamilyDetailOut.from_family(family, role)


@router.get("/{family_id}/user-search")
def search_users(family_id: FamilyId, query: Annotated[UserSearchQuery, Query()],
                 user: CurrentUser, db: DbSession) -> UserSearchOut:
    """Owner only. Name results show a masked email; an email result shows the email searched for."""
    with family_access_errors():
        users, has_more = family_service.search_users(
            db, family_id, user.id, email=query.email, name=query.name)
    return UserSearchOut.from_users(users, has_more, mask=query.name is not None)


@router.get("/{family_id}/invitations")
def list_invitations(family_id: FamilyId, user: CurrentUser,
                     db: DbSession) -> list[FamilyInvitationOut]:
    """Owner only: open invitations, with sent and expiry dates."""
    with family_access_errors():
        invitations = invitation_service.list_family_invitations(db, family_id, user.id)
    return [FamilyInvitationOut.from_invitation(i) for i in invitations]


@router.post("/{family_id}/invitations", status_code=status.HTTP_201_CREATED)
def invite(family_id: FamilyId, body: InvitationIn, user: CurrentUser,
           db: DbSession) -> FamilyInvitationOut:
    with family_access_errors(), invitation_errors():
        invitation = invitation_service.invite(db, family_id, user.id, body.user_id)
    return FamilyInvitationOut.from_invitation(invitation)


@router.delete("/{family_id}/invitations/{invitation_id}",
               status_code=status.HTTP_204_NO_CONTENT)
def cancel_invitation(family_id: FamilyId, invitation_id: InvitationId, user: CurrentUser,
                      db: DbSession) -> None:
    """Owner only: cancel an invitation that is still open."""
    with family_access_errors(), invitation_errors():
        invitation_service.cancel(db, family_id, user.id, invitation_id)
