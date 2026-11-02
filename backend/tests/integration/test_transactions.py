"""Transactions: listing a space, one transaction with its history, and the audit log."""

from datetime import date

import pytest

EXPENSE = {"amount": "12.50", "currency": "AUD", "category_id": 1, "spent_on": "2026-09-01"}


@pytest.fixture
def household(make_user, make_family):
    """Priya owns a family that Ravi is in; Asha is in no family."""
    priya = make_user()
    ravi = make_user(email="ravi@example.com", display_name="Ravi")
    asha = make_user(email="asha@example.com", display_name="Asha")
    return priya, ravi, asha, make_family(priya, members=[ravi])


@pytest.fixture
def api(client, auth_headers):
    def _api(method, user, path="", **kwargs):
        return client.request(method, f"/api/expenses{path}", headers=auth_headers(user), **kwargs)
    return _api


def add(api, user, **fields):
    response = api("POST", user, json=EXPENSE | fields)
    assert response.status_code == 201
    return response.json()["id"]


def ids(response):
    assert response.status_code == 200, response.json()
    return [item["id"] for item in response.json()["items"]]


def test_personal_list_shows_only_own_personal_expenses(api, household):
    priya, ravi, _, family = household
    mine = add(api, priya)
    add(api, priya, family_id=family.id)
    add(api, ravi)
    response = api("GET", priya)
    assert ids(response) == [mine]
    item = response.json()["items"][0]
    assert item["created_by"] == {"id": priya.id, "display_name": "Priya"}
    assert item["created_at"].endswith(("Z", "+00:00"))
    assert response.json()["has_more"] is False


def test_family_list_shows_every_members_expenses(api, household):
    priya, ravi, _, family = household
    first = add(api, priya, family_id=family.id)
    second = add(api, ravi, family_id=family.id)
    assert ids(api("GET", ravi, params={"family_id": family.id})) == [second, first]


def test_non_member_cannot_see_a_family(api, household):
    priya, _, asha, family = household
    add(api, priya, family_id=family.id)
    for path in ("", "/audit-log"):
        assert api("GET", asha, path, params={"family_id": family.id}).status_code == 404


def test_list_is_latest_expense_date_first(api, household):
    priya = household[0]
    old = add(api, priya, spent_on="2026-08-01")
    new = add(api, priya, spent_on="2026-09-05")
    same_day_later = add(api, priya, spent_on="2026-09-05")
    assert ids(api("GET", priya)) == [same_day_later, new, old]


def test_pages(api, household):
    priya = household[0]
    added = [add(api, priya) for _ in range(3)]
    first = api("GET", priya, params={"limit": 2})
    assert ids(first) == added[:0:-1] and first.json()["has_more"] is True
    second = api("GET", priya, params={"limit": 2, "offset": 2})
    assert ids(second) == [added[0]] and second.json()["has_more"] is False


def test_filters(api, household):
    priya, ravi, _, family = household
    shop = add(api, priya, family_id=family.id, description="Weekly 100% shop")
    dinner = add(api, ravi, family_id=family.id, category_id=2, spent_on="2026-08-15",
                 description="Dinner")
    fam = {"family_id": family.id}
    assert ids(api("GET", priya, params=fam | {"date_from": "2026-08-20"})) == [shop]
    assert ids(api("GET", priya, params=fam | {"date_to": "2026-08-15"})) == [dinner]
    assert ids(api("GET", priya, params=fam | {"category_id": [2, 3]})) == [dinner]
    assert ids(api("GET", priya, params=fam | {"user_id": ravi.id})) == [dinner]
    assert ids(api("GET", priya, params=fam | {"q": "100%"})) == [shop]
    assert ids(api("GET", priya, params=fam | {"q": "_"})) == []
    assert ids(api("GET", priya, params=fam | {"q": "' OR 1=1 --"})) == []


@pytest.mark.parametrize("params", [
    {"date_from": "2026-09-02", "date_to": "2026-09-01"},
    {"user_id": 1},
    {"limit": 0}, {"limit": 101}, {"offset": -1},
])
def test_invalid_filters_get_422(api, household, params):
    assert api("GET", household[0], params=params).status_code == 422


