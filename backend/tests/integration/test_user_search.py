"""Owner searches for users to invite, by exact email or by part of a name."""

import pytest


@pytest.fixture
def owner_family(make_user, make_family):
    owner = make_user(email="owner@example.com", display_name="Owner Dipak")
    return owner, make_family(owner)


def search(client, auth_headers, owner, family, **params):
    return client.get(f"/api/families/{family.id}/user-search", params=params,
                      headers=auth_headers(owner))


def test_email_search_finds_exact_match(client, make_user, auth_headers, owner_family):
    owner, family = owner_family
    ravi = make_user(email="ravi@example.com", display_name="Ravi")
    response = search(client, auth_headers, owner, family, email="Ravi@Example.com")
    assert response.status_code == 200
    assert response.json() == {"has_more": False, "results": [
        {"user_id": ravi.id, "display_name": "Ravi", "email": "ravi@example.com"}]}


def test_partial_email_finds_nobody(client, make_user, auth_headers, owner_family):
    owner, family = owner_family
    make_user(email="ravi@example.com")
    response = search(client, auth_headers, owner, family, email="ravi@example.co")
    assert response.json() == {"has_more": False, "results": []}


def test_name_search_matches_part_of_name_with_masked_email(
        client, make_user, auth_headers, owner_family):
    owner, family = owner_family
    ravi = make_user(email="ravi@example.com", display_name="Ravi Kumar")
    make_user(email="anita@example.com", display_name="Anita")
    response = search(client, auth_headers, owner, family, name="kum")
    assert response.json() == {"has_more": False, "results": [
        {"user_id": ravi.id, "display_name": "Ravi Kumar", "email": "r****@example.com"}]}


def test_name_search_needs_at_least_three_characters(client, auth_headers, owner_family):
    owner, family = owner_family
    response = search(client, auth_headers, owner, family, name="ra")
    assert response.status_code == 422


def test_search_needs_exactly_one_of_email_or_name(client, auth_headers, owner_family):
    owner, family = owner_family
    assert search(client, auth_headers, owner, family).status_code == 422
    both = search(client, auth_headers, owner, family, email="a@example.com", name="abc")
    assert both.status_code == 422


def test_name_search_returns_ten_and_reports_more(client, make_user, auth_headers, owner_family):
    owner, family = owner_family
    for i in range(11):
        make_user(email=f"sam{i:02}@example.com", display_name=f"Sam {i:02}")
    body = search(client, auth_headers, owner, family, name="sam").json()
    assert len(body["results"]) == 10
    assert body["has_more"] is True


def test_owner_is_never_in_results(client, auth_headers, owner_family):
    owner, family = owner_family
    by_name = search(client, auth_headers, owner, family, name="Dipak").json()
    by_email = search(client, auth_headers, owner, family, email="owner@example.com").json()
    assert by_name["results"] == by_email["results"] == []


def test_inactive_users_are_not_found(client, make_user, auth_headers, owner_family):
    owner, family = owner_family
    make_user(email="gone@example.com", display_name="Gone User", is_active=False)
    assert search(client, auth_headers, owner, family, name="Gone").json()["results"] == []


def test_like_wildcards_match_literally(client, make_user, auth_headers, owner_family):
    owner, family = owner_family
    make_user(email="ravi@example.com", display_name="Ravi")
    for payload in ("%%%", "___", "' OR 1=1 --"):
        assert search(client, auth_headers, owner, family, name=payload).json()["results"] == []


def test_member_cannot_search(client, make_user, make_family, auth_headers):
    owner = make_user()
    member = make_user(email="ravi@example.com")
    family = make_family(owner, members=[member])
    response = search(client, auth_headers, member, family, name="Priya")
    assert response.status_code == 403
    assert response.json() == {"detail": "Only the family owner can do this"}


def test_non_member_search_is_not_found(client, make_user, auth_headers, owner_family):
    _, family = owner_family
    outsider = make_user(email="out@example.com")
    assert search(client, auth_headers, outsider, family, name="Owner").status_code == 404
