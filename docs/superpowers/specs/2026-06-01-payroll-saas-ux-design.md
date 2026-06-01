# Gehaltsabrechnung SaaS — UX & Navigation Overhaul (Design)

**Date:** 2026-06-01
**Status:** Approved (design)
**Owner:** HR end user / Developer (author)
**Builds on:** `2026-06-01-payroll-saas-design.md` (data model, engine, serial, cumulative)

## Goal

Make the app pleasant and obvious to use. Today every page is a standalone `<main>` with one-off text links — there is no app shell, no "where am I", and the new-employee form dumps ~25 fields in one wall. This overhaul adds a consistent navigation frame, a small dark design system, a guided (but skippable) employee wizard, inline field help, and the missing company-edit / date-picker / Pers-Nr fixes.

**Hard boundary:** this is a **shell + presentation + flow** change only. It does **not** touch the calculation engine, the templates, `assembleState`, the serial logic, or the payslips data layer built in Plan 4. The look and navigation change; the math and persistence do not.

## Non-goals

- No change to tax math, templates, serial allocation, or cumulative logic.
- No new data tables. (Field-help text is static config, not stored.)
- No billing, teams, or i18n framework (English UI labels + German domain terms stay as today).
- No mobile-first redesign; the layout is responsive enough to be usable on a narrow screen, but desktop is the target.

## Navigation & information architecture

A persistent **left sidebar** on every authenticated page, plus a consistent content header with breadcrumbs.

- **Sidebar (fixed, dark):** app name/wordmark; primary nav links **Employees** and **Companies** (active state highlighted with the accent); pinned at the bottom: the signed-in username/email and a **Log out** action. On viewports narrower than ~768px the sidebar collapses to a top bar with a menu toggle.
- **Content header:** each page renders a `PageHeader` (title + optional action button) and, where nested, a **breadcrumb** trail: `Employees › Erika Beispiel › März 2026`.
- **Route groups:** authenticated pages move under an `app/(app)/` route group whose `layout.tsx` renders the shell and performs the auth check (redirect to `/login` if no user; fetch the username for the sidebar — centralizing what each page does today). A `(app)` route group is **ignored in the URL**, so `/dashboard`, `/companies`, `/employees/...` paths are unchanged — existing routes, middleware `PUBLIC_PATHS`, and E2E navigations keep working. Auth pages (`/login`, `/signup`, `/reset`, `/update-password`) stay outside the shell with their own centered layout. `/demo` stays standalone.

The IA is: **Employees** (list + search) → **Employee** (detail: their months/slips) → **Slip** (preview/print); and **Companies** (list → add/edit). The dashboard *is* the Employees list (no separate landing hub).

## Design system

A small token set in `app/globals.css` and a handful of reusable primitives, so every screen is visually identical and intentional.

- **Palette:** near-black base (`zinc-950`), layered surfaces (`zinc-900`/`zinc-800`), hairline borders (`zinc-800`), primary text `zinc-100`, secondary `zinc-400`. **One** restrained accent — **indigo** (`indigo-500` for primary actions and active nav, `indigo-400` hover) — used sparingly; everything else neutral. Destructive actions use a muted red.
- **Type & spacing:** clear hierarchy (page title / section / label / body), generous whitespace, few elements per screen.
- **Primitives** (`components/ui/`):
  - `Button` — `variant: "primary" | "secondary" | "ghost" | "danger"`, sizes, disabled/loading states.
  - `Input`, `Select`, `Textarea` — consistent dark field styling (replacing the ad-hoc `.cmp-input` usage; `.cmp-input` is kept as an alias during migration).
  - `Field` — label + control + the info tooltip marker + error slot, the standard wrapper for all form fields.
  - `Card` — surface container for list rows / panels.
  - `PageHeader` — title + actions.
  - `Breadcrumbs` — trail from an array of `{ label, href? }`.
  - `Tooltip` — accessible hover/focus popover used by `Field`.
  - `Stepper` — step indicator for the wizard.

These are presentational only; they wrap existing server actions and data unchanged.

## Employee wizard (guided, but skippable)

`/employees/new` becomes a 3-step stepper. **Key rule: the employee is saved as a draft at the end of Step 1, so no later step is mandatory.**

1. **Personal** — identity + stable payroll attributes (the current employee fields, grouped and with help). On **Continue**, the employee record is created/updated (draft) and the wizard advances. This is the only required step.
2. **Company** — a dropdown of the user's companies + an inline **"+ Add company"** panel (creates a company permanently and auto-selects it). Has **Skip for now** and **Back**.
3. **Months** — add the first month's details (reusing the Plan 4 `MonthForm` shape) to create the first payslip draft. Has **Skip for now** and **Back**.

