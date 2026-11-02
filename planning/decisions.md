# Implementation Decisions

Important implementation decisions and why they were made. Newest first. Add an entry when a choice shapes later work, overrides the Jira text, or picks one option over a reasonable alternative.

Format:

```
## YYYY-MM-DD — <JIRA-KEY> — <decision in a few words>
- **Decision:** what we chose.
- **Why:** the reasoning.
- **Alternatives:** what we rejected (optional).
```

## 2026-11-02 — EM-19 — Non-members get 404, not 403
- **Decision:** Family routes, including the transaction list and audit log, return 404 to non-members.
- **Why:** Matches every other family route, so nobody can find out which family ids exist.
- **Alternatives:** 403, as the story asked.

## 2026-11-02 — EM-19 — Soft delete with recorder-only changes
- **Decision:** Edit, delete and restore are in scope. Delete sets `expenses.deleted_at`. Only the person who recorded an expense can change it (403 for other members, 409 for a change that does not fit the state).
- **Why:** The audit log and history must keep showing a deleted expense, and a restore needs the row. Members can see each other's expenses but should not change them.
- **Alternatives:** Hard delete; any family member can edit.

## 2026-11-02 — EM-19 — Immutable audit trail written in the same commit
- **Decision:** Each create, edit, delete or restore adds one `expense_audit` row in the same commit as the change. No route writes or removes audit rows. "Last modified" is derived from the newest row, not stored on `expenses`.
- **Why:** The expense and its history can never disagree, and there is one source of truth for changes.

## 2026-11-02 — EM-19 — Backfill a "Created" row for existing expenses
- **Decision:** Migration 0007 adds a `created` audit row for each existing expense, by its recorder at its `created_at`.
- **Why:** Every expense then has a complete history, so the detail page and audit log need no special case.

## 2026-11-02 — EM-19 — Sort and filter by expense date
- **Decision:** The transaction list sorts by expense date (newest first), and the date filters in both the list and the audit log use the expense date.
- **Why:** Users think in terms of when they spent. Expense dates are plain dates, so filtering avoids time-zone edge cases.
- **Alternatives:** Sort and filter by when the row or audit entry was created.

## 2026-11-02 — EM-19 — No payment method field
- **Decision:** Expenses have no payment method, and the space (personal or family) cannot change after creation.
- **Why:** Not needed for the story; it can be added later as its own issue.
