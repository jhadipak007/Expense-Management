"""Editing, deleting and restoring expenses, and the audit rows each action writes."""

from datetime import date

from sqlalchemy import select

from app.models import ExpenseAudit

EDIT = {"amount": "15", "currency": "AUD", "category_id": 2,
        "spent_on": "2026-09-02", "description": "Dinner"}


def audit_rows(db, expense_id):
    return list(db.scalars(select(ExpenseAudit).where(ExpenseAudit.expense_id == expense_id)
                           .order_by(ExpenseAudit.id)))


def test_create_writes_a_created_entry(client, db, make_user, auth_headers):
    user = make_user()
    body = client.post("/api/expenses", headers=auth_headers(user), json={
        "amount": "12.50", "currency": "AUD", "category_id": 1, "spent_on": "2026-09-01"}).json()
    [row] = audit_rows(db, body["id"])
    assert (row.action, row.user_id, row.changes) == ("created", user.id, None)


def test_edit_saves_fields_and_audits_only_changed_ones(client, db, make_user, make_expense,
                                                        auth_headers):
    user = make_user()
    expense = make_expense(user)
    response = client.patch(f"/api/expenses/{expense.id}", headers=auth_headers(user),
                            json=EDIT | {"currency": "AUD"})
    assert response.status_code == 200
    assert response.json()["amount"] == "15.00"
    assert response.json()["category"]["name"] == "Eating Out"
    [row] = audit_rows(db, expense.id)
    assert row.action == "updated"
    assert row.changes == {
        "amount": ["12.50", "15.00"],
        "category": ["Grocery", "Eating Out"],
        "spent_on": ["2026-09-01", "2026-09-02"],
        "description": [None, "Dinner"],
    }


def test_edit_that_changes_nothing_is_not_audited(client, db, make_user, make_expense,
                                                  auth_headers):
    user = make_user()
    expense = make_expense(user)
    same = {"amount": "12.5", "currency": "AUD", "category_id": 1, "spent_on": "2026-09-01"}
    assert client.patch(f"/api/expenses/{expense.id}", headers=auth_headers(user),
                        json=same).status_code == 200
    assert audit_rows(db, expense.id) == []


def test_space_cannot_be_changed_by_an_edit(client, make_user, make_expense, auth_headers):
    user = make_user()
    expense = make_expense(user)
    response = client.patch(f"/api/expenses/{expense.id}", headers=auth_headers(user),
                            json=EDIT | {"family_id": 1})
    assert response.status_code == 422


def test_edit_rejects_unknown_category(client, make_user, make_expense, auth_headers):
    user = make_user()
    expense = make_expense(user)
    response = client.patch(f"/api/expenses/{expense.id}", headers=auth_headers(user),
                            json=EDIT | {"category_id": 99})
    assert response.status_code == 422


def test_family_member_who_did_not_record_it_gets_403(client, make_user, make_family,
                                                       make_expense, auth_headers):
    owner = make_user()
    member = make_user(email="ravi@example.com", display_name="Ravi")
    expense = make_expense(owner, family=make_family(owner, members=[member]))
    headers = auth_headers(member)
    assert client.patch(f"/api/expenses/{expense.id}", headers=headers,
                        json=EDIT).status_code == 403
    assert client.delete(f"/api/expenses/{expense.id}", headers=headers).status_code == 403


def test_hidden_expense_gets_404(client, make_user, make_expense, auth_headers):
    expense = make_expense(make_user())
    other = auth_headers(make_user(email="ravi@example.com"))
    assert client.patch(f"/api/expenses/{expense.id}", headers=other, json=EDIT).status_code == 404
    assert client.delete(f"/api/expenses/{expense.id}", headers=other).status_code == 404
    assert client.post(f"/api/expenses/{expense.id}/restore", headers=other).status_code == 404


def test_delete_and_restore_are_audited(client, db, make_user, make_expense, auth_headers):
    user = make_user()
    expense = make_expense(user)
    headers = auth_headers(user)
    assert client.delete(f"/api/expenses/{expense.id}", headers=headers).status_code == 204
    assert expense.deleted_at is not None
    assert client.get(f"/api/expenses/{expense.id}", headers=headers).status_code == 200
    assert client.post(f"/api/expenses/{expense.id}/restore", headers=headers).status_code == 204
    assert expense.deleted_at is None
    assert [r.action for r in audit_rows(db, expense.id)] == ["deleted", "restored"]


def test_actions_that_do_not_fit_the_state_get_409(client, make_user, make_expense,
                                                    auth_headers):
    user = make_user()
    expense = make_expense(user)
    headers = auth_headers(user)
    url = f"/api/expenses/{expense.id}"
    assert client.post(f"{url}/restore", headers=headers).status_code == 409
    client.delete(url, headers=headers)
    assert client.delete(url, headers=headers).status_code == 409
    assert client.patch(url, headers=headers, json=EDIT).status_code == 409


def test_deleted_expense_leaves_reports_and_budgets(client, make_user, make_expense,
                                                    auth_headers):
    user = make_user()
    headers = auth_headers(user)
    expense = make_expense(user, spent_on=date(2026, 9, 1))
    params = {"date_from": "2026-09-01", "date_to": "2026-09-30"}
    assert client.get("/api/reports/summary", params=params, headers=headers).json()["currencies"]
    client.delete(f"/api/expenses/{expense.id}", headers=headers)
    assert client.get("/api/reports/summary", params=params,
                      headers=headers).json() == {"currencies": []}
