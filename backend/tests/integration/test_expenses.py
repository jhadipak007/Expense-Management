"""Expenses: record personal and family expenses, and who can see them."""

from sqlalchemy import func, select

from app.models import Expense

NEW_EXPENSE = {"amount": "12.50", "currency": "AUD", "category_id": 1,
               "spent_on": "2026-09-01", "description": "Weekly shop"}


def expense_count(db) -> int:
    return db.scalar(select(func.count()).select_from(Expense))


def test_categories_are_seeded_with_colors(client, make_user, auth_headers):
    response = client.get("/api/categories", headers=auth_headers(make_user()))
    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "Grocery", "color": "#8aa84a"},
        {"id": 2, "name": "Eating Out", "color": "#e08e5a"},
        {"id": 3, "name": "Trips", "color": "#3a9e84"},
    ]


def test_create_personal_expense(client, make_user, auth_headers):
    user = make_user()
    response = client.post("/api/expenses", json=NEW_EXPENSE, headers=auth_headers(user))
    assert response.status_code == 201
    body = response.json()
    assert body["amount"] == "12.50"
    assert body["currency"] == "AUD"
    assert body["category"]["name"] == "Grocery"
    assert body["spent_on"] == "2026-09-01"
    assert body["description"] == "Weekly shop"
    assert body["family_id"] is None
    assert body["user_id"] == user.id


def test_amount_and_currency_are_saved_as_entered(client, make_user, auth_headers):
    body = client.post("/api/expenses", json=NEW_EXPENSE | {"amount": "1999.9", "currency": "INR"},
                       headers=auth_headers(make_user())).json()
    assert (body["amount"], body["currency"]) == ("1999.90", "INR")


def test_member_can_share_expense_with_family(client, make_user, make_family, auth_headers):
    owner = make_user()
    member = make_user(email="ravi@example.com", display_name="Ravi")
    family = make_family(owner, members=[member])
    response = client.post("/api/expenses", json=NEW_EXPENSE | {"family_id": family.id},
                           headers=auth_headers(member))
    assert response.status_code == 201
    assert response.json()["family_id"] == family.id


def test_sharing_with_a_family_i_am_not_in_returns_404(client, db, make_user, make_family,
                                                       auth_headers):
    family = make_family(make_user())
    outsider = make_user(email="ravi@example.com", display_name="Ravi")
    response = client.post("/api/expenses", json=NEW_EXPENSE | {"family_id": family.id},
                           headers=auth_headers(outsider))
    assert response.status_code == 404
    assert expense_count(db) == 0


def test_sharing_with_an_unknown_family_returns_404(client, db, make_user, auth_headers):
    response = client.post("/api/expenses", json=NEW_EXPENSE | {"family_id": 999},
                           headers=auth_headers(make_user()))
    assert response.status_code == 404
    assert expense_count(db) == 0


def test_unknown_category_is_a_field_error(client, db, make_user, auth_headers):
    response = client.post("/api/expenses", json=NEW_EXPENSE | {"category_id": 999},
                           headers=auth_headers(make_user()))
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "category_id"]
    assert expense_count(db) == 0


def test_client_supplied_user_id_is_rejected(client, db, make_user, auth_headers):
    user = make_user()
    other = make_user(email="ravi@example.com", display_name="Ravi")
    response = client.post("/api/expenses", json=NEW_EXPENSE | {"user_id": other.id},
                           headers=auth_headers(user))
    assert response.status_code == 422
    assert expense_count(db) == 0


def test_invalid_amount_returns_422_on_the_amount_field(client, db, make_user, auth_headers):
    headers = auth_headers(make_user())
    for amount in ("0", "-5", "abc", "1.234"):
        response = client.post("/api/expenses", json=NEW_EXPENSE | {"amount": amount},
                               headers=headers)
        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == ["body", "amount"]
    assert expense_count(db) == 0


def test_future_date_is_rejected(client, make_user, auth_headers):
    response = client.post("/api/expenses", json=NEW_EXPENSE | {"spent_on": "2999-01-01"},
                           headers=auth_headers(make_user()))
    assert response.status_code == 422


def test_sql_injection_in_text_is_stored_as_plain_text(client, db, make_user, auth_headers):
    payload = "'; DROP TABLE expenses;--"
    response = client.post("/api/expenses", json=NEW_EXPENSE | {"description": payload},
                           headers=auth_headers(make_user()))
    assert response.status_code == 201
    assert response.json()["description"] == payload
    assert expense_count(db) == 1


def test_sql_injection_in_typed_fields_is_rejected(client, db, make_user, auth_headers):
    headers = auth_headers(make_user())
    for field in ("category_id", "family_id", "amount", "currency"):
        response = client.post("/api/expenses", json=NEW_EXPENSE | {field: "1 OR 1=1"},
                               headers=headers)
        assert response.status_code == 422
    assert client.get("/api/expenses/1 OR 1=1", headers=headers).status_code == 422
    assert expense_count(db) == 0


def test_create_requires_a_token(client):
    assert client.post("/api/expenses", json=NEW_EXPENSE).status_code == 401


def test_recorder_sees_own_personal_expense(client, make_user, make_expense, auth_headers):
    user = make_user()
    expense = make_expense(user)
    response = client.get(f"/api/expenses/{expense.id}", headers=auth_headers(user))
    assert response.status_code == 200
    assert response.json()["id"] == expense.id


def test_personal_expense_is_hidden_from_family_members(client, make_user, make_family,
                                                        make_expense, auth_headers):
    owner = make_user()
    member = make_user(email="ravi@example.com", display_name="Ravi")
    make_family(owner, members=[member])
    expense = make_expense(owner)
    assert client.get(f"/api/expenses/{expense.id}",
                      headers=auth_headers(member)).status_code == 404


def test_family_expense_is_visible_to_every_member(client, make_user, make_family,
                                                   make_expense, auth_headers):
    owner = make_user()
    member = make_user(email="ravi@example.com", display_name="Ravi")
    family = make_family(owner, members=[member])
    expense = make_expense(member, family=family)
    for user in (owner, member):
        assert client.get(f"/api/expenses/{expense.id}",
                          headers=auth_headers(user)).status_code == 200


def test_family_expense_is_hidden_from_non_members(client, make_user, make_family,
                                                   make_expense, auth_headers):
    owner = make_user()
    family = make_family(owner)
    expense = make_expense(owner, family=family)
    outsider = make_user(email="ravi@example.com", display_name="Ravi")
    assert client.get(f"/api/expenses/{expense.id}",
                      headers=auth_headers(outsider)).status_code == 404


def test_unknown_expense_returns_404(client, make_user, auth_headers):
    assert client.get("/api/expenses/999", headers=auth_headers(make_user())).status_code == 404
