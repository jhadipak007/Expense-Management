# EM-19 Data Flow: Transactions and the Audit Trail

This document explains what EM-19 added and how data moves when a user lists a space's transactions, opens one, edits, deletes or restores it, and reads the audit log. It builds on the expense tables from [EM-5-add-expense.md](EM-5-add-expense.md) and the summaries from [EM-6-dashboard-summary.md](EM-6-dashboard-summary.md).

Design references: [data_model.md](../planning/references/data_model.md) (expenses, expense_audit, access rules), [api_design.md](../planning/references/api_design.md) (Expenses), [frontend.md](../planning/references/frontend.md) (Transactions), [database.md](../planning/references/database.md) (migration 0007), [logging.md](../planning/references/logging.md) (domain events).

## 1. Overview

```
 Browser                                                    FastAPI (/api/expenses)
┌──────────── /transactions?space=3&view=audit&q=milk&page=2 ───────────┐
│ Space [Jha Household ▾]   [Transactions | Audit log]                   │
│ Spent from / to · Created by|Performed by · Search · Category chips    │   GET /?family_id=3&q=milk&limit=25&offset=25
│ (audit: action chips)                    [Clear all filters]           │ ─────────────────► transaction_service.list_transactions
│ ─────────────────────────────────────────────────────────────────────  │   GET /audit-log?...&action=deleted
│ rows ─► /transactions/:id (query string kept)      [Previous] Page 2 [Next]│ ─────────────────► transaction_service.list_audit_log
└────────────────────────────────────────────────────────────────────────┘
 /transactions/:id ─► GET /{id}                       ─► transaction_service.get_transaction (history, last change, can_edit)
   Edit (in place)  ─► PATCH /{id}                    ─► expense_service.update_expense  ┐
   Delete (confirm) ─► DELETE /{id}                   ─► expense_service.delete_expense  ├► audit_service.record (same commit)
   Restore          ─► POST /{id}/restore             ─► expense_service.restore_expense ┘
 Add expense        ─► POST /                         ─► expense_service.create_expense  ─► record(created)
```

| Part | Code | Role |
|---|---|---|
| Model | `backend/app/models/expense_audit.py` | `ExpenseAudit`, `AuditAction` (created, updated, deleted, restored) |
| Soft delete | `backend/app/models/expense.py` | `deleted_at`, `is_active` hybrid, `history` relationship (ordered by id) |
| Migration | `backend/alembic/versions/0007_create_expense_audit.py` | `expense_audit` table, `expenses.deleted_at` (plain ALTER), backfill of `created` rows |
| Audit writes | `backend/app/services/audit_service.py` | `record()` adds a row without committing; `diff()` gives changed fields as display text |
| Changes | `backend/app/services/expense_service.py` | create / update / delete / restore; recorder check (`NotRecorder`), state check (`ExpenseStateConflict`) |
| Reads | `backend/app/services/transaction_service.py` | list, audit log, detail; shared `_space_conditions` |
| Helpers | `services/pagination.py`, `services/text_search.py`, `schemas/page.py` | `fetch_page` (limit + 1), `contains` (escaped ILIKE), `PageQuery` / `Page[T]` |
| Schemas | `backend/app/schemas/transaction.py`, `schemas/expense.py` | filters, `TransactionOut`, `AuditEntryOut`, `AuditLogEntryOut`, `TransactionDetailOut`; `ExpenseFields` → `ExpenseIn` / `ExpenseUpdateIn` |
| Routes | `backend/app/routers/expenses.py` | list, audit log, detail, PATCH, DELETE, restore; 403 / 409 mapping |
| Page | `frontend/src/pages/Transactions/` | `Transactions`, `TransactionFilters`, `TransactionList`, `AuditLogList` (both through `PagedList`), `TransactionDetail`, `auditDisplay`, `transactionFilters.js` |
| Shared UI | `frontend/src/components/` | `CategoryChips` (from the dashboard), `PaginationBar`, `ui/tabs` |

## 2. The audit trail

Every action on an expense adds one `expense_audit` row in the same commit as the change, so the expense and its history never disagree:

