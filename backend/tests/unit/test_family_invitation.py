from datetime import timedelta

import pytest

from app.models import FamilyInvitation, InvitationStatus
from app.models.base import utcnow


@pytest.mark.parametrize("status,expires_in,is_open", [
    (InvitationStatus.pending, timedelta(days=1), True),
    (InvitationStatus.pending, timedelta(seconds=-1), False),
    (InvitationStatus.cancelled, timedelta(days=1), False),
    (InvitationStatus.accepted, timedelta(days=1), False),
    (InvitationStatus.declined, timedelta(days=1), False),
])
def test_only_pending_unexpired_invitations_are_open(status, expires_in, is_open):
    invitation = FamilyInvitation(status=status, expires_at=utcnow() + expires_in)
    assert invitation.is_open is is_open
