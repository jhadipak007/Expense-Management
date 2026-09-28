"""Family invitations: the owner invites and cancels, the invitee accepts or declines.

Every change of status is one conditional UPDATE that only matches an open
invitation, so when a cancel and an accept race, exactly one of them wins.
"""

from datetime import timedelta

from sqlalchemy import ColumnElement, select, update
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.models import FamilyInvitation, FamilyMember, FamilyRole, InvitationStatus, User
from app.models.base import utcnow
from app.services.family_access import require_owner


class UserNotFound(Exception):
    """No active user has this id."""


class AlreadyMember(Exception):
    """The user already belongs to the family."""


class AlreadyInvited(Exception):
    """The user already has an open invitation to the family."""


class InvitationNotFound(Exception):
    """No such invitation for this family or this invitee."""


class InvitationNotOpen(Exception):
    """The invitation was accepted, declined, cancelled or has expired."""


def invite(db: Session, family_id: int, owner_id: int, invitee_id: int) -> FamilyInvitation:
    """Invite an active user who is not yet a member and has no open invitation."""
    require_owner(db, family_id, owner_id)
    invitee = db.get(User, invitee_id)
    if invitee is None or not invitee.is_active:
        raise UserNotFound
    if db.get(FamilyMember, (family_id, invitee_id)) is not None:
        raise AlreadyMember
    already_invited = select(FamilyInvitation.id).where(
        FamilyInvitation.family_id == family_id,
        FamilyInvitation.invitee_id == invitee_id,
        FamilyInvitation.is_open,
    )
    if db.scalar(already_invited) is not None:
        raise AlreadyInvited
    sent = utcnow()
    invitation = FamilyInvitation(
        family_id=family_id, invitee_id=invitee_id, invited_by=owner_id, created_at=sent,
        expires_at=sent + timedelta(days=get_settings().invitation_days),
    )
    db.add(invitation)
    db.commit()
    return invitation


def list_family_invitations(db: Session, family_id: int, owner_id: int) -> list[FamilyInvitation]:
    """The family's open invitations, oldest first, with invitees loaded."""
    require_owner(db, family_id, owner_id)
    return list(db.scalars(
        select(FamilyInvitation)
        .where(FamilyInvitation.family_id == family_id, FamilyInvitation.is_open)
        .options(selectinload(FamilyInvitation.invitee))
        .order_by(FamilyInvitation.created_at, FamilyInvitation.id)
    ))


def cancel(db: Session, family_id: int, owner_id: int, invitation_id: int) -> None:
    require_owner(db, family_id, owner_id)
    _close(db, invitation_id, InvitationStatus.cancelled, FamilyInvitation.family_id == family_id)
    db.commit()


def list_my_invitations(db: Session, user_id: int) -> list[FamilyInvitation]:
    """Open invitations sent to the user, oldest first, with family and inviter loaded."""
    return list(db.scalars(
        select(FamilyInvitation)
        .where(FamilyInvitation.invitee_id == user_id, FamilyInvitation.is_open)
        .options(selectinload(FamilyInvitation.family), selectinload(FamilyInvitation.inviter))
        .order_by(FamilyInvitation.created_at, FamilyInvitation.id)
    ))


def accept(db: Session, invitation_id: int, user_id: int) -> FamilyMember:
    """Close the invitation and add the user to the family in one transaction."""
    invitation = _close(db, invitation_id, InvitationStatus.accepted,
                        FamilyInvitation.invitee_id == user_id)
    membership = FamilyMember(family_id=invitation.family_id, user_id=user_id,
                              role=FamilyRole.member)
    db.add(membership)
    db.commit()
    return membership


def decline(db: Session, invitation_id: int, user_id: int) -> None:
    _close(db, invitation_id, InvitationStatus.declined, FamilyInvitation.invitee_id == user_id)
    db.commit()


def _close(db: Session, invitation_id: int, status: InvitationStatus,
           belongs: ColumnElement[bool]) -> FamilyInvitation:
    """Move an open invitation to `status`; the caller commits.

    `belongs` limits which invitations the caller may act on; any other id is
    reported as not found.
    """
    invitation = db.scalar(
        select(FamilyInvitation).where(FamilyInvitation.id == invitation_id, belongs))
    if invitation is None:
        raise InvitationNotFound
    closed = db.execute(
        update(FamilyInvitation)
        .where(FamilyInvitation.id == invitation_id, FamilyInvitation.is_open)
        .values(status=status)
    ).rowcount
    if not closed:
        raise InvitationNotOpen
    return invitation