1. The service loads the expense with `get_expense` (visibility: own personal, or a member of its family). Not visible: `ExpenseNotFound` → 404.
2. Changes need the recorder: `_recorded_by` raises `NotRecorder` → 403 for other family members.
3. The state must fit: editing or deleting a deleted expense, or restoring a live one, raises `ExpenseStateConflict` → 409.
4. Update only: category and currency are checked (422), then `audit_service.diff` compares the old and new values as display text (`"12.50"`, category name, ISO date). No difference: return 200 with no row. Otherwise the fields are set and the diff is stored as `changes = {field: [old, new]}`.
5. `audit_service.record` adds the row; `db.commit()` saves both; the service logs `expense created|updated|deleted|restored` with ids only.

Nothing else writes the table, and no route reads it except through the space and expense visibility rules. Migration 0007 backfilled a `created` row for every earlier expense, by its recorder at its `created_at`.

Soft delete: `deleted_at` is set or cleared. `Expense.is_active` is added to the report summary and budget spending queries, and the transaction list, so a deleted expense stops counting at once. The detail and audit log keep showing it with a Deleted badge.

## 3. Reading a space

`_space_conditions(db, user_id, query)` builds the shared filter: `require_member` when a family is chosen (404 if not a member, so leaving a family removes access on the next request), then `scope_condition` (personal = the user's own personal expenses; family = every expense shared with it), expense-date bounds, categories and `contains(Expense.description, q)`.

- List: live expenses only, member filter on the recorder, ordered `spent_on DESC, id DESC`, eager-loading category and user.
- Audit log: `expense_audit JOIN expenses` with the same conditions (deleted included), member filter on who acted, optional actions, ordered `id DESC`, eager-loading the actor and the expense with its category.
- Both use `fetch_page`: `LIMIT limit + 1 OFFSET offset`; the extra row only sets `has_more`.
- Detail: `TransactionOut` plus `history` (oldest first), `last_modified_by/at` from the newest row unless it is `created`, and `can_edit` (viewer is the recorder).

## 4. The page

- `parseFilters(searchParams)` turns the URL into `{space, view, from, to, categoryIds, member, q, actions, page}`, dropping invalid values and a reversed date range. `toSearchParams` writes it back; `changeFilters` resets `page` to 1 and drops `member` with a new space; `clearFilters` keeps only space and view; `toApiParams` maps to the API names with `offset = (page - 1) * 25`.
- `Transactions` wraps the space select, filters and list in `Tabs` (the list is the `TabsContent` of the active view). It memoises the parsed filters on the search params, so `TransactionList` / `AuditLogList` reload (through `useAsyncList`, which aborts a stale request) only when the URL changes. Categories and families load once; the member select loads the chosen family's members with `GET /api/families/{id}`.
- `TransactionDetail` loads the transaction and the form options together. Edit swaps the fields for `ExpenseForm` with `expense` (values prefilled, Share with shown but not editable, no `family_id` sent). After Save, Delete or Restore it shows a toast and reloads, so the history and last change refresh. A 403/409 detail is shown inline.
- Timestamps arrive in UTC and show in the viewer's time zone (`formatDateTime`); expense dates are plain dates (`formatIsoDate`).

## 5. Tests

- Backend: `tests/integration/test_expense_changes.py` (audit rows per action, diff, no-op edit, 403/404/409/422, deleted left out of reports and budgets), `test_transactions.py` (spaces, ordering, pages, every filter including LIKE wildcards and injection text, audit log ordering and filters, leaving a family, no audit write routes), `test_domain_logs.py`, `test_budgets.py`; unit `test_audit_service.py`, `test_transaction_schemas.py`. Migration 0007 is applied and reverted by the test session, and its backfill was checked on a database holding a pre-0007 expense.
- Frontend: `transactionFilters.test.js`, `Transactions.test.jsx`, `TransactionDetail.test.jsx`, the Nav active-link case.
- E2E: `e2e/transactions.spec.js` (list → edit → delete → restore → audit log; CSP checked around each step, only the known `AlertDialog` message appears) and the transactions case in `responsive.spec.js` at 360, 768 and 1440px.

## 6. Decisions

- Non-members get **404**, not the 403 in the story, matching every other family route so family ids cannot be probed.
- List and audit-log date filters use the expense date (time-zone safe); the list sorts by expense date.
- No payment method field; the space of an expense cannot change after creation.
- "Last modified" is derived from the audit trail rather than stored on `expenses`.