def test_deleted_expense_leaves_the_list_but_keeps_its_detail(api, household):
    priya = household[0]
    expense_id = add(api, priya)
    api("DELETE", priya, f"/{expense_id}")
    assert ids(api("GET", priya)) == []
    detail = api("GET", priya, f"/{expense_id}").json()
    assert detail["deleted_at"] is not None


def test_detail_has_history_and_last_change(api, household):
    priya, ravi, _, family = household
    expense_id = add(api, priya, family_id=family.id)
    fresh = api("GET", ravi, f"/{expense_id}").json()
    assert [h["action"] for h in fresh["history"]] == ["created"]
    assert (fresh["last_modified_by"], fresh["last_modified_at"]) == (None, None)
    assert fresh["can_edit"] is False
    api("PATCH", priya, f"/{expense_id}", json=EXPENSE | {"amount": "20"})
    detail = api("GET", priya, f"/{expense_id}").json()
    assert detail["can_edit"] is True
    assert [h["action"] for h in detail["history"]] == ["created", "updated"]
    assert detail["history"][1]["changes"] == {"amount": ["12.50", "20.00"]}
    assert detail["history"][1]["performed_by"]["display_name"] == "Priya"
    assert detail["last_modified_by"]["id"] == priya.id
    assert detail["last_modified_at"] == detail["history"][1]["created_at"]


def test_audit_log_lists_every_action_newest_first(api, household):
    priya, ravi, _, family = household
    first = add(api, priya, family_id=family.id)
    second = add(api, ravi, family_id=family.id, category_id=3)
    api("DELETE", priya, f"/{first}")
    add(api, priya)
    response = api("GET", ravi, "/audit-log", params={"family_id": family.id})
    assert response.status_code == 200
    items = response.json()["items"]
    assert [(i["action"], i["expense"]["id"]) for i in items] == [
        ("deleted", first), ("created", second), ("created", first)]
    assert items[0]["expense"]["deleted_at"] is not None
    assert items[1]["expense"]["category"]["name"] == "Trips"
    assert items[1]["performed_by"]["display_name"] == "Ravi"


def test_audit_log_filters(api, household):
    priya, ravi, _, family = household
    expense_id = add(api, priya, family_id=family.id)
    add(api, ravi, family_id=family.id)
    api("DELETE", priya, f"/{expense_id}")
    fam = {"family_id": family.id}

    def actions(**params):
        response = api("GET", priya, "/audit-log", params=fam | params)
        assert response.status_code == 200
        return [(i["action"], i["performed_by"]["id"]) for i in response.json()["items"]]

    assert actions(action=["deleted"]) == [("deleted", priya.id)]
    assert actions(user_id=ravi.id) == [("created", ravi.id)]
    assert api("GET", priya, "/audit-log", params={"action": "bogus"}).status_code == 422


def test_personal_audit_log_is_private(api, household):
    priya, ravi, _, _ = household
    add(api, priya)
    assert api("GET", ravi, "/audit-log").json()["items"] == []
    assert len(api("GET", priya, "/audit-log").json()["items"]) == 1


def test_leaving_a_family_removes_access(api, household, db):
    priya, ravi, _, family = household
    expense_id = add(api, priya, family_id=family.id)
    [membership] = [m for m in family.members if m.user_id == ravi.id]
    db.delete(membership)
    db.commit()
    assert api("GET", ravi, params={"family_id": family.id}).status_code == 404
    assert api("GET", ravi, f"/{expense_id}").status_code == 404


def test_audit_log_has_no_write_routes(api, household):
    priya = household[0]
    for method in ("POST", "PATCH", "PUT", "DELETE"):
        assert api(method, priya, "/audit-log").status_code in (404, 405, 422)


def test_spent_on_date_filter_applies_to_audit_log(api, household):
    priya = household[0]
    add(api, priya, spent_on=str(date(2026, 8, 1)))
    assert api("GET", priya, "/audit-log", params={"date_from": "2026-09-01"}).json()["items"] == []
