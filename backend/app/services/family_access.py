"""Membership checks shared by every family-scoped service.

A family the user does not belong to is reported as not found, so family ids
cannot be probed.
"""

from sqlalchemy.orm import Session

from app.models import FamilyMember, FamilyRole


class FamilyNotFound(Exception):
    """No such family, or the user is not a member of it."""


class NotFamilyOwner(Exception):
    """The user is a member of the family but not its owner."""


def require_member(db: Session, family_id: int, user_id: int) -> FamilyMember:
    """Return the user's membership of the family, or raise FamilyNotFound."""
    membership = db.get(FamilyMember, (family_id, user_id))
    if membership is None:
        raise FamilyNotFound
    return membership


def require_owner(db: Session, family_id: int, user_id: int) -> FamilyMember:
    """Return the owner's membership, or raise FamilyNotFound / NotFamilyOwner."""
    membership = require_member(db, family_id, user_id)
    if membership.role != FamilyRole.owner:
        raise NotFamilyOwner
    return membership
