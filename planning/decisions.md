# Implementation Decisions

Important implementation decisions and why they were made. Newest first. Add an entry when a choice shapes later work, overrides the Jira text, or picks one option over a reasonable alternative.

Format:

```
## YYYY-MM-DD — <JIRA-KEY> — <decision in a few words>
- **Decision:** what we chose.
- **Why:** the reasoning.
- **Alternatives:** what we rejected (optional).
```

## 2026-11-02 — EM-20 — Selected segment is filled with the primary colour
- **Decision:** The active Transactions / Audit log tab and the dashboard's selected period (This month, Last month, This year, Custom) are filled `bg-primary` with bold `text-primary-foreground`. Other segmented controls should follow the same pattern.
- **Why:** The previous white-on-grey selected look was too subtle to tell which view was on. The user asked for one shared pattern across both switches. The primary pair already meets contrast in both themes (it is the primary button).
- **Alternatives:** A light primary tint with a 3px underline, like the active menu link (softer); changing only the Transactions tab.

## 2026-11-02 — EM-17 — Budgets goes right after Dashboard in the menu
- **Decision:** Menu order is Dashboard, Budgets, Transactions, Families, Settings.
- **Why:** The story placed Budgets between Dashboard and Families, written before Transactions existed; the user chose to put it directly after Dashboard.
- **Alternatives:** After Transactions.

## 2026-11-02 — EM-17 — One budgets section for the dashboard and the Budgets page
- **Decision:** `/budgets` renders the dashboard's `BudgetsSection` with `asPage`, which shows an h1 "Budgets" title instead of the section's h2. The dashboard section is unchanged.
- **Why:** The story asks to reuse the section rather than duplicate it, and a page should have one h1 without showing "Budgets" twice.

## 2026-11-02 — EM-17 — Create/Edit budget return through router state
- **Decision:** Links from the Budgets page carry router state `{ returnTo: '/budgets' }`. `BudgetPage` goes back there ("Back to budgets"); without it, it returns to the dashboard with its filters as before.
- **Why:** Keeps the dashboard's filter query string free of a navigation flag, and the browser keeps history state on reload.
- **Alternatives:** A `?from=budgets` query parameter, which survives a copied URL but mixes into the filter query string.

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
