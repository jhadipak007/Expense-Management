"""Budgets: personal or family spending limits, each with its current period and spending."""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models import Expense
from app.models.base import utcnow
from app.services.budget_period import current_period

TODAY = utcnow().date()
LAST_YEAR = date(TODAY.year - 1, 6, 1)
NEW = {"period": "yearly", "amount": "100.00", "currency": "AUD"}


@pytest.fixture
def household(make_user, make_family):
    """Priya owns a family that Ravi is in; Asha is in no family."""
    priya = make_user()
    ravi = make_user(email="ravi@example.com", display_name="Ravi")
    asha = make_user(email="asha@example.com", display_name="Asha")
    return priya, ravi, asha, make_family(priya, members=[ravi])


@pytest.fixture
def api(client, auth_headers):
    """Call the budgets API as `user`, always sending today's date."""
    def _api(method, user, path="", json=None, today=TODAY):
        return client.request(method, f"/api/budgets{path}", json=json,
                              params={"today": str(today)}, headers=auth_headers(user))
    return _api


def create(api, user, today=TODAY, **fields):
    response = api("POST", user, json=NEW | fields, today=today)
    assert response.status_code == 201, response.json()
    return response.json()


def test_personal_budget_counts_only_matching_personal_expenses(api, household, make_expense):
    priya, ravi, _, family = household
    make_expense(priya, amount="30.00", spent_on=TODAY)
    make_expense(priya, category="Trips", amount="20.00", spent_on=TODAY)
    make_expense(priya, amount="7.00", currency="USD", spent_on=TODAY)
    make_expense(priya, family=family, amount="500.00", spent_on=TODAY)
    make_expense(priya, amount="900.00", spent_on=LAST_YEAR)
    make_expense(ravi, amount="800.00", spent_on=TODAY)
    budget = create(api, priya)
    assert budget | {"id": 0} == {
        "id": 0, "family_id": None, "category_id": None, "period": "yearly",
        "amount": "100.00", "currency": "AUD",
        "period_start": f"{TODAY.year}-01-01", "period_end": f"{TODAY.year}-12-31",
        "spent": "50.00", "remaining": "50.00", "over_by": "0.00", "status": "on_track",
        "can_manage": True,
    }


def test_category_budget_counts_only_its_category(api, household, make_expense):
    priya = household[0]
    make_expense(priya, amount="30.00", spent_on=TODAY)
    make_expense(priya, category="Trips", amount="20.00", spent_on=TODAY)
    assert create(api, priya, category_id=3)["spent"] == "20.00"


def test_deleted_expense_does_not_count(api, household, make_expense, db):
    priya = household[0]
    make_expense(priya, amount="30.00", spent_on=TODAY)
    make_expense(priya, amount="20.00", spent_on=TODAY).deleted_at = utcnow()
    db.commit()
    assert create(api, priya)["spent"] == "30.00"


def test_one_expense_counts_towards_several_budgets(api, household, make_expense):
    priya = household[0]
    make_expense(priya, amount="30.00", spent_on=TODAY)
    create(api, priya, category_id=1, period="weekly")
    create(api, priya, period="monthly")
    assert [b["spent"] for b in api("GET", priya).json()] == ["30.00", "30.00"]


def test_family_budget_counts_every_members_family_expenses(api, household, make_expense):
    priya, ravi, _, family = household
    make_expense(priya, family=family, amount="60.00", spent_on=TODAY)
    make_expense(ravi, family=family, amount="25.00", spent_on=TODAY)
    make_expense(ravi, amount="1000.00", spent_on=TODAY)
    budget = create(api, priya, family_id=family.id)
    assert (budget["spent"], budget["status"]) == ("85.00", "close")


@pytest.mark.parametrize("spent, status, remaining, over_by", [
    ("79.99", "on_track", "20.01", "0.00"), ("80.00", "close", "20.00", "0.00"),
    ("100.00", "close", "0.00", "0.00"), ("125.50", "over", "0.00", "25.50"),
])
def test_status_and_amounts_left(api, household, make_expense, spent, status, remaining, over_by):
    priya = household[0]
    make_expense(priya, amount=spent, spent_on=TODAY)
    budget = create(api, priya)
    assert (budget["status"], budget["remaining"], budget["over_by"]) == (status, remaining, over_by)


def test_members_see_family_budgets_but_only_the_owner_manages_them(api, household):
    priya, ravi, asha, family = household
    budget = create(api, priya, family_id=family.id)
    personal = create(api, priya)
    assert [(b["id"], b["can_manage"]) for b in api("GET", priya).json()] == [
        (budget["id"], True), (personal["id"], True)]
    assert [(b["id"], b["can_manage"]) for b in api("GET", ravi).json()] == [
        (budget["id"], False)]
    assert api("GET", asha).json() == []


def test_a_member_cannot_create_change_or_delete_family_budgets(api, household):
    priya, ravi, _, family = household
    budget = create(api, priya, family_id=family.id)
    path = f"/{budget['id']}"
    assert api("POST", ravi, json=NEW | {"family_id": family.id}).status_code == 403
    assert api("PATCH", ravi, path, json={"amount": "1", "period": "weekly"}).status_code == 403
    assert api("DELETE", ravi, path).status_code == 403
    assert api("GET", ravi, path).json()["amount"] == "100.00"


def test_hidden_budgets_and_families_return_404(api, household):
    priya, _, asha, family = household
    for budget in (create(api, priya), create(api, priya, family_id=family.id)):
        path = f"/{budget['id']}"
        assert api("GET", asha, path).status_code == 404
        assert api("PATCH", asha, path, json={"amount": "1", "period": "weekly"}).status_code == 404
        assert api("DELETE", asha, path).status_code == 404
    assert api("POST", asha, json=NEW | {"family_id": family.id}).status_code == 404
    assert api("POST", asha, json=NEW | {"family_id": 999}).status_code == 404


