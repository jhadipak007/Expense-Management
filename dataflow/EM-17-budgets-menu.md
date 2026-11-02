# EM-17 Data Flow: Budgets in the Menu

EM-17 adds a Budgets item to the main menu and a `/budgets` page. It is frontend only: the page reuses the dashboard's budgets section and the existing `GET /api/budgets` (see [EM-7-budgets.md](EM-7-budgets.md)). Decisions are in [planning/decisions.md](../planning/decisions.md).

## 1. Overview

```
Menu: Dashboard · Budgets · Transactions · Families · Settings
                     │
                     ▼
/budgets  (pages/Budgets/Budgets.jsx)
  GET /api/categories + /api/families   (listCategoriesAndFamilies)
  └─ BudgetsSection asPage
       GET /api/budgets?today=           (h1 "Budgets", groups, filters, Edit/Delete)
       Create budget / Edit ──► /budgets/new | /budgets/:id/edit   state { returnTo: '/budgets' }
                                   │
                                   ▼
                          BudgetPage: save or "Back to budgets" ──► /budgets

/ (Dashboard) ── BudgetsSection (no state) ──► BudgetPage ──► / with the dashboard filters (unchanged)
```

| Part | File | Change |
|---|---|---|
| Menu | `frontend/src/components/Nav/Nav.jsx` | Budgets link (`PiggyBankIcon`) to `/budgets`, without `end`, so it is active on `/budgets/new` and `/budgets/:id/edit` too |
| Route | `frontend/src/routes.jsx` | `/budgets` → `Budgets` |
| Page | `frontend/src/pages/Budgets/Budgets.jsx` | Loads categories and families (skeleton, error with Retry), then renders `BudgetsSection asPage` |
| Section | `frontend/src/pages/Dashboard/BudgetsSection.jsx` | `asPage`: `PageHeader` (h1) instead of the h2; Create/Edit links become `{ to, state }` props, with `state.returnTo` on the page |
| Item | `frontend/src/pages/Dashboard/BudgetItem.jsx` | Edit link spreads `{ to, state }` |
| Form page | `frontend/src/pages/Budgets/BudgetPage.jsx` | Reads `location.state.returnTo`: back and after-save target is `/budgets` with "Back to budgets", otherwise the dashboard with its query string |
| Header | `frontend/src/components/SectionCard.jsx` | `PageHeader` takes an `id` for `aria-labelledby` |

## 2. Returning after Create/Edit

The return target travels in the router's history state, not the URL, so the dashboard's filter query string stays as it was. A direct visit to `/budgets/new` (no state) returns to the dashboard, as before EM-17. The browser keeps history state on reload, so reloading the form still returns to the Budgets page.

## 3. Tests

- Vitest: `pages/Budgets/Budgets.test.jsx` (page title and groups, return after create and after Back from edit); `components/Nav/Nav.test.jsx` (menu order, Budgets active on `/budgets/new`). The dashboard and budget page tests are unchanged and pass.
- Playwright: `e2e/budgets.spec.js` opens Budgets from the phone drawer at 360px, creates a budget and comes back to `/budgets`, checks no sideways scroll, and Back to budgets from Edit.
- `Transactions.test.jsx`: the file's first test now allows 3 seconds for its cold start, like the budget tests; the extra test file made it miss the 1 second default in every full run.
