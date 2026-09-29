# EM-12 Data Flow: UX Enhancement with shadcn/ui

This document explains what EM-12 changed in the frontend and how theme, feedback and UI state now flow. No API or data changed. It builds on [EM-11-shadcn-tailwind-migration.md](EM-11-shadcn-tailwind-migration.md).

Design references: [frontend.md](../planning/references/frontend.md), [testing.md](../planning/references/testing.md).

## 1. Overview

| Area | Before | After |
|---|---|---|
| Top bar | Text title, Menu and Logout buttons | Logo, theme toggle, user menu (avatar, name, email, Logout) |
| Nav | Text links | `lucide-react` icons, tinted active link with a primary inset bar |
| Dashboard filters | Radio buttons and checkboxes | Segmented `ToggleGroup` for the period, `Toggle` chips for categories |
| Summary cards | Title, totals, Tailwind bars | Title and description, large total per currency, shadcn `Chart` bars |
| Loading | "Loading..." text | `Skeleton` placeholders with a screen-reader "Loading..." status |
| Empty lists | One line of text | `EmptyState`: icon, message, optional action |
| Confirmations | Inline success `Notice` | Sonner toasts |
| Decline / Cancel invitation | Immediate | `AlertDialog` confirmation (`ConfirmButton`) |
| People | Name and email | Initials `Avatar`; owner and member badges differ |
| Theme | Light only | Light and dark, toggled in the top bar |

New shadcn components: `DropdownMenu`, `Avatar`, `Sonner`, `AlertDialog`, `Skeleton`, `Toggle`, `ToggleGroup`, `Chart` (adds `recharts` and `sonner`). New building blocks: `UserAvatar`, `EmptyState`, `ConfirmButton`, `ListSkeleton`, `PageHeader` and `CardIntro` (in `SectionCard.jsx`), `PersonDetails` (in `ItemRow.jsx`), and `TopBar/ThemeToggle`, `TopBar/UserMenu`.

## 2. Theme: light and dark

```
localStorage 'theme' ──┐
                       ├─► hooks/useTheme.js (module store) ──► applyTheme(): <html class="dark">
prefers-color-scheme ──┘        ▲            │                          │
                                │            └─► useTheme() ─► ThemeToggle, Toaster
                ThemeToggle ─► setTheme(next) (saves, applies, notifies)  │
                                                                         ▼
                        global.css: :root (light) / .dark (dark) variables ─► every theme class
```

1. On import, `useTheme.js` reads the saved theme, or the system setting when nothing is saved.
2. `main.jsx` calls `applyTheme()` before the first render, so the page never flashes the wrong theme. An inline `<script>` in `index.html` is not possible: the CSP blocks inline scripts.
3. `ThemeToggle` calls `setTheme()`, which saves the choice, toggles `.dark` on `<html>` and notifies subscribers through `useSyncExternalStore`.
4. `global.css` redefines the colour variables under `.dark`; `@custom-variant dark` enables `dark:` utilities. Amber, category and success colours are shared. `color-scheme: dark` darkens native date pickers and selects.
5. Brand tokens (`--brand`, `--brand-deep`, `--brand-foreground`) are not redefined in `.dark`. The auth brand band and the Sheet and AlertDialog overlays use them, so they look the same in both themes.

## 3. Feedback: toasts, dialogs and inline errors

- `AppLayout` mounts one `<Toaster position="bottom-right" />` for logged-in pages. Pages call `toast.success(...)` from `sonner`:

| Event | Where | Toast |
|---|---|---|
| Expense saved | `NewExpense` before navigating to `/` | "Expense saved" with "AUD 42.50 for Grocery" |
| Invitation accepted / declined | `PendingInvitations` | "You joined X" / "Invitation to X declined" |
| Family created | `CreateFamilyForm` | "X created" |
| Invitation sent / cancelled | `UserSearch` / `FamilyInvitations` | "Invitation sent to X" / "Invitation for X cancelled" |

- The dashboard no longer reads `location.state.savedExpense`; the toast survives the navigation because the Toaster lives in the layout.
- After accepting an invitation, `PendingInvitations` calls `onJoined`, which reloads the dashboard's categories and families, so the new family's summary card appears.
- Errors stay inline as `Notice` (`role="alert"`), and field errors stay next to their fields.
- `ConfirmButton` wraps an `AlertDialog`: the trigger opens it, Cancel keeps the item (label "Keep invitation"), and the destructive action runs `onConfirm`.

## 4. Dashboard

- `DashboardFilters`: the period `ToggleGroup` (`type="single"`) renders items with `role="radio"`, so period state and tests read like before. Pressing the selected period again sends an empty value, which is ignored. Category chips are `Toggle`s (`aria-pressed`) in a `role="group"` named "Categories"; "All categories" clears the list. The URL behaviour is unchanged.
- `SummaryCard`: `CardIntro` shows the title, a description and an icon tile. Each currency shows its total in large type and a `CategoryChart`.
- `CategoryChart`: a Recharts `BarChart` (`layout="vertical"`) inside `ChartContainer`, one row per category, the name on the left and the amount on the right. Bar colours come from the API through `Cell fill`, so the chart config has no colours and `ChartContainer` injects no `<style>`. The chart is `aria-hidden` with `accessibilityLayer={false}` (Recharts 3 otherwise makes the chart a Tab stop); an `sr-only` list named "INR by category" gives screen readers the same data.
- Loading shows `SummarySkeleton` (visual) plus an `sr-only` status; a reload keeps the previous data.
- Empty cards show `EmptyState` with an "Add an expense" link that keeps the filters in the query string.

## 5. Forms

- `FormField` and `SelectField` take an optional `hint`. `aria-describedby` points at the error while one is shown, otherwise at the hint.
- `ExpenseForm` groups fields in three `FieldSet`s: How much (Amount, Currency), What and when (Category, Date, Description) and Who can see it (Share with). Pairs sit side by side from 768px. Currency stays a native select for type-ahead and phone pickers.

## 6. CSP (`default-src 'self'`)

Checked in Chromium against the Docker build, which serves the real header:

| Part | Injected `<style>` | Outcome |
|---|---|---|
| Sonner | Its CSS, on module import | Blocked (2 console errors per page load). The same CSS is bundled by `@import 'sonner/dist/styles.css'` in `global.css`, so toasts are styled and visible |
| User menu (`DropdownMenu`) | Scroll lock, when modal | `modal={false}`: no scroll lock, no violation |
| `AlertDialog` | Scroll lock | Blocked (1 error per open); the page behind can still scroll, as with the Sheet |
| `Chart` | Colour variables, only when the config has colours | None: colours come from the API per bar |
| Sheet (EM-11) | Scroll lock | Unchanged, accepted in EM-11 |

The policy is unchanged.

## 7. Tests

- Vitest: `TopBar.test.jsx` covers the logo, the user menu (name, email, Logout), logging out and the theme toggle. Dashboard, invitation and family tests cover toasts, the confirmation dialogs (confirm and keep), chips, the empty-state action and the families empty state. `renderApp.jsx` exports `logOut(user)` for the user menu.
- `test/setup.js` calls `toast.dismiss()` after each test, because Sonner keeps toasts in module state and replays undismissed ones to the next Toaster.
- Playwright: `logOut(page, name)` opens the user menu; the responsive spec checks the user menu and its Logout item are 44px, measured after the menu's open animation.