@pytest.mark.parametrize("fields", [{}, {"category_id": 1}])
def test_duplicate_budget_is_rejected(api, household, fields):
    priya, _, _, family = household
    create(api, priya, **fields)
    create(api, priya, family_id=family.id, **fields)
    for extra in ({}, {"family_id": family.id}):
        response = api("POST", priya, json=NEW | fields | extra | {"amount": "5"})
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]


def test_same_scope_can_differ_by_category_period_or_currency(api, household):
    priya = household[0]
    create(api, priya)
    create(api, priya, category_id=1)
    create(api, priya, period="weekly")
    create(api, priya, currency="INR")
    assert len(api("GET", priya).json()) == 4


def test_update_changes_amount_and_period_now(api, household, make_expense):
    priya = household[0]
    make_expense(priya, amount="90.00", spent_on=TODAY)
    budget = create(api, priya, amount="500")
    response = api("PATCH", priya, f"/{budget['id']}", json={"amount": "50", "period": "weekly"})
    assert response.status_code == 200
    body = response.json()
    week = current_period("weekly", TODAY, 1, TODAY)
    assert (body["amount"], body["period"], body["status"], body["over_by"]) == (
        "50.00", "weekly", "over", "40.00")
    assert (body["period_start"], body["period_end"]) == tuple(str(d) for d in week)


def test_switching_to_fortnightly_starts_a_fortnight_on_the_edit_day(api, household):
    priya = household[0]
    budget = create(api, priya, period="fortnightly", today=TODAY - timedelta(days=1))
    weekly = api("PATCH", priya, f"/{budget['id']}", json={"amount": "100", "period": "weekly"})
    assert weekly.status_code == 200
    body = api("PATCH", priya, f"/{budget['id']}",
               json={"amount": "100", "period": "fortnightly"}).json()
    assert (body["period_start"], body["period_end"]) == (
        str(TODAY), str(TODAY + timedelta(days=13)))


def test_fortnights_count_from_the_day_the_budget_is_created(api, household):
    yesterday = TODAY - timedelta(days=1)
    budget = create(api, household[0], period="fortnightly", today=yesterday)
    assert budget["period_start"] == str(yesterday)


def test_update_into_an_existing_combination_is_rejected(api, household):
    priya = household[0]
    create(api, priya, period="weekly")
    budget = create(api, priya)
    response = api("PATCH", priya, f"/{budget['id']}", json={"amount": "5", "period": "weekly"})
    assert response.status_code == 409
    assert api("GET", priya, f"/{budget['id']}").json()["period"] == "yearly"


def test_monthly_family_budget_follows_the_owners_start_day(api, household, db):
    priya, ravi, _, family = household
    priya.month_start_day, ravi.month_start_day = 1, 28
    db.commit()
    budget = create(api, priya, period="monthly", family_id=family.id)
    expected = tuple(str(d) for d in current_period("monthly", TODAY, 1, TODAY))
    for user in (priya, ravi):
        body = api("GET", user, f"/{budget['id']}").json()
        assert (body["period_start"], body["period_end"]) == expected


def test_monthly_budget_moves_when_the_start_day_changes(api, household, client, auth_headers):
    priya = household[0]
    budget = create(api, priya, period="monthly")
    client.patch("/api/users/me", json={"month_start_day": 28}, headers=auth_headers(priya))
    body = api("GET", priya, f"/{budget['id']}").json()
    assert body["period_start"] == str(current_period("monthly", TODAY, 28, TODAY)[0])


def test_delete_removes_the_budget_but_not_expenses(api, household, make_expense, db):
    priya = household[0]
    make_expense(priya, spent_on=TODAY)
    budget = create(api, priya)
    assert api("DELETE", priya, f"/{budget['id']}").status_code == 204
    assert api("GET", priya, f"/{budget['id']}").status_code == 404
    assert len(db.scalars(select(Expense)).all()) == 1


@pytest.mark.parametrize("fields, loc", [
    ({"amount": "0"}, "amount"), ({"amount": "-5"}, "amount"), ({"amount": "1.005"}, "amount"),
    ({"period": "daily"}, "period"), ({"currency": "aud"}, "currency"),
    ({"currency": "XYZ"}, "currency"), ({"category_id": 999}, "category_id"),
    ({"category_id": 0}, "category_id"), ({"family_id": 0}, "family_id"),
    ({"user_id": 2}, "user_id"),
])
def test_invalid_fields_are_rejected(api, household, fields, loc):
    priya = household[0]
    response = api("POST", priya, json=NEW | fields)
    assert response.status_code == 422
    assert [e["loc"][-1] for e in response.json()["detail"]] == [loc]
    assert api("GET", priya).json() == []


@pytest.mark.parametrize("missing", ["amount", "period", "currency"])
def test_required_fields(api, household, missing):
    body = {k: v for k, v in NEW.items() if k != missing}
    assert api("POST", household[0], json=body).status_code == 422


@pytest.mark.parametrize("days", [-2, 2])
def test_today_must_be_within_a_day_of_utc(api, household, days):
    response = api("GET", household[0], today=TODAY + timedelta(days=days))
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["query", "today"]


@pytest.mark.parametrize("path, today", [
    ("/1 OR 1=1", TODAY), ("/'; DROP TABLE budgets;--", TODAY), ("", "2026-01-01' OR '1'='1"),
])
def test_injection_payloads_are_rejected(api, household, path, today):
    assert api("GET", household[0], path, today=today).status_code == 422

