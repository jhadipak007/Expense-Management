# EM-20: Clearly Selected View and Period

EM-20 makes the selected option of the app's segmented switches obvious. It is a styling change only: no data, API or state changes. The decision is in [planning/decisions.md](../planning/decisions.md).

## 1. What changed

Before, the selected option was white on a light grey bar, which was hard to tell apart from the others. Now it is filled with the primary colour and has bold text:

```
Transactions page:   [#### Transactions ####][  Audit log  ]
Dashboard:           [# This month #][ Last month ][ This year ][ Custom ]
                       primary fill, bold primary-foreground text; others unchanged
```

| Control | File | Selected classes |
|---|---|---|
| Transactions / Audit log (`Tabs`) | `frontend/src/pages/Transactions/Transactions.jsx` (`TAB`) | `data-[state=active]:bg-primary! text-primary-foreground! font-semibold border-transparent!` |
| Dashboard period (`ToggleGroup`) | `frontend/src/pages/Dashboard/DashboardFilters.jsx` | `data-[state=on]:bg-primary! text-primary-foreground! font-semibold shadow-sm` |

The `!` (important) modifier is needed because the shadcn trigger and toggle carry their own `dark:` and `hover:` active styles, which class merging does not replace. The colours come from the theme tokens, so the dark theme uses its own primary (`#6aa2dc` with dark text).

## 2. Data flow

Unchanged. The selected state still comes from the URL: `?view=audit` for the tab (Radix sets `data-state="active"` and `aria-selected`), and the `from`/`to` dates for the period (`data-state="on"`, `aria-checked`).

## 3. Tests

- Playwright `e2e/selected-state.spec.js`, in the light and dark themes: the selected period and the active tab have the primary background and primary-foreground text, the other option does not, and switching to Audit log moves the fill. Colours are polled because the controls fade between states. It failed on the previous build and passes on this one.
- The full Vitest (228) and Playwright (63) suites pass.
