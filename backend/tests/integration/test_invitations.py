"""Invitations: the owner invites and cancels; the invitee lists, accepts and declines."""

from datetime import timedelta

import pytest
from sqlalchemy import update

from app.models import FamilyInvitation
from app.models.base import utcnow

NO_LONGER_AVAILABLE = {"detail": "This invitation is no longer available"}


@pytest.fixture
def owner(make_user):
    return make_user(email="owner@example.com", display_name="Dipak")


@pytest.fixture
def ravi(make_user):
    return make_user(email="ravi@example.com", display_name="Ravi")


@pytest.fixture
def family(make_family, owner):
    return make_family(owner, name="Jha Household")


@pytest.fixture
def invite(client, auth_headers, owner, family):
    """Send an invitation from the owner and return the response."""
    def _invite(invitee, by=owner, family_id=None):
        return client.post(f"/api/families/{family_id or family.id}/invitations",
                           json={"user_id": invitee.id}, headers=auth_headers(by))
    return _invite


def expire(db, invitation_id):
    db.execute(update(FamilyInvitation).where(FamilyInvitation.id == invitation_id)
               .values(expires_at=utcnow() - timedelta(seconds=1)))
    db.commit()


def my_invitations(client, auth_headers, user):
    return client.get("/api/invitations", headers=auth_headers(user)).json()


def pending(client, auth_headers, owner, family):
    return client.get(f"/api/families/{family.id}/invitations", headers=auth_headers(owner)).json()


# Sending


def test_invitation_appears_in_family_pending_list(invite, ravi, client, auth_headers, owner,
                                                  family):
    response = invite(ravi)
    assert response.status_code == 201
    body = response.json()
    assert body["invitee_id"] == ravi.id
    assert body["invitee_name"] == "Ravi"
    assert pending(client, auth_headers, owner, family) == [body]


def test_invitation_expires_seven_days_after_it_is_sent(invite, ravi, db):
    body = invite(ravi).json()
    invitation = db.get(FamilyInvitation, body["id"])
    assert invitation.expires_at - invitation.created_at == timedelta(days=7)


def test_cannot_invite_an_existing_member(make_user, make_family, owner, client, auth_headers):
    member = make_user(email="m@example.com")
    family = make_family(owner, members=[member])
    response = client.post(f"/api/families/{family.id}/invitations",
                           json={"user_id": member.id}, headers=auth_headers(owner))
    assert response.status_code == 409
    assert response.json() == {"detail": "This person is already a member of the family"}


def test_cannot_invite_someone_with_a_pending_invitation(invite, ravi):
    invite(ravi)
    response = invite(ravi)
    assert response.status_code == 409
    assert response.json() == {
        "detail": "This person already has a pending invitation to the family"}


def test_cannot_invite_owner_themself(invite, owner):
    assert invite(owner).status_code == 409


def test_cannot_invite_unknown_or_inactive_user(invite, make_user, client, auth_headers, owner,
                                                family):
    inactive = make_user(email="gone@example.com", is_active=False)
    assert invite(inactive).status_code == 404
    response = client.post(f"/api/families/{family.id}/invitations", json={"user_id": 999},
                           headers=auth_headers(owner))
    assert response.status_code == 404


def test_can_invite_again_after_decline_cancel_or_expiry(invite, ravi, client, auth_headers,
                                                         owner, family, db):
    first = invite(ravi).json()
    client.post(f"/api/invitations/{first['id']}/decline", headers=auth_headers(ravi))
    second = invite(ravi).json()
    client.delete(f"/api/families/{family.id}/invitations/{second['id']}",
                  headers=auth_headers(owner))
    third = invite(ravi).json()
    expire(db, third["id"])
    assert invite(ravi).status_code == 201


def test_member_cannot_invite(make_user, make_family, owner, ravi, client, auth_headers):
    member = make_user(email="m@example.com")
    family = make_family(owner, members=[member])
    response = client.post(f"/api/families/{family.id}/invitations",
                           json={"user_id": ravi.id}, headers=auth_headers(member))
    assert response.status_code == 403


def test_non_member_cannot_invite(make_user, invite, ravi):
    outsider = make_user(email="out@example.com")
    assert invite(ravi, by=outsider).status_code == 404


def test_member_cannot_list_family_invitations(make_user, make_family, owner, client,
                                               auth_headers):
    member = make_user(email="m@example.com")
    family = make_family(owner, members=[member])
    response = client.get(f"/api/families/{family.id}/invitations", headers=auth_headers(member))
    assert response.status_code == 403


# Cancelling


def test_owner_cancels_pending_invitation(invite, ravi, client, auth_headers, owner, family):
    invitation = invite(ravi).json()
    response = client.delete(f"/api/families/{family.id}/invitations/{invitation['id']}",
                             headers=auth_headers(owner))
    assert response.status_code == 204
    assert pending(client, auth_headers, owner, family) == []
    assert my_invitations(client, auth_headers, ravi) == []


