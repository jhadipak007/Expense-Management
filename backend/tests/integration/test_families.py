"""Families: create, list and view with members."""


def test_create_family_makes_the_creator_owner(client, make_user, auth_headers):
    user = make_user()
    response = client.post("/api/families", json={"name": "Jha Household"},
                           headers=auth_headers(user))
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Jha Household"
    assert body["role"] == "owner"


def test_created_family_appears_in_my_list(client, make_user, auth_headers):
    user = make_user()
    client.post("/api/families", json={"name": "Trip Crew"}, headers=auth_headers(user))
    families = client.get("/api/families", headers=auth_headers(user)).json()
    assert [(f["name"], f["role"]) for f in families] == [("Trip Crew", "owner")]


def test_family_name_must_not_be_blank(client, make_user, auth_headers):
    user = make_user()
    response = client.post("/api/families", json={"name": "   "}, headers=auth_headers(user))
    assert response.status_code == 422


def test_list_shows_only_my_families_with_my_role(client, make_user, make_family, auth_headers):
    owner = make_user()
    member = make_user(email="ravi@example.com", display_name="Ravi")
    make_family(owner, name="Shared", members=[member])
    make_family(owner, name="Owner only")
    families = client.get("/api/families", headers=auth_headers(member)).json()
    assert [(f["name"], f["role"]) for f in families] == [("Shared", "member")]


def test_user_can_belong_to_several_families(client, make_user, make_family, auth_headers):
    user = make_user()
    other = make_user(email="ravi@example.com", display_name="Ravi")
    make_family(user, name="Mine")
    make_family(other, name="Theirs", members=[user])
    families = client.get("/api/families", headers=auth_headers(user)).json()
    assert [(f["name"], f["role"]) for f in families] == [("Mine", "owner"), ("Theirs", "member")]


def test_member_sees_family_members_owner_first(client, make_user, make_family, auth_headers):
    owner = make_user(display_name="Zara")
    member = make_user(email="ravi@example.com", display_name="Ravi")
    family = make_family(owner, members=[member])
    response = client.get(f"/api/families/{family.id}", headers=auth_headers(member))
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "member"
    assert body["members"] == [
        {"user_id": owner.id, "display_name": "Zara", "email": "priya@example.com",
         "role": "owner"},
        {"user_id": member.id, "display_name": "Ravi", "email": "ravi@example.com",
         "role": "member"},
    ]


def test_non_member_cannot_view_family(client, make_user, make_family, auth_headers):
    family = make_family(make_user())
    outsider = make_user(email="out@example.com")
    response = client.get(f"/api/families/{family.id}", headers=auth_headers(outsider))
    assert response.status_code == 404
    assert response.json() == {"detail": "Family not found"}


def test_unknown_family_is_not_found(client, make_user, auth_headers):
    response = client.get("/api/families/999", headers=auth_headers(make_user()))
    assert response.status_code == 404


def test_family_id_must_be_a_positive_integer(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    assert client.get("/api/families/0", headers=headers).status_code == 422
    assert client.get("/api/families/1 OR 1=1", headers=headers).status_code == 422
