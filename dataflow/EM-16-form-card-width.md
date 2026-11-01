# EM-16: Form Cards as Wide as the Dashboard Cards

This document explains why the Add expense and Create/Edit budget cards were narrower than the dashboard cards on wide screens, and what changed. No data flow changed: the forms send the same requests as before. It builds on [EM-5-add-expense.md](EM-5-add-expense.md) and [EM-7-budgets.md](EM-7-budgets.md).

Design references: [frontend.md](../planning/references/frontend.md) (responsive rules), [testing.md](../planning/references/testing.md).

## 1. The bug and its root cause

On a monitor, both form cards stopped well short of the right edge of the content column, while every dashboard card filled it.

Both pages passed `className="max-w-2xl"` (42rem, 672px) to `SectionCard`, and no dashboard card does. The new e2e check measured the first card on each page before the fix:

| Viewport | Dashboard card | Form card |
|---|---|---|
| 360px | same | same |
| 768px | 720px | 672px |
| 1440px | 1008px | 672px |

## 2. The fix

| Part | Code | Change |
|---|---|---|
| Add expense | `frontend/src/pages/Expenses/NewExpense.jsx` | `SectionCard` without `max-w-2xl` |
| Create/Edit budget | `frontend/src/pages/Budgets/BudgetPage.jsx` | `SectionCard` without `max-w-2xl` |
| Expense form | `frontend/src/pages/Expenses/ExpenseForm.jsx` | Share with sits in a `md:grid-cols-2` row, so it is half the row like the other selects instead of about 960px wide |

The forms already put paired fields two per row from 768px, so they now spread over the wider card. Description stays full width because it is free text. The budget form needed no change: its lone Period select already sits in a two-column grid.

Settings keeps its `max-w-2xl` card: it has a single field, and EM-9 rewrites that page.

## 3. Layout on each screen size

| Width | Card | Fields |
|---|---|---|
| Phone (<768px) | Full width, unchanged | One per row, unchanged |
| 768px and up | Fills the content column (up to 1008px beside the sidebar) | Two per row; Description full width |

## 4. Tests

`frontend/e2e/responsive.spec.js` "add expense and create budget cards are as wide as the dashboard cards", at 360, 768 and 1440px: it compares the first card's width on the dashboard, Add expense and `/budgets/new`. It failed at 768px and 1440px before the fix and passes after. The existing checks for no horizontal scroll and 44px touch targets still pass at every width.