Affordances:
- A **"Save & finish"** action is available from Step 2 and Step 3 so the user can exit early; it lands on the employee detail page.
- **Skip for now** on Steps 2–3 advances without requiring input.
- Finishing (or skipping to the end) routes to `/employees/[id]` (the employee's months/slips).
- **Editing** an existing employee uses the same field panels **without** the stepper chrome — a single scrollable edit form on `/employees/[id]/edit` (today's behavior, restyled).

## Field help

Every employee and company field shows a small `ⓘ` marker; on hover/focus a `Tooltip` shows an **English description and an example**.

- Source: extend the field config with `description` and `example` (employee: `lib/employee-fields.ts`; company: a new `lib/company-fields.ts`). Example: *Steuerklasse — German income-tax class, 1–6, set by the tax office. Example: 1.*
- `Field` renders the marker only when a description is present; tooltips are keyboard-accessible (focusable marker, shown on focus and hover, dismiss on Escape/blur).

## Company management

- **Add and Edit:** the Companies page lists companies as cards with **Edit** and **Delete**. Edit opens a form pre-filled with the company's values. Requires an `updateCompany` data-layer function + an `updateCompany` server action (the create path already exists).
- **Mandant fields, labeled and explained:** the form exposes **Mandant-Code (oben)** — the full code line, e.g. `133267/30605/00107` — and **Mandant-Code (Box)** — the short value, e.g. `30605` — as two clearly-labeled, separate inputs (`mandant` and `mandant_box`; column already added in Plan 4). Plus **R0C-Code** and **default template**.

## Forms: date pickers & Pers-Nr

- **Date pickers:** fields that hold dates (Geburtsdatum, Eintritt, Austritt, Druckdatum, …) use a native `<input type="date">` rendered through the `Field`/`Input` primitive. The DB/engine format is unchanged (the templates expect `ddmmyy` for some fields and `TT.MM.JJJJ` for Druckdatum); the field config marks date fields and the form converts between the date input's `YYYY-MM-DD` and the stored format on read/write. Where a field's stored format is free-form, a plain text input with a format hint is used instead — correctness of the stored value takes priority over the picker.
- **Pers-Nr shown once:** the form shows a single **Personal-Nr.** input (`meta.persNr`); the separate "Pers.-Nr. (Box)" field is removed from the UI because `assembleState` already mirrors the one value into both slip positions.

## Slip preview page

The preview (`/employees/[id]/payslips/[payslipId]`) moves into the app shell with a clean toolbar: template switcher, **Issue & assign serial** (or the serial badge once issued), and **Print / PDF**, laid out as a proper header above the A4 preview. Behavior (capture, issue, cumulative) is unchanged from Plan 4.

## Components & files (target)

```
app/(app)/layout.tsx                  # sidebar + header shell for authenticated pages
app/(app)/dashboard/…                 # moved under the shell (Employees list)
app/(app)/companies/…                 # moved under the shell (+ edit)
app/(app)/employees/…                 # moved under the shell (wizard, detail, edit, payslips)
components/app-shell/Sidebar.tsx       # nav + account/logout
components/app-shell/Breadcrumbs.tsx
components/ui/{Button,Input,Select,Textarea,Field,Card,PageHeader,Tooltip,Stepper}.tsx
components/EmployeeWizard.tsx          # 3-step stepper wrapping the field panels + MonthForm
components/CompanyForm.tsx             # add/edit company (replaces inline markup)
lib/company-fields.ts                  # company field config + help text
lib/employee-fields.ts                 # extended with description/example (+ date flags)
lib/date-format.ts                     # YYYY-MM-DD <-> stored format helpers (pure, tested)
app/companies/actions.ts               # + updateCompany action
lib/db/companies.ts                    # + updateCompany
```

Existing server actions and the Plan 4 data layer are reused unchanged except for adding `updateCompany`.

## Testing

- **Unit:** `lib/date-format.ts` round-trip (date input ⇄ stored `ddmmyy`/`TT.MM.JJJJ`); field-config integrity (every field with a date flag is handled; descriptions present where expected).
- **E2E (Playwright):**
  - Navigation: from the dashboard, the sidebar reaches Companies and back; breadcrumbs render on a nested page.
  - Wizard happy path: Personal → Continue (employee saved) → add company inline → add a month → land on employee detail with the month listed.
  - Wizard skip path: Personal → Continue → **Skip for now** (Company) → **Skip for now** (Months) → land on employee detail with no months and no company, employee still saved.
  - Company edit: edit a company's name and Mandant box, value persists.
  - Existing suites (auth, crud, payslip, template-contract, demo) still pass after the route-group move.

## Acceptance criteria

1. Every authenticated page shows the same sidebar; Employees and Companies are always one click away; the active section is highlighted.
2. Nested pages show a breadcrumb trail back to the list.
3. Creating an employee is a 3-step wizard with a visible progress indicator; the employee is saved after Step 1; Company and Months can be skipped; the user can finish early.
4. Every employee/company field has an info marker showing an English description and example on hover/focus.
5. A company can be edited (not just added/deleted); Mandant "oben" and Mandant box are separate, labeled inputs.
6. Date fields use a date picker; the stored value remains in the format the templates expect.
7. Personal-Nr. appears once in the UI.
8. The app reads as dark, minimal, professional, and consistent across all screens.
9. The calculation engine, templates, serial logic, and persistence are unchanged; all existing tests still pass.
