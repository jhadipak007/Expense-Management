"""Families: create, list and show them, and find users for the owner to invite."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Family, FamilyMember, FamilyRole, User
from app.services.family_access import require_member, require_owner


def create_family(db: Session, user_id: int, name: str) -> FamilyMember:
    """Create a family with the user as owner; return the owner's membership."""
    family = Family(name=name, created_by=user_id)
    membership = FamilyMember(family=family, user_id=user_id, role=FamilyRole.owner)
    db.add(membership)
    db.commit()
    return membership


def list_my_families(db: Session, user_id: int) -> list[FamilyMember]:
    """The user's memberships, with their families, ordered by family name."""
    return list(db.scalars(
        select(FamilyMember)
        .join(FamilyMember.family)
        .where(FamilyMember.user_id == user_id)
        .options(selectinload(FamilyMember.family))
        .order_by(Family.name, Family.id)
    ))


def search_users(db: Session, family_id: int, owner_id: int, *, email: str | None = None,
                 name: str | None = None, limit: int = 10) -> tuple[list[User], bool]:
    """Find active users to invite, by exact email or by part of their name.

    Returns at most `limit` users and whether more matched. The owner is never
    returned.
    """
    require_owner(db, family_id, owner_id)
    query = select(User).where(User.is_active, User.id != owner_id)
    if email is not None:
        query = query.where(User.email == email)
    else:
        query = query.where(User.display_name.ilike(f"%{_escape_like(name)}%", escape="\\"))
    users = list(db.scalars(query.order_by(User.display_name, User.id).limit(limit + 1)))
    return users[:limit], len(users) > limit


def _escape_like(value: str) -> str:
    """Make LIKE wildcards in user input match literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def get_family(db: Session, family_id: int, user_id: int) -> tuple[Family, FamilyRole]:
    """The family with its members loaded, and the user's role in it."""
    role = require_member(db, family_id, user_id).role
    family = db.scalar(
        select(Family)
        .where(Family.id == family_id)
        .options(selectinload(Family.members).selectinload(FamilyMember.user))
        .execution_options(populate_existing=True)
    )
    return family, role
