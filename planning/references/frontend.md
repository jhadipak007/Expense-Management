# Expense Sarathi - Frontend

Single-page app built with React + Vite as static assets. Served by FastAPI locally and by S3 + CloudFront in production, on the same origin as the API. API: [api_design.md](api_design.md). Auth: [authentication.md](authentication.md).

## Responsive UI rules (apply to all frontend work)
Every page and component adapts to screen size.

- Build mobile-first: unprefixed Tailwind utilities for phones, then `md:` (768px)
  and `lg:` (1024px), Tailwind's default breakpoints. Content width is capped at 1280px on large screens.
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
| `/login` | Login: "Welcome back", show/hide password, a "Forgot password?" placeholder (says reset is coming soon), link to sign-up | public; logged-in users go to `/` |
| `/register` | Register: details, then the OTP screen with Back (details kept). Links to login. After 5 wrong codes, returns to the details step | public; logged-in users go to `/` |
| `/` | Dashboard: welcome header with Add expense, then filters and summary cards (see below) (redirect target after login). Saving an expense returns here with an "Expense saved" toast | logged in |
| `/expenses/new`, `/expenses/:id` | Add / edit expense (`pages/Expenses/ExpenseForm`). Save stays disabled until amount, currency, category and date are filled, and shows a spinner while saving | logged in |
| `/families` | The user's families with their role, and a Create family form | logged in |
| `/families/:familyId` | Members (avatar, name, email, role badge). Owner only: search by email or name, invite, pending invitations with Cancel (confirmed in an `AlertDialog`) | logged in; non-members see "Family not found" |
| `/reports` | Totals by currency, then by category or month | logged in |
| `/profile` | Display name and password change | logged in |

The dashboard also lists the user's open family invitations with Accept and Decline (confirmed in an `AlertDialog`), and hides the section when there are none. Accepting reloads the dashboard so the family's card appears.

A route guard sends logged-out users to `/login` and returns them to the page they asked for after login.

Top bar (`components/TopBar`): Menu button (below 1024px), logo, `ThemeToggle` and `UserMenu` (avatar with initials and the display name; a non-modal `DropdownMenu` with the email and Logout).

Navigation (`components/Nav`): links to Dashboard and Families, each with a `lucide-react` icon; the active link has a primary tint and inset bar. Below 1024px it is a full-height drawer (shadcn `Sheet`, from the left, over the top bar). The top bar's Menu button is the `SheetTrigger`; Escape, the Close button, the backdrop or choosing a link closes it, and so does the window growing to 1024px. From 1024px it is a sticky sidebar and the Menu button is hidden. The drawer's scroll lock injects an inline `<style>` that the strict CSP blocks, so the page behind it can still scroll (as before the Sheet) and the browser logs one CSP error per open; this was accepted to keep `style-src 'self'`.

Auth screens (`components/AuthLayout`): login, sign-up and OTP share a brand block with the logo, tagline and, from 1024px, feature highlights. Below 1024px it is a band above the form; from 1024px it is a left panel. Each form sits in `AuthLayout/AuthCard`. Logos live in `public/` (`logo-*` light for white backgrounds, dark for the brand colour); `logo-icon-light.svg` is the favicon.

