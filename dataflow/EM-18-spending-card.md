# EM-18: Dashboard Filters and Summaries in One Spending Card

This document explains how EM-18 regrouped the dashboard so the filters and the summaries they drive share one card. The requests and the URL filters are unchanged. It builds on [EM-6-dashboard-summary.md](EM-6-dashboard-summary.md) and [EM-9-month-start-day.md](EM-9-month-start-day.md).

Design references: [frontend.md](../planning/references/frontend.md), [testing.md](../planning/references/testing.md).

## 1. Before and after

Before, the filters (period, custom dates, category chips, applied dates and Reset in a footer) sat in one card, and Personal and each family sat in separate cards below. Nothing tied the controls to the data.

```
Before                                   After
┌ Filters card ───────────────┐          ┌ Spending ─────────────────── [Reset] ┐
│ period, chips               │          │ 15 Oct – 14 Nov 2026 · All categories│
│ applied dates      [Reset]  │          │ period, chips  (Filters region)      │
└─────────────────────────────┘          │ ──────────────────────────────────── │
┌ Personal ┐ ┌ Family ┐                  │ ┌ Personal ┐ ┌ Family ┐  (panels)    │
└──────────┘ └────────┘                  │ └──────────┘ └────────┘              │
Budgets                                  └──────────────────────────────────────┘
                                         Budgets (unchanged, own section)
```

## 2. Changes

| Part | Code | Change |
|---|---|---|
| Card | `frontend/src/pages/Dashboard/Dashboard.jsx` | One `SectionCard` named by the "Spending" heading (`useId`) wraps `DashboardFilters`, a shadcn `Separator` and the summary grid. The loading skeleton has the same shape |
| Filters | `frontend/src/pages/Dashboard/DashboardFilters.jsx` | No card of its own. Renders the h2 "Spending", the applied dates and Reset at the top, then a `section` labelled "Filters" with the period toggle, custom dates and chips. The old footer is gone; its text and Reset moved to the header |
| Summaries | `frontend/src/pages/Dashboard/SummaryPanel.jsx` (was `SummaryCard.jsx`) | An inset `section` (`rounded-lg border bg-muted/40 p-4`) with an h3 heading instead of a card with an h2. Loading, empty state, error and Retry are unchanged |

Reset stays inside `DashboardFilters` because it also clears that component's own state (the open custom range and its error).

## 3. Data flow (unchanged)

```
URL ?from&to&category ─► Dashboard parseFilters(searchParams, month_start_day)
                           │
                           ├─► DashboardFilters (header + controls) ── onChange/onReset ─► setSearchParams
                           │
                           └─► SummaryPanel x (1 + families) ── GET /api/reports/summary each
```

## 4. Accessibility

- Headings: h1 page, h2 "Spending" and "Budgets", h3 for each summary panel and budget group.
- Regions: "Spending" (the card), "Filters", and one per summary named by its heading ("Personal", the family name), so screen reader users and the existing tests still find each summary by name.

## 5. Layout

| Width | Layout |
|---|---|
| Phone (<768px) | Header with Reset beside the title, period toggle in a 2x2 grid, chips wrap, panels stack |
| 768px and up | Panels side by side (`auto-fill`, at least 18rem each) inside the card |

Checked in light and dark at 360, 768 and 1440px; no horizontal scroll, and touch targets stay at least 44px.

## 6. Tests

- `Dashboard.test.jsx`: "groups the filters and a Personal summary followed by one per family in one Spending card" checks the Spending region holds the h2, the Period and Categories filters, Reset, and the h3 panels in order. "shows only the Personal summary without families" covers the single-panel case. Both failed before the change.
- Playwright: all 55 end-to-end tests pass, including the responsive checks and the EM-16 card-width check.