def test_cannot_cancel_an_accepted_invitation(invite, ravi, client, auth_headers, owner, family):
    invitation = invite(ravi).json()
    client.post(f"/api/invitations/{invitation['id']}/accept", headers=auth_headers(ravi))
    response = client.delete(f"/api/families/{family.id}/invitations/{invitation['id']}",
                             headers=auth_headers(owner))
    assert response.status_code == 409


def test_member_cannot_cancel(make_user, make_family, owner, ravi, client, auth_headers):
    member = make_user(email="m@example.com")
    family = make_family(owner, members=[member])
    invitation = client.post(f"/api/families/{family.id}/invitations", json={"user_id": ravi.id},
                             headers=auth_headers(owner)).json()
    response = client.delete(f"/api/families/{family.id}/invitations/{invitation['id']}",
                             headers=auth_headers(member))
    assert response.status_code == 403


def test_cannot_cancel_another_familys_invitation(make_family, invite, ravi, client,
                                                  auth_headers, owner):
    other = make_family(owner, name="Other")
    invitation = invite(ravi).json()
    response = client.delete(f"/api/families/{other.id}/invitations/{invitation['id']}",
                             headers=auth_headers(owner))
    assert response.status_code == 404


# Receiving and responding


def test_invitee_sees_pending_invitation(invite, ravi, client, auth_headers, family):
    invitation = invite(ravi).json()
    assert my_invitations(client, auth_headers, ravi) == [{
        "id": invitation["id"], "family_id": family.id, "family_name": "Jha Household",
        "inviter_name": "Dipak", "expires_at": invitation["expires_at"],
    }]


def test_accept_makes_invitee_a_member(invite, ravi, client, auth_headers, family):
    invitation = invite(ravi).json()
    response = client.post(f"/api/invitations/{invitation['id']}/accept",
                           headers=auth_headers(ravi))
    assert response.status_code == 200
    assert response.json() == {"id": family.id, "name": "Jha Household", "role": "member"}
    members = client.get(f"/api/families/{family.id}", headers=auth_headers(ravi)).json()
    assert [m["display_name"] for m in members["members"]] == ["Dipak", "Ravi"]
    assert my_invitations(client, auth_headers, ravi) == []


def test_decline_removes_invitation_without_joining(invite, ravi, client, auth_headers, family):
    invitation = invite(ravi).json()
    response = client.post(f"/api/invitations/{invitation['id']}/decline",
                           headers=auth_headers(ravi))
    assert response.status_code == 204
    assert my_invitations(client, auth_headers, ravi) == []
    assert client.get(f"/api/families/{family.id}", headers=auth_headers(ravi)).status_code == 404


def test_accepting_a_cancelled_invitation_fails(invite, ravi, client, auth_headers, owner,
                                                family):
    invitation = invite(ravi).json()
    client.delete(f"/api/families/{family.id}/invitations/{invitation['id']}",
                  headers=auth_headers(owner))
    response = client.post(f"/api/invitations/{invitation['id']}/accept",
                           headers=auth_headers(ravi))
    assert response.status_code == 409
    assert response.json() == NO_LONGER_AVAILABLE
    assert client.get(f"/api/families/{family.id}", headers=auth_headers(ravi)).status_code == 404


def test_expired_invitation_is_hidden_and_cannot_be_accepted(invite, ravi, client, auth_headers,
                                                             owner, family, db):
    invitation = invite(ravi).json()
    expire(db, invitation["id"])
    assert my_invitations(client, auth_headers, ravi) == []
    assert pending(client, auth_headers, owner, family) == []
    response = client.post(f"/api/invitations/{invitation['id']}/accept",
                           headers=auth_headers(ravi))
    assert response.json() == NO_LONGER_AVAILABLE


def test_accepted_invitation_cannot_be_accepted_or_declined_again(invite, ravi, client,
                                                                  auth_headers):
    invitation = invite(ravi).json()
    client.post(f"/api/invitations/{invitation['id']}/accept", headers=auth_headers(ravi))
    for action in ("accept", "decline"):
        response = client.post(f"/api/invitations/{invitation['id']}/{action}",
                               headers=auth_headers(ravi))
        assert response.status_code == 409


def test_cannot_respond_to_someone_elses_invitation(invite, ravi, make_user, client,
                                                    auth_headers):
    invitation = invite(ravi).json()
    other = make_user(email="other@example.com")
    for action in ("accept", "decline"):
        response = client.post(f"/api/invitations/{invitation['id']}/{action}",
                               headers=auth_headers(other))
        assert response.status_code == 404
