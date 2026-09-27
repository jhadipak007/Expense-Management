# Expense Sarathi - Frontend

Single-page app built with React + Vite as static assets. Served by FastAPI locally and by S3 + CloudFront in production, on the same origin as the API. Responsive rules live in [architecture_plan.md](../architecture_plan.md#frontend). API: [api_design.md](api_design.md). Auth: [authentication.md](authentication.md).

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
| `/login` | Login | public |
| `/register` | Register | public |
| `/` | Expenses list (redirect target after login) | logged in |
| `/expenses/new`, `/expenses/:id` | Add / edit expense | logged in |
| `/families`, `/families/:id` | Families list, family detail with members and invitations | logged in |
| `/invite/:token` | Accept or decline an invitation | logged in; redirects to login and back |
| `/reports` | Totals by currency, then by category or month | logged in |
| `/profile` | Display name and password change | logged in |

A route guard sends logged-out users to `/login` and returns them to the page they asked for after login.

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
| Amount | `type="number"`, `min="0.01"`, `step="0.01"` |
| Currency | 3 uppercase letters; default to the user's last used currency |
| Date | `type="date"`, defaults to today |
| Text fields | `maxLength` matching the API |
| Password | 8 characters minimum, 72 bytes maximum |

When adding an expense, the user chooses **Personal** or one of their families.

## Styling

- `styles/tokens.css` defines CSS variables for the color scheme in `AGENTS.md`, including the category colors, and for spacing and font sizes.
- Components use the variables only, never hard-coded hex values.
- Category color appears as a small badge or bar next to each expense and in report bars.

## Accessibility

- Every input has a `<label>`; errors are linked with `aria-describedby`.
- Visible focus outline on all interactive elements; everything works with the keyboard.
- Text meets WCAG AA contrast against its background.
- Color is never the only signal: category badges also show the category name.