Dashboard summaries (`pages/Dashboard`): `DashboardFilters` offers a period (This month, Last month, This year from the browser's local calendar, or a Custom From-To range, inclusive, applied once both dates are set and in order) as a segmented `ToggleGroup` (items are `role="radio"`), and category `Toggle` chips with a colour dot ("All categories", or any mix; `aria-pressed`). The filters live in the URL (`?from=YYYY-MM-DD&to=YYYY-MM-DD&category=1&category=3`), so Add expense, reload and links keep them; Reset clears them to This month and All categories. Below them, a `SummaryCard` for Personal and one per family each load `GET /api/reports/summary` on their own, with a skeleton while loading, an `EmptyState` ("No expenses match these filters" and an "Add an expense" link that keeps the filters) when empty, and an error with Retry. Each card has a title and description, then a large total per currency (never added across currencies, e.g. "INR 12,450.00") and a `CategoryChart`: horizontal bars in the category colours with the name and amount beside each. The chart is `aria-hidden` and `accessibilityLayer={false}` (not focusable); an `sr-only` list gives screen readers the same data. Cards stack on phones and sit side by side from 768px.

Lists load with `hooks/useAsyncList` (`data`, `error`, `loading`, `reload`). It passes an abort signal to the load, shows `loading` on every reload while keeping the previous data, and aborts a load when a newer one starts or the page unmounts, so only the newest result is kept.

Deep links: every non-`/api` path must return `index.html`. FastAPI does this locally with a catch-all route. CloudFront does it in production with a CloudFront Function on the S3 behavior that rewrites paths without a file extension to `/index.html`. Distribution-wide custom error pages are not used, because they would also turn API 404s into `index.html`.

## Component library (shadcn/ui)

- `frontend/components.json` configures shadcn with `tsx: false` (JavaScript) and the `@/` alias for `src/`, defined in both `vite.config.js` and `jsconfig.json`. Import anything outside the file's own folder with `@/`; siblings with `./`.
- Add components from `frontend/` with `npx shadcn@latest add <name>`, or through the shadcn MCP server. Never run the CLI from the project root. The registry does not list `class-variance-authority` as a dependency; it is installed already.
- Files in `src/components/ui/` are app code: commit them and edit them only to apply the theme or fix a bug. Theme edits so far: `Button` default `h-11` and icon `size-11`, `Input` and `NativeSelect` `h-11` (44px touch targets); `outline` and `ghost` buttons use primary tints instead of the amber accent; checkbox and radio borders are slate for 3:1 contrast; the Sheet close button is 44px; Sheet and AlertDialog overlays use `bg-brand-deep/50`; `Toggle` is `h-11` with primary-tint hover and on states; `DropdownMenu` items are `min-h-11` with a primary-tint focus; `Skeleton` uses `bg-muted`; `sonner.jsx` reads the theme from `hooks/useTheme` instead of `next-themes`.
- Installed: `Button`, `Input`, `Label`, `NativeSelect` (Currency, Category, Share with), `Checkbox`, `RadioGroup` (search mode), `Field` (`FieldSet`, `FieldLegend`), `Card`, `Badge`, `Sheet` (mobile nav), `DropdownMenu` (user menu), `Avatar`, `Sonner` (toasts), `AlertDialog` (confirmations), `Skeleton`, `Toggle` and `ToggleGroup` (dashboard filters), `Chart`, `Separator`. Selects are native, not Radix `Select`, to keep type-ahead, phone pickers and no injected styles.
- Feedback: confirmations (expense saved, family created, invitation sent, accepted, declined or cancelled) are Sonner toasts from the one `Toaster` in `AppLayout`; errors stay inline. Destructive actions ask first with `ConfirmButton`.
- CSP (`default-src 'self'`): Sonner's runtime `<style>` is blocked, so its CSS is bundled with `@import 'sonner/dist/styles.css'` in `global.css` (2 console errors per page load). The user menu is non-modal, so it has no scroll lock. `AlertDialog`, like the Sheet, has a blocked scroll lock (one console error per open; the page behind can scroll). Both were accepted to keep the policy.
- Merge class names with `cn()` from shadcn's `cn` npm package (`import { cn } from 'cn'`), which the registry's components import; there is no `src/lib/utils.js`.
- App building blocks in `src/components/`: `FormField` and `SelectField` (label, control, optional hint and linked error), `SubmitButton` (spinner while pending), `Notice` (error as `role="alert"`, success as `role="status"`), `SectionCard` (a `Card` inside a `<section>` landmark) with `PageTitle`, `PageHeader` (title and description), `CardHeading` and `CardIntro` (heading, description, icon tile), `ItemList`, `ItemRow`, `ItemDetails`, `PersonDetails` (initials avatar beside the details), `ItemActions`, `UserAvatar`, `EmptyState` (icon, message, optional action), `ListSkeleton`, `ConfirmButton` (confirms in an `AlertDialog`), `OptionGroup` and `Option` (a radio or checkbox inside its 44px label), `TextLink` and `BackLink`. Use them before adding page-level classes.

## API client (`src/api/`)

- One `request()` function used by every call. It adds `Authorization: Bearer <access token>` and sends JSON.
- The access token is held in memory only (a module variable plus React context), never in `localStorage` or `sessionStorage`.
- On app start, call `POST /api/auth/refresh` to restore the session from the refresh cookie.
- On a 401, call `/refresh` once and retry the request. If refresh fails, clear the session and go to `/login`.
- Concurrent 401s share one in-flight refresh call.
- Errors: 422 field errors are shown next to the matching inputs; other errors show a short message.

## Forms and validation

Browser-side checks mirror the API limits for fast feedback. The server remains the source of truth.

| Field | Check |
|---|---|
| Amount | Text input with `inputMode="decimal"`, so a non-numeric entry can show a message; greater than 0, at most 2 decimals |
| Currency | Dropdown of `GET /api/currencies`, shown as "AUD - Australian Dollar" and sorted by code (typing a code jumps to it); defaults to AUD |
| Date | `type="date"`, defaults to and is capped at the local today |
| Text fields | `maxLength` matching the API |
| Password | 8 characters minimum, 72 bytes maximum |

When adding an expense, the user chooses **Personal** (the default) or one of their families from a **Share with** dropdown, which stays compact however many families they have.

## Styling

- `styles/global.css` is the only stylesheet. It imports `tailwindcss`, `tw-animate-css` and Sonner's CSS, sets shadcn variables on `:root` to the color scheme below and redefines them under `.dark`, exposes them to Tailwind with `@theme inline`, and sets base styles in `@layer base` (body, headings, links, focus outline, and near-zero animations and transitions under `prefers-reduced-motion`).
- Variable mapping: `--primary` Primary Blue, `--accent` Accent Amber, `--foreground` Deep Navy (headings), `--muted-foreground` and `--card-foreground` Slate Gray (body text), `--background` and `--secondary` Background, `--card` Cards, `--border`, `--input` and `--muted` Borders, `--destructive` Warm Red, `--success` Success, `--grocery`, `--eating-out`, `--trips` category colors (classes `bg-success`, `bg-grocery` and so on). `--brand`, `--brand-deep` and `--brand-foreground` are the same in both themes, for the auth brand band and overlays.
- Components use theme classes only (`bg-primary`, `text-destructive`, `bg-grocery`), never hard-coded hex values or arbitrary `[#...]` colors. The exception is the category colour from the API: the chip dot in `DashboardFilters` (inline `style`) and the bars in `CategoryChart` (Recharts `Cell fill`). Spacing and font sizes use Tailwind's scale.
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
- Success: Sea Green `#3a9e84`

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
