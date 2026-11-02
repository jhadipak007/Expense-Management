# Expense Sarathi - Frontend

Single-page app built with React + Vite as static assets. Served by FastAPI locally and by S3 + CloudFront in production, on the same origin as the API. API: [api_design.md](api_design.md). Auth: [authentication.md](authentication.md).

## Responsive UI rules (apply to all frontend work)
Every page and component adapts to screen size.

- Build mobile-first: unprefixed Tailwind utilities for phones, then `md:` (768px)
  and `lg:` (1024px), Tailwind's default breakpoints. Content width is capped at 1280px on large screens.
- Page cards, form pages included, fill the content column like the dashboard cards. Form fields sit two per row
  from `md:` (a lone select in its own two-column row), and only free text such as a description spans the row.
  Settings is the one narrow card (`max-w-2xl`) since it holds a single field.
- One codebase that adapts via responsive utilities — never separate mobile/desktop versions.
- Layout adapts per size:
  - Phone (<768px): single column, stacked content, hamburger/drawer nav,
    tables become card lists, full-width buttons, sticky bottom actions.
  - Tablet (768–1023px): 2 columns, hamburger/drawer nav, collapsible side panels.
  - Desktop (≥1024px): sidebar nav, multi-column grid, full tables.
- Charts are full width and stacked on phones, with the legend below the chart.
- Use flex/grid, %, rem and clamp() — no fixed pixel widths on containers.
- Touch targets ≥ 44px; every hover action has a tap equivalent.
- No horizontal scroll at 360px width.
- Before finishing any UI task, take Playwright screenshots at 360px, 768px and 1440px
  and confirm the layout and that there is no horizontal scroll.

## Stack

