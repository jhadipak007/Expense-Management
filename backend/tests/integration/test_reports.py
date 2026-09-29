"""Report summary: totals for personal or one family's expenses, by currency then category."""

from datetime import date

import pytest

SEPTEMBER = {"date_from": "2026-09-01", "date_to": "2026-09-30"}


def summary(client, headers, **params):
    return client.get("/api/reports/summary", params=SEPTEMBER | params, headers=headers)


@pytest.fixture
def household(make_user, make_family):
    """Priya owns a family that Ravi is in; Asha is in no family."""
    priya = make_user()
    ravi = make_user(email="ravi@example.com", display_name="Ravi")
    asha = make_user(email="asha@example.com", display_name="Asha")
    return priya, ravi, asha, make_family(priya, members=[ravi])


def test_personal_summary_has_only_my_personal_expenses(client, household, make_expense,
                                                        auth_headers):
    priya, ravi, _, family = household
    make_expense(priya, amount="10.00")
    make_expense(priya, family=family, amount="99.00")
    make_expense(ravi, amount="50.00")
    body = summary(client, auth_headers(priya)).json()
    assert body == {"currencies": [{
        "currency": "AUD", "total": "10.00",
        "categories": [{"category_id": 1, "name": "Grocery", "color": "#8aa84a",
                        "total": "10.00"}],
    }]}


def test_family_summary_includes_every_members_expenses(client, household, make_expense,
                                                        auth_headers):
    priya, ravi, _, family = household
    make_expense(priya, family=family, amount="20.00")
    make_expense(ravi, family=family, amount="5.50")
    make_expense(ravi, amount="1000.00")
    for user in (priya, ravi):
        body = summary(client, auth_headers(user), family_id=family.id).json()
        assert body["currencies"][0]["total"] == "25.50"


def test_non_member_gets_404_for_a_family(client, household, make_expense, auth_headers):
    priya, _, asha, family = household
    make_expense(priya, family=family)
    assert summary(client, auth_headers(asha), family_id=family.id).status_code == 404
    assert summary(client, auth_headers(asha), family_id=999).status_code == 404


def test_currencies_are_never_added_together(client, household, make_expense, auth_headers):
    priya = household[0]
    make_expense(priya, amount="12450.00", currency="INR")
    make_expense(priya, amount="85.00", currency="USD")
    make_expense(priya, category="Trips", amount="15.00", currency="USD")
    body = summary(client, auth_headers(priya)).json()
    assert [(c["currency"], c["total"]) for c in body["currencies"]] == [
        ("INR", "12450.00"), ("USD", "100.00")]
    usd = body["currencies"][1]["categories"]
    assert [(c["name"], c["total"]) for c in usd] == [("Grocery", "85.00"), ("Trips", "15.00")]


def test_totals_are_exact(client, household, make_expense, auth_headers):
    priya = household[0]
    for _ in range(10):
        make_expense(priya, amount="0.10")
    make_expense(priya, amount="0.20")
    assert summary(client, auth_headers(priya)).json()["currencies"][0]["total"] == "1.20"


def test_date_range_includes_both_ends(client, household, make_expense, auth_headers):
    priya = household[0]
    for day, amount in [(date(2026, 8, 31), "1.00"), (date(2026, 9, 1), "2.00"),
                        (date(2026, 9, 30), "4.00"), (date(2026, 10, 1), "8.00")]:
        make_expense(priya, spent_on=day, amount=amount)
    assert summary(client, auth_headers(priya)).json()["currencies"][0]["total"] == "6.00"


def test_category_filter_keeps_only_selected_categories(client, household, make_expense,
                                                        auth_headers):
    priya = household[0]
    make_expense(priya, category="Grocery", amount="1.00")
    make_expense(priya, category="Eating Out", amount="2.00")
    make_expense(priya, category="Trips", amount="4.00")
    body = summary(client, auth_headers(priya), category_id=[1, 3]).json()
    usd = body["currencies"][0]
    assert usd["total"] == "5.00"
    assert [c["name"] for c in usd["categories"]] == ["Grocery", "Trips"]


def test_no_matching_expenses_gives_no_currencies(client, household, make_expense, auth_headers):
    priya = household[0]
    make_expense(priya, category="Trips")
    body = summary(client, auth_headers(priya), category_id=[1]).json()
    assert body == {"currencies": []}


def test_from_after_to_returns_422(client, household, auth_headers):
    response = client.get("/api/reports/summary", headers=auth_headers(household[0]),
                          params={"date_from": "2026-09-30", "date_to": "2026-09-01"})
    assert response.status_code == 422


@pytest.mark.parametrize("params", [
    {"family_id": "1 OR 1=1"}, {"category_id": "'; DROP TABLE expenses;--"},
    {"date_from": "2026-09-01' OR '1'='1"},
])
def test_injection_payloads_are_rejected(client, household, auth_headers, params):
    assert summary(client, auth_headers(household[0]), **params).status_code == 422


def test_summary_requires_a_token(client):
    assert client.get("/api/reports/summary", params=SEPTEMBER).status_code == 401
