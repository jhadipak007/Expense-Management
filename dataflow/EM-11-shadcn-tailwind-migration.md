# EM-11 Data Flow: Frontend on shadcn/ui and Tailwind CSS

This document explains what EM-11 changed in the frontend and how styles and UI state flow now. It is a styling migration: no API, data or page behaviour changed, apart from the nav drawer's closing gestures (section 5). It builds on [EM-10-currency-dropdown.md](EM-10-currency-dropdown.md) and the earlier frontend docs.

Design references: [frontend.md](../planning/references/frontend.md), [testing.md](../planning/references/testing.md), [aws_deployment.md](../planning/references/aws_deployment.md).

## 1. Overview

```
 build time (vite build / Dockerfile npm ci + build)            run time (browser)
┌────────────────────────────┐   @tailwindcss/vite   ┌──────────────────────────────┐
│ src/styles/global.css      │ ────────────────────► │ dist/assets/index-*.css      │
│  @import tailwindcss       │  scans JSX classes,   │  one static stylesheet       │
│  :root brand variables     │  emits used utilities │  (no CSS-in-JS at run time)  │
│  @theme inline, @layer base│                       └──────────────┬───────────────┘
└────────────────────────────┘                                      │ class names
┌────────────────────────────┐   import              ┌──────────────▼───────────────┐
│ src/components/ui/*        │ ────────────────────► │ src/components/* building    │
│  shadcn (Radix + cva + cn) │                       │ blocks  ──►  pages/*         │
└────────────────────────────┘                       └──────────────────────────────┘
```

Before EM-11 each component imported a CSS Module (`*.module.css`) and shared `tokens.css`, `page.module.css` and a global `.button`. All eleven CSS files are gone. `global.css` is the only stylesheet.

| Part | Code | Role |
|---|---|---|
| Build | `frontend/vite.config.js` | Adds the `tailwindcss()` plugin and the `@` alias for `src/` |
| Config | `frontend/components.json`, `frontend/jsconfig.json` | shadcn CLI settings (JavaScript, `@/` aliases) |
| Theme | `frontend/src/styles/global.css` | Brand palette as shadcn variables, `@theme inline`, base styles |
| Primitives | `frontend/src/components/ui/*` | shadcn components, sized to 44px touch targets |
| Building blocks | `frontend/src/components/*.jsx` | `FormField`, `SelectField`, `SubmitButton`, `Notice`, `SectionCard`, `ItemRow`, `OptionGroup`, `TextLink`, `BackLink` |
| Shell | `frontend/src/layouts/AppLayout.jsx`, `components/TopBar`, `components/Nav` | Sheet drawer below 1024px, sidebar above |

## 2. Theme: from palette to class

1. `global.css` sets shadcn variables on `:root` to the brand hex values, for example `--primary: #3a78b5`, `--destructive: #b8453b`, `--grocery: #8aa84a`.
2. `@theme inline` maps each to a Tailwind colour, for example `--color-primary: var(--primary)`, so `bg-primary`, `text-destructive` and `bg-grocery` exist.
3. Components use only those classes. The Tailwind build emits CSS just for the classes found in the JSX.
4. `@layer base` sets body text (slate), headings (navy), links (primary) and a 3px focus outline. Utilities beat base, so a `Button asChild` link keeps its white text.

The only colour not from the theme is each category bar in `SummaryCard`, which uses the colour the API returns in an inline `style`.

## 3. Components: from shadcn to page

```
ui/input  ─┐
ui/label  ─┼─► FormField (label, input, error p#<id>-error, aria-describedby) ─► Login, DetailsForm, OtpForm,
ui/button ─┘                                                                    ExpenseForm, CreateFamilyForm,
ui/native-select ─► SelectField (same wrapper) ─► ExpenseForm                    UserSearch, DashboardFilters
ui/card ─► SectionCard (<section> landmark + Card), PageTitle, CardHeading ─► every logged-in page
ui/radio-group, ui/checkbox, ui/field ─► OptionGroup + Option (44px <label> wrapping the control) ─► DashboardFilters, UserSearch
ui/sheet ─► AppLayout <Sheet> + TopBar <SheetTrigger> + Nav <SheetContent>
```

Page state is unchanged. Controlled values still flow through the same handlers:

| Control | Before | After | Value flow |
|---|---|---|---|
| Text, date | `<input>` in `AuthForm/Field` | shadcn `Input` in `FormField` | `onChange(event.target.value)` to the page's setter |
| Currency, Category, Share with | `<select>` | shadcn `NativeSelect` (still a native `<select>`) | same; type-ahead and `selectOptions` still work |
| Period, search mode | `<input type=radio>` | Radix `RadioGroup` | `onValueChange(key)` goes to `choosePeriod` or `changeMode` |
| Category filters | `<input type=checkbox>` | Radix `Checkbox` | `onCheckedChange` goes to `toggleCategory`, which writes the URL |

## 4. Nav drawer

```
TopBar  Menu (SheetTrigger) ──click──► AppLayout navOpen=true ──► Nav SheetContent (portal, role=dialog)
                                                     ▲                       │ link click: onNavigate
Escape / Close / backdrop ───────────────────────────┤ ◄─────────────────────┘
window reaches 1024px (matchMedia change) ───────────┘  navOpen=false, focus returns to Menu
From 1024px: <nav aria-label="Main"> sidebar is always mounted; Menu is hidden.
```

The sidebar and the drawer render the same `NavLinks`. Only one "Main" navigation is visible at a time: the sidebar is `hidden` below 1024px, and the drawer's content is unmounted while it is closed.

## 5. Behaviour differences

- The drawer is modal. While it is open, the Menu button sits under its overlay, so it closes with Escape, the Close button, the backdrop, a link, or by widening the window to 1024px, not by clicking Menu again. It covers the full height, including the top bar.
- CSP: the Sheet's scroll lock injects an inline `<style>`, which the backend's `default-src 'self'` blocks. The browser logs one error per open and the page behind stays scrollable, as it did with the old drawer. This was accepted to keep the strict CSP. No other screen injects styles.

## 6. Tests

- Vitest: 118 tests, all passing. `Nav.test.jsx` closes the drawer with the Close button instead of Menu, and has a new test for closing at 1024px. `setup.js` stubs only `ResizeObserver` and `matchMedia`. No other test changed.
- Playwright: all 43 e2e tests pass unchanged, including the 44px touch-target and no-horizontal-scroll checks at 360, 768 and 1440px.
- Checked by hand with Playwright scripts: CSP violations on every page (only the drawer's scroll lock), the drawer closing on resize, and a click on the far edge of a checkbox label toggling it once.
