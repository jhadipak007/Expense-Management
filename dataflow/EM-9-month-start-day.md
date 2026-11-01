# EM-9 Data Flow: Month Start Day Across the App

EM-7 added the Settings page and `users.month_start_day` for monthly budgets ([EM-7-budgets.md](EM-7-budgets.md)). EM-9 makes the same day drive the dashboard's month filters, applies a saved day without a reload, explains the setting, and asks before leaving Settings with unsaved changes. There is no backend or database change.

Design references: [frontend.md](../planning/references/frontend.md) (Dashboard summaries, Settings, Unsaved changes), [testing.md](../planning/references/testing.md).

## 1. Overview

```
 Settings                         AuthProvider (session.user)              Dashboard
┌──────────────────────┐        ┌───────────────────────────┐        ┌─────────────────────────────┐
│ Month start day [15]  │ PATCH  │ updateUser(savedUser)     │ useAuth│ parseFilters(url, 15)        │
│ "Your month runs from │ /api/  │   -> month_start_day = 15 │ ──────►│ This month = 15 Oct - 14 Nov │
│  the 15th to the 14th │ users/ │                           │        │ footer "15 Oct – 14 Nov 2026 │
│  of the next month."  │ me ───►│                           │        │  · All categories"           │
│ UnsavedChangesGuard   │        └───────────────────────────┘        │ GET /api/reports/summary?    │
└──────────────────────┘                                              │   date_from=…&date_to=…      │
                                                                      └─────────────────────────────┘
```

| Part | Code | Role |
|---|---|---|
| Month presets | `frontend/src/pages/Dashboard/dashboardFilters.js` | `presetRange(key, monthStartDay, today)`, `matchingPreset`, `parseFilters` take the day; `describeFilters` uses `formatPeriod` |
| Dashboard | `pages/Dashboard/Dashboard.jsx`, `DashboardFilters.jsx` | Reads `user.month_start_day` and passes it to the filters as a prop |
| Session user | `frontend/src/auth/AuthProvider.jsx` | New `updateUser(user)` in the context |
| Settings | `frontend/src/pages/Settings/Settings.jsx` | Reads the user from `useAuth()`, saves, calls `updateUser`, explains the day |
| Leave guard | `frontend/src/components/UnsavedChangesGuard.jsx` | `useBlocker` + `AlertDialog`, and `beforeunload` |

## 2. Month ranges on the dashboard

The reports API already takes explicit dates (`date_from`, `date_to`), so only the browser changes. `presetRange` uses the same rule as `budget_period.current_period` on the backend:

- This month starts on the latest `monthStartDay` that is not after today, and ends the day before the same day next month.
- Last month is the period before that.
- This year is unchanged (1 January to 31 December).

| Today | Start day | This month | Last month |
|---|---|---|---|
| 15 Sep 2026 | 1 | 1 Sep – 30 Sep | 1 Aug – 31 Aug |
| 15 Sep 2026 | 15 | 15 Sep – 14 Oct | 15 Aug – 14 Sep |
| 14 Sep 2026 | 15 | 15 Aug – 14 Sep | 15 Jul – 14 Aug |
| 10 Jan 2027 | 15 | 15 Dec 2026 – 14 Jan 2027 | 15 Nov – 14 Dec 2026 |
| 28 Feb 2028 | 28 | 28 Feb – 27 Mar | 28 Jan – 27 Feb |

`new Date(year, month, day)` does the rollovers: month -1 is December of the year before, and day 0 is the last day of the previous month, so day 1 gives calendar months. Days are at most 28, so the start always exists.

The start day is the viewer's own, and one range applies to the Personal card and every family card. Family budgets still use the family owner's day and show their own dates, so a family card and that family's budgets can cover different months; each states its dates.

The day is a required argument, so no caller can fall back to calendar months by mistake. `Dashboard` memoises `parseFilters(searchParams, monthStartDay)` on both values, so a new day reloads the cards.

The URL keeps explicit dates. A dashboard URL with `from`/`to` keeps its range after the day changes and the filter shows "Custom"; a URL without dates (the Dashboard link, Reset) follows the new day.

## 3. Saving the day

1. The form starts from `useAuth().user.month_start_day`. Settings no longer loads `/api/users/me` itself, so there is one copy of the user.
2. Save sends `PATCH /api/users/me {"month_start_day": 15}`; the backend validates 1 to 28 and returns `UserOut`.
3. `updateUser(response)` replaces `session.user`. Every page reading `useAuth()` re-renders, so the dashboard's next render uses the new day with no reload or new login.
4. A toast confirms with the same sentence as the hint ("Your month runs from the 15th to the 14th of the next month.").

Changing the day only changes which dates are asked for; no expense or budget row is written.

## 4. Unsaved changes

`dirty` is `day !== String(saved)`. After a save, `saved` comes from the updated session user and equals `day`, so the form is clean again without a navigation in between.

| Event while dirty | Result |
|---|---|
| Nav link, user menu link, Back to another page | `useBlocker` holds it; "Discard unsaved changes?" dialog |
| A link to Settings itself | Not held: the page would not reload, so nothing would be discarded |
| Keep editing or Escape | `blocker.reset()`; stays on Settings with the chosen value |
| Discard changes | `blocker.proceed()`; navigation continues, nothing saved |
| Close or reload the tab | `beforeunload` is prevented; the browser shows its own prompt |
| Logout | The session ends, `RequireAuth` unmounts Settings before redirecting, so no dialog |

The dialog has no `onOpenChange`: Radix fires it with `false` when the Discard action closes the dialog, which would call `reset()` after `proceed()`.

## 5. Tests

See [testing.md](../planning/references/testing.md) (Settings, Dashboard month presets, E2E). Each new behaviour was checked to fail without its code: the dashboard update without `updateUser`, the dialog tests without the guard, and the same-page case with a plain `useBlocker(dirty)`.