| Concern | Choice |
|---|---|
| Language | JavaScript (`.jsx`) |
| Build | Vite |
| Routing | React Router (`createBrowserRouter`) |
| Components | shadcn/ui (Radix primitives), generated into `src/components/ui/` |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`; utility classes in JSX, no CSS Modules |
| Icons | `lucide-react` |
| Data fetching | Small `fetch` wrapper in `api/`; no extra data library |
| Forms | Controlled shadcn `Input`, `NativeSelect` and `Label` with HTML validation attributes |
| Charts | shadcn `Chart` (Recharts); bar colours come from the API per bar, so the chart config has no colours and injects no `<style>` |
| Tests | Vitest + React Testing Library; Playwright for responsive checks |

## Pages and routes

| Route | Page | Access |
|---|---|---|
| `/login` | Login: "Welcome back", show/hide password, a "Forgot password?" placeholder (says reset is coming soon), link to sign-up | public; logged-in users go to the remembered page or `/` |
| `/register` | Register: details, then the OTP screen with Back (details kept). Links to login. After 5 wrong codes, returns to the details step | public; logged-in users go to the remembered page or `/` |
| `/` | Dashboard: welcome header with Add expense, then the Spending card (filters and summaries) and budgets (see below) (landing page after login when no other page was asked for). Saving an expense returns here with an "Expense saved" toast | logged in |
| `/expenses/new` | Add expense (`pages/Expenses/ExpenseForm`). Save stays disabled until amount, currency, category and date are filled, and shows a spinner while saving | logged in |
| `/transactions` | Transactions (`pages/Transactions`): a Space select (Personal or a family), `Tabs` for the transaction list or the audit log (`?view=audit`; the active tab is filled `bg-primary` with bold `text-primary-foreground`, like the dashboard's selected period), filters, a page of 25 with Previous/Next | logged in; a family the user is not in shows "You are not a member of this family." |
| `/transactions/:expenseId` | One transaction: fields, created and last modified by/on, Deleted badge, History (oldest first, with changed fields old → new). The recorder can Edit in place (`ExpenseForm` with `expense`; Share with is shown, not changed), Delete (`ConfirmButton`) and Restore | logged in; hidden ones show "Transaction not found." |
| `/budgets` | Budgets (`pages/Budgets/Budgets`): the dashboard's `BudgetsSection` with `asPage` (h1 "Budgets" and a description instead of the h2), the same groups, filters, Create budget and Edit/Delete | logged in |
| `/budgets/new`, `/budgets/:budgetId/edit` | Create / edit budget (`pages/Budgets/BudgetPage`, `BudgetForm`): Applies to (Personal or a family the user owns), Category (or All categories), Period, Amount, Currency. Editing changes only the amount and period; a family member who is not the owner sees a notice instead of the form. Saving returns with a "Budget saved" toast to the Budgets page when opened from it (router state `returnTo: '/budgets'`, "Back to budgets"), otherwise to the dashboard with its filters | logged in |
| `/settings` | Settings: Month start day (1st to 28th) for monthly budgets and the dashboard's month presets | logged in |
| `/families` | The user's families with their role, and a Create family form | logged in |
| `/families/:familyId` | Members (avatar, name, email, role badge). Owner only: search by email or name, invite, pending invitations with Cancel (confirmed in an `AlertDialog`) | logged in; non-members see "Family not found" |
| `/reports` | Totals by currency, then by category or month | logged in |
| `/profile` | Display name and password change | logged in |

The dashboard also lists the user's open family invitations with Accept and Decline (confirmed in an `AlertDialog`), and hides the section when there are none. Accepting reloads the dashboard so the family's card appears.

Route guards (`src/auth/guards.jsx`):
- `RequireAuth` sends logged-out users to `/login` and remembers the page (path, query string and hash) in the history state as `from`. An expired session also remembers it. A logout in this tab (menu or idle) does not, so the next person to log in starts on the dashboard.
- `GuestOnly` is the only redirect after login or sign-up: once the session is authenticated it goes to `from`, or `/`. Login and sign-up pages do not navigate themselves, because a second navigation would race with this one.

Top bar (`components/TopBar`): Menu button (below 1024px), logo, `ThemeToggle` and `UserMenu` (avatar with initials and the display name; a non-modal `DropdownMenu` with the email, Settings and Logout).

Navigation (`components/Nav`): links to Dashboard, Budgets (active on `/budgets`, `/budgets/new` and `/budgets/:id/edit`), Transactions (active on every `/transactions` page), Families and Settings, each with a `lucide-react` icon; the active link has a primary tint and inset bar. Below 1024px it is a full-height drawer (shadcn `Sheet`, from the left, over the top bar). The top bar's Menu button is the `SheetTrigger`; Escape, the Close button, the backdrop or choosing a link closes it, and so does the window growing to 1024px. From 1024px it is a sticky sidebar and the Menu button is hidden. The drawer's scroll lock injects an inline `<style>` that the strict CSP blocks, so the page behind it can still scroll (as before the Sheet) and the browser logs one CSP error per open; this was accepted to keep `style-src 'self'`.

Auth screens (`components/AuthLayout`): login, sign-up and OTP share a brand block with the logo, tagline and, from 1024px, feature highlights. Below 1024px it is a band above the form; from 1024px it is a left panel. Each form sits in `AuthLayout/AuthCard`. Logos live in `public/` (`logo-*` light for white backgrounds, dark for the brand colour); `logo-icon-light.svg` is the favicon.

Dashboard summaries (`pages/Dashboard`): one "Spending" card (h2) holds the filters and the summaries they drive, split by a `Separator`. `DashboardFilters` renders its top: the heading, the applied dates ("15 Sep – 14 Oct 2026 · All categories") with Reset beside them, then a "Filters" region that offers a period (This month, Last month, This year from the browser's local calendar, or a Custom From-To range, inclusive, applied once both dates are set and in order; the two month presets run from the viewer's own `month_start_day` to the day before it next month, the same rule as monthly budgets, and one range applies to every summary) as a segmented `ToggleGroup` (items are `role="radio"`; the selected one is filled `bg-primary` with bold `text-primary-foreground`, the same as the Transactions view tabs), and category `Toggle` chips with a colour dot ("All categories", or any mix; `aria-pressed`). The filters live in the URL (`?from=YYYY-MM-DD&to=YYYY-MM-DD&category=1&category=3`), so Add expense, reload and links keep them; Reset clears them to This month and All categories. The applied dates always show under the heading. A URL with explicit dates keeps them after the start day changes (it then shows as Custom); a URL without dates follows the new day. Below them, a `SummaryPanel` (an inset bordered, tinted `section` with an h3) for Personal and one per family each load `GET /api/reports/summary` on their own, with a skeleton while loading, an `EmptyState` ("No expenses match these filters" and an "Add an expense" link that keeps the filters) when empty, and an error with Retry. Each panel has a title and description, then a large total per currency (never added across currencies, e.g. "INR 12,450.00") and a `CategoryChart`: horizontal bars in the category colours with the name and amount beside each. The chart is `aria-hidden` and `accessibilityLayer={false}` (not focusable); an `sr-only` list gives screen readers the same data. Panels stack on phones and sit side by side from 768px. The Budgets section stays outside this card because the filters do not apply to it.

Dashboard budgets (`BudgetsSection`, `BudgetGroup`, `BudgetItem`): below the summaries, a "Budgets" heading with Create budget, then one card per scope that has budgets ("Personal", then each family; group headings are h3). `GET /api/budgets?today=` loads once on mount, so returning from Add expense shows the new spending; the section is keyed on the family ids, so joining a family reloads it. Each card has its own Period and Category selects (client-side, not in the URL). Each budget shows category and period, the current period's dates ("15 Sep – 14 Oct 2026"), a progress bar (`role="progressbar"`, capped at 100%), "X spent of Y", then "Z left" or "Over by Z", and a status badge: On track (Success), Close to limit (Accent Amber), Over budget (Warm Red). Badges are a tint with foreground text, for AA contrast in both themes. Owners get Edit and Delete (confirmed in an `AlertDialog`). With no budgets, an `EmptyState` invites the user to create one. The same section is the `/budgets` page (`asPage`).

Transactions (`pages/Transactions`): the state lives in the URL (`transactionFilters.js`): `space` (family id; none is Personal), `view=audit`, `from`/`to` (inclusive expense dates, both optional), repeated `category`, `member`, `q`, repeated `action` (audit log only) and `page`. Any change returns to page 1, and changing the space drops `member`. `TransactionFilters` serves both views: Spent from / Spent to, a member select labelled Created by (list) or Performed by (audit log) for families, a description search applied on submit, `CategoryChips`, action chips (audit log) and "Clear all filters" while any is set; the space and view stay. `TransactionList` and `AuditLogList` share `PagedList` (skeleton, error with Retry, `EmptyState` with "Add an expense", `PaginationBar`). List rows show category, expense date, description, "Created by X on <local date and time>" and the amount; audit rows show an `ActionBadge`, amount and category, a Deleted badge if the transaction is deleted now, who acted and when, and `AuditChanges`. Rows link to the detail and keep the query string for Back to transactions. Timestamps come from the API in UTC and show with `formatDateTime` in the viewer's time zone; expense dates use `formatIsoDate`.

Settings (`pages/Settings`): reads the user from `useAuth()` and saves with `PATCH /api/users/me`; the response goes to the context's `updateUser`, so the dashboard uses the new day straight away without a reload. The select's hint explains the chosen day ("Your month runs from the 15th to the 14th of the next month."). While the select differs from the saved value, `UnsavedChangesGuard` asks before leaving.

Unsaved changes (`components/UnsavedChangesGuard`): render `<UnsavedChangesGuard dirty={...} />` in a form. While `dirty`, React Router's `useBlocker` holds in-app navigation to another path (links, Back; a link to the same page is let through, since it would not reload the form) and shows a controlled `AlertDialog` ("Discard unsaved changes?": Keep editing or Escape calls `blocker.reset()`, Discard changes calls `blocker.proceed()`); it has no `onOpenChange`, because Radix also fires that when Discard closes the dialog. A `beforeunload` listener triggers the browser's own prompt on close or reload. Logout unmounts the page before its redirect, so it is never blocked.

Lists load with `hooks/useAsyncList` (`data`, `error`, `loading`, `reload`). It passes an abort signal to the load, shows `loading` on every reload while keeping the previous data, and aborts a load when a newer one starts or the page unmounts, so only the newest result is kept.

Deep links: every non-`/api` path must return `index.html`. FastAPI does this locally with a catch-all route. CloudFront does it in production with a CloudFront Function on the S3 behavior that rewrites paths without a file extension to `/index.html`. Distribution-wide custom error pages are not used, because they would also turn API 404s into `index.html`.

## Component library (shadcn/ui)

- `frontend/components.json` configures shadcn with `tsx: false` (JavaScript) and the `@/` alias for `src/`, defined in both `vite.config.js` and `jsconfig.json`. Import anything outside the file's own folder with `@/`; siblings with `./`.
- Add components from `frontend/` with `npx shadcn@latest add <name>`, or through the shadcn MCP server. Never run the CLI from the project root. The registry does not list `class-variance-authority` as a dependency; it is installed already.
- Files in `src/components/ui/` are app code: commit them and edit them only to apply the theme or fix a bug. Theme edits so far: `Button` default `h-11` and icon `size-11`, `Input` and `NativeSelect` `h-11` (44px touch targets); `outline` and `ghost` buttons use primary tints instead of the amber accent; checkbox and radio borders are slate for 3:1 contrast; the Sheet close button is 44px; Sheet and AlertDialog overlays use `bg-brand-deep/50`; `Toggle` is `h-11` with primary-tint hover and on states; `DropdownMenu` items are `min-h-11` with a primary-tint focus; `Skeleton` uses `bg-muted`; `sonner.jsx` reads the theme from `hooks/useTheme` instead of `next-themes`.
- Installed: `Button`, `Input`, `Label`, `NativeSelect` (Currency, Category, Share with), `Checkbox`, `RadioGroup` (search mode), `Field` (`FieldSet`, `FieldLegend`), `Card`, `Badge`, `Sheet` (mobile nav), `DropdownMenu` (user menu), `Avatar`, `Sonner` (toasts), `AlertDialog` (confirmations), `Skeleton`, `Toggle` and `ToggleGroup` (dashboard filters, audit actions), `Tabs` (Transactions list / Audit log; no scroll lock or injected style, so no CSP message; triggers need `min-h-11` because the shadcn trigger is `100% - 1px` of a padded list), `Chart`, `Separator`. Selects are native, not Radix `Select`, to keep type-ahead, phone pickers and no injected styles.
- Feedback: confirmations (expense saved, family created, invitation sent, accepted, declined or cancelled) are Sonner toasts from the one `Toaster` in `AppLayout`; errors stay inline. Destructive actions ask first with `ConfirmButton`.
- CSP (`default-src 'self'`): Sonner's runtime `<style>` is blocked, so its CSS is bundled with `@import 'sonner/dist/styles.css'` in `global.css` (2 console errors per page load). The user menu is non-modal, so it has no scroll lock. `AlertDialog`, like the Sheet, has a blocked scroll lock (one console error per open; the page behind can scroll). Both were accepted to keep the policy.
- Merge class names with `cn()` from shadcn's `cn` npm package (`import { cn } from 'cn'`), which the registry's components import; there is no `src/lib/utils.js`.
- App building blocks in `src/components/`: `FormField` and `SelectField` (label, control, optional hint and linked error), `SubmitButton` (spinner while pending), `Notice` (error as `role="alert"`, success as `role="status"`), `SectionCard` (a `Card` inside a `<section>` landmark) with `PageTitle`, `PageHeader` (title and description), `CardHeading` and `CardIntro` (heading, description, icon tile), `CategoryChips` (category filter chips), `PaginationBar` (Previous / Page n / Next), `ItemList`, `ItemRow`, `ItemDetails`, `PersonDetails` (initials avatar beside the details), `ItemActions`, `UserAvatar`, `EmptyState` (icon, message, optional action), `ListSkeleton`, `ConfirmButton` (confirms in an `AlertDialog`), `UnsavedChangesGuard` (asks before leaving a changed form), `OptionGroup` and `Option` (a radio or checkbox inside its 44px label), `TextLink` and `BackLink`. Use them before adding page-level classes.

## API client (`src/api/`)

- One `request()` function used by every call. It adds `Authorization: Bearer <access token>` and sends JSON.
- The access token is held in memory only (a module variable plus React context), never in `localStorage` or `sessionStorage`. The only auth item in `localStorage` is the non-secret `logout-pending` flag.
- On app start, call `POST /api/auth/refresh` to restore the session from the refresh cookie. If a logout is pending (its request failed), retry `POST /api/auth/logout` instead and stay logged out.
- Logout shows the login page at once; `src/api/auth.js` sets `logout-pending` before the request and clears it on success. Login and sign-up clear it too.
- If loading the user fails right after login or sign-up, `AuthProvider` logs the new session out (same path) and rethrows, so the page shows its error and a reload does not log in.
- On a 401, call `/refresh` once and retry the request. If refresh fails, clear the session and go to `/login`.
- Concurrent 401s share one in-flight refresh call.
- Errors: 422 field errors are shown next to the matching inputs; other errors show a short message.
- 5xx responses (with their `X-Request-ID`) and network failures are reported through `src/utils/logger.js`; aborted requests and 4xx are not. Logged paths drop the query string.

## Error reporting

`src/utils/logger.js` writes to the console in development and posts errors only to `/api/client-logs` in production. `main.jsx` calls `captureGlobalErrors()` for uncaught errors and unhandled rejections; the root route's `errorElement` is `components/RouteError.jsx` ("Something went wrong" with Reload page). Details: [logging.md](logging.md).

## Forms and validation

Browser-side checks mirror the API limits for fast feedback. The server remains the source of truth.

| Field | Check |
|---|---|
| Amount | Text input with `inputMode="decimal"`, so a non-numeric entry can show a message; greater than 0, at most 2 decimals |
| Currency | Dropdown of `GET /api/currencies`, shown as "AUD - Australian Dollar" and sorted by code (typing a code jumps to it); defaults to AUD |
| Date | `type="date"`, defaults to and is capped at the local today |
| Text fields | `maxLength` matching the API |
| Password | 8 characters minimum, 72 bytes maximum |

| Budget fields | Every field is required: a missing Category or Period, or a bad amount, shows its message next to the field; a duplicate (409) shows the server's message above the form |

When adding an expense, the user chooses **Personal** (the default) or one of their families from a **Share with** dropdown, which stays compact however many families they have.

## Styling

- `styles/global.css` is the only stylesheet. It imports `tailwindcss`, `tw-animate-css` and Sonner's CSS, sets shadcn variables on `:root` to the color scheme below and redefines them under `.dark`, exposes them to Tailwind with `@theme inline`, and sets base styles in `@layer base` (body, headings, links, focus outline, and near-zero animations and transitions under `prefers-reduced-motion`).
- Variable mapping: `--primary` Primary Blue, `--accent` Accent Amber, `--foreground` Deep Navy (headings), `--muted-foreground` and `--card-foreground` Slate Gray (body text), `--background` and `--secondary` Background, `--card` Cards, `--border`, `--input` and `--muted` Borders, `--destructive` Warm Red, `--success` Success, `--grocery`, `--eating-out`, `--trips` category colors (classes `bg-success`, `bg-grocery` and so on). `--brand`, `--brand-deep` and `--brand-foreground` are the same in both themes, for the auth brand band and overlays.
- Components use theme classes only (`bg-primary`, `text-destructive`, `bg-grocery`), never hard-coded hex values or arbitrary `[#...]` colors. The exception is the category colour from the API: the chip dot in `DashboardFilters` (inline `style`) and the bars in `CategoryChart` (Recharts `Cell fill`). A budget progress bar sets its width through React's `style` prop; React writes it to the DOM style property, which the CSP allows (the e2e test checks for CSP errors). Spacing and font sizes use Tailwind's scale.
- Category color appears as a small badge or bar next to each expense and in report bars.

### Color scheme

Base:
- Primary Blue: `#3a78b5` (all buttons and links)
- Accent Amber: `#e6b340` (small highlights and badges only)
- Deep Navy: `#1c2b3f` (headings)
- Slate Gray: `#556270` (body text)
- Background: `#f6f7f9`
- Cards: `#ffffff`
- Borders: `#e4e7eb`

Categories:
- Grocery: Olive Green `#8aa84a`
- Eating Out: Soft Orange `#e08e5a`
- Trips: Sea Green `#3a9e84`

Status:
- Error / over budget: Warm Red `#b8453b` (darkened from `#d0584c` to meet WCAG AA on white)
- Success / on track: Sea Green `#3a9e84`
- Close to limit: Accent Amber `#e6b340`

### Dark theme

`hooks/useTheme.js` holds the theme ('light' or 'dark'): the choice saved in `localStorage` under `theme`, else the system setting. `main.jsx` applies it before the first render (the CSP rules out an inline script), and `ThemeToggle` in the top bar switches it. `.dark` on `<html>` swaps these values (amber, category and success colours stay):

- Background `#0f1722`, cards and popovers `#172231`
- Headings `#e6ebf1`, body text `#a3b0bf` (7.3:1 on cards)
- Primary `#6aa2dc` (6.0:1 on cards) with button text `#0f1722`
- Borders and inputs `#2a3747`, muted `#243244`
- Error `#e07a70` (5.5:1 on cards)

## Accessibility

- Every input has a shadcn `Label`; errors are linked with `aria-describedby`.
- Visible focus ring on all interactive elements (shadcn's `focus-visible:ring` styles, and a 3px primary outline for links); everything works with the keyboard. Keep the Radix ARIA and keyboard behaviour when editing `components/ui/`.
- Text meets WCAG AA contrast against its background.
- Color is never the only signal: category badges also show the category name.
