# Expense Sarathi - Frontend

Single-page app built with React + Vite as static assets. Served by FastAPI locally and by S3 + CloudFront in production, on the same origin as the API. API: [api_design.md](api_design.md). Auth: [authentication.md](authentication.md).

## Responsive UI rules (apply to all frontend work)
Every page and component adapts to screen size.

- Build mobile-first: base styles for phones, then enhance with breakpoints
  md 768 and lg 1024. Content width is capped at 1280px on large screens.
- One codebase that adapts via CSS — never separate mobile/desktop versions.
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
| Styling | Plain CSS: global tokens in `styles/`, CSS Modules (`*.module.css`) per component |
| Data fetching | Small `fetch` wrapper in `api/`; no extra data library |
| Forms | Controlled inputs with HTML validation attributes |
| Charts | Simple CSS bar charts; add a chart library only if reports need more |
| Tests | Vitest + React Testing Library; Playwright for responsive checks |

## Pages and routes

| Route | Page | Access |
|---|---|---|
| `/login` | Login: "Welcome back", show/hide password, a "Forgot password?" placeholder (says reset is coming soon), link to sign-up | public; logged-in users go to `/` |
| `/register` | Register: details, then the OTP screen with Back (details kept). Links to login. After 5 wrong codes, returns to the details step | public; logged-in users go to `/` |
| `/` | Dashboard: welcome message, Add expense link, a confirmation after an expense is saved, then filters and summary cards (see below) (redirect target after login) | logged in |
| `/expenses/new`, `/expenses/:id` | Add / edit expense (`pages/Expenses/ExpenseForm`). Save stays disabled until amount, currency, category and date are filled, and shows a spinner while saving | logged in |
| `/families` | The user's families with their role, and a Create family form | logged in |
| `/families/:familyId` | Members (name, email, role). Owner only: search by email or name, invite, pending invitations with Cancel | logged in; non-members see "Family not found" |
| `/reports` | Totals by currency, then by category or month | logged in |
| `/profile` | Display name and password change | logged in |

The dashboard also lists the user's open family invitations with Accept and Decline, and hides the section when there are none.

A route guard sends logged-out users to `/login` and returns them to the page they asked for after login.

Navigation (`components/Nav`): links to Dashboard and Families. Below 1024px it is a drawer under the top bar, opened by the top bar's Menu button and closed by Escape, the backdrop or choosing a link. From 1024px it is a sticky sidebar and the Menu button is hidden. Logout stays in the top bar.

Auth screens (`components/AuthLayout`): login, sign-up and OTP share a brand block with the logo, tagline and, from 1024px, feature highlights. Below 1024px it is a band above the form; from 1024px it is a left panel. `AuthForm/Field` takes `icon` and `revealable` (password show/hide), and `AuthForm/SubmitButton` shows a spinner while pending. Logos live in `public/` (`logo-*` light for white backgrounds, dark for the brand colour); `logo-icon-light.svg` is the favicon.

Dashboard summaries (`pages/Dashboard`): `DashboardFilters` offers a period (This month, Last month, This year from the browser's local calendar, or a Custom From-To range, inclusive, applied once both dates are set and in order) and category checkboxes ("All categories", or any mix). The filters live in the URL (`?from=YYYY-MM-DD&to=YYYY-MM-DD&category=1&category=3`), so Add expense, reload and links keep them; Reset clears them to This month and All categories. Below them, a `SummaryCard` for Personal and one per family each load `GET /api/reports/summary` on their own, with a loading line, "No expenses match these filters." when empty, and an error with Retry. Each card shows a total per currency (never added across currencies, e.g. "INR 12,450.00") and a bar per category in the category's colour, next to its name. Cards stack on phones and sit side by side from 768px.

Lists load with `hooks/useAsyncList` (`data`, `error`, `loading`, `reload`). It passes an abort signal to the load, shows `loading` on every reload while keeping the previous data, and aborts a load when a newer one starts or the page unmounts, so only the newest result is kept. Shared card and list styles live in `styles/page.module.css`.

Deep links: every non-`/api` path must return `index.html`. FastAPI does this locally with a catch-all route. CloudFront does it in production with a CloudFront Function on the S3 behavior that rewrites paths without a file extension to `/index.html`. Distribution-wide custom error pages are not used, because they would also turn API 404s into `index.html`.

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

- `styles/tokens.css` defines CSS variables for the color scheme below, including the category colors, and for spacing and font sizes.
- Components use the variables only, never hard-coded hex values.
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

## Accessibility

- Every input has a `<label>`; errors are linked with `aria-describedby`.
- Visible focus outline on all interactive elements; everything works with the keyboard.
- Text meets WCAG AA contrast against its background.
- Color is never the only signal: category badges also show the category name.
