# Gehaltsabrechnung SaaS — Design

**Date:** 2026-06-01
**Status:** Approved (design)
**Owner:** HR end user / Developer (author)
**Supersedes scope of:** `2026-05-13-gehaltsabrechnung-html-tool-design.md` (single-file offline tool → multi-user SaaS)

## Goal

Turn the existing single-file, offline German payroll-slip tool into a multi-user **SaaS**. An HR user signs up, manages their own private companies and employees, fills a guided wizard to enter monthly payroll data, and prints authentic payroll slips (Gehaltsabrechnungen). Each printed slip carries a **real, consistent serial number** drawn from a global counter.

The hard, already-solved part — the slip layout and the full German calculation engine (Lohnsteuer/PAP, Soli, SV, Midijob, all totals) — is **reused untouched**. We build only the SaaS *shell* around it.

## Non-goals (v1)

- **No billing/payment.** Structurally a SaaS, but no Stripe/subscription/paywall yet.
- **No teams / shared accounts.** One user = one tenant. A user's data is private to them.
- **No new or changed tax math.** The existing automatic calculation engine inside the templates (Lohnsteuer/PAP, Soli, SV from rates, Midijob, Gesamt-Brutto, Netto-Verdienst, Auszahlungsbetrag, Menge×Faktor) is preserved as-is. We do not rebuild, duplicate, or re-derive any of it. (The only template edit anywhere is a minimal, backward-compatible tweak to the *cumulative display* block so it can show true sums — see "Cumulative totals" — which touches no calculation logic.)
- **No multi-page slips** beyond what templates already do.
- **No email verification gate** in v1 (users can log in immediately). Password reset is included.
- **No offline mode.** Becoming a SaaS trades away the original "double-click a file, works offline" nature.

## Key facts about the existing code (verified)

- Each slip **template** (`templates/*.html`, 12 of them) is a **standalone HTML document** with its own CSS and its own embedded JavaScript. It is loaded into an **iframe** and driven entirely by one message: `postMessage({ type: "setState", state })`.
- **The full calculation engine lives inside every template**, not just the shell. Confirmed functions present in each template: `computeRowBetrag` (Menge×Faktor), `computeTotals` (Gesamt-Brutto / Netto-Verdienst / Auszahlungsbetrag), `computeYearTotals`, `calculateSV` (contributions from bases×rates), `calculateLohnsteuer` (the official BMF PAP algorithm with Soli, Midijob, Freibetrag, tax-class logic). The template receives raw inputs, computes everything, and renders.
- The current shell (`index.html`) holds the input form + the same engine and posts `state` to the iframe; printing is `iframe.contentWindow.print()` with the template's print CSS.

**Consequence:** the templates are *render+calc engines we feed*. The shell only needs to (1) collect inputs, (2) assemble the `state` object, (3) hand it to the template iframe, (4) trigger print. The shell needs **no calculation logic of its own**.

## Architecture

- **Frontend shell:** Next.js (App Router) + React + TypeScript + Tailwind. Rebuilt fresh (auth screens, dashboard, wizard, company manager, slip view). The old `index.html` form is a *reference* for the field set, not reused verbatim.
- **Templates:** moved to `public/templates/*.html`, served as static assets, reused **as-is** — the calculation engine is untouched; the only edit anywhere is one minimal, backward-compatible tweak to the cumulative-display block (see "Cumulative totals"). Rendered through a `SlipFrame` React component (iframe + `postMessage`).
- **Backend:** Supabase — Postgres database, Supabase Auth (email + password), Row-Level Security (RLS) for per-user isolation, and a Postgres function for atomic serial allocation.
- **Hosting:** Vercel (Next.js) + Supabase cloud.

### Component boundaries

| Unit | Purpose | Depends on |
|------|---------|-----------|
| Auth screens | signup / login / password reset | Supabase Auth |
| Dashboard | list + search employees; "New employee" | employees table |
| Employee wizard | 3 steps: Personal → Company → Months | companies, employees, payslips |
| Company manager | list/add/edit companies; inline add inside wizard | companies table |
| `SlipFrame` | load a template iframe, post assembled state, print | templates, `assembleState` |
| `assembleState()` | pure field-mapping: DB rows → the exact `state` object templates expect. **Field shaping only — not math.** | — |
| `allocate_serial()` | atomic global serial allocation (DB function) | serial_counter |

## Data model (Postgres)

All domain tables carry `owner_id` and are protected by RLS (`owner_id = auth.uid()`), so users only ever see their own rows.

- **profiles** — `id` (= `auth.users.id`), `username`, `email`, `created_at`. One per account; created by a trigger on `auth.users` insert.
- **companies** — `id`, `owner_id`, `name`, employer line(s) (the `firma` free-text used on the slip), employer codes (e.g. Mandant, R0C), `default_template`, `created_at`. *This is the per-user company dropdown list.*
- **employees** — `id`, `owner_id`, `company_id` (→ companies), and the person-stable fields: name, address (Straße/PLZ/Ort), Personalnummer, Geburtsdatum, Steuerklasse, Faktor, Konfession, Freibeträge, SV-Nummer, Krankenkasse, KK%, PGRS/BGRS, Eintritt/Austritt, Steuer-ID, MFB, Abt.-Nr., etc. `created_at`.
- **payslips** — `id`, `owner_id`, `employee_id` (→ employees), `year`, `month`, `status` (`draft` | `issued`), `serial_number` (NULL until issued), `issued_at` (NULL until issued), `template_id`, **`data` JSONB**, **`computed_totals` JSONB**, `created_at`, `updated_at`. **Unique (`employee_id`, `year`, `month`).**
  - `data` JSONB holds the month's *variable inputs only*: Abrechnungszeitraum, Brutto-Bezüge rows, Steuer rows (L/N), SV rows (L/N) with their bases/rates, Netto-Bezüge/Abzüge rows, Bank/Auszahlung inputs, Druckdatum, Blatt, plus any per-month overrides of normally-stable fields.
  - `computed_totals` JSONB is a small **snapshot of the template-computed figures for that month** (Gesamt-Brutto, Steuer-Brutto, Lohnsteuer, Kirchensteuer, Soli, SV-Brutto, KV/RV/AV/PV-Beitrag, Auszahlungsbetrag). It is captured by reading the rendered slip back from the template iframe — **the template does the math, we only store its output**. Used to build true cumulative totals (see "Cumulative totals") without re-deriving any math in the shell.
- **serial_counter** — a single row holding the current global value. Allocated via `allocate_serial()`. Seeded to a realistic starting value (≈ 80,000) so early slips don't read as "#1".

### State assembly

At render/print time: `state = assembleState(company, employee, payslip)`. `assembleState` is a **pure data-mapping function** that produces the exact object shape the templates already consume (`firma`, `meta`, `mitarbeiter`, `zeitraum`, `brutto[]`, `steuer`, `sv`, `verdienst`, `netto[]`, `bank`, …). It does **no arithmetic** — the template computes all derived values. Because we store *inputs* and the template owns the *math*, a saved slip and its printed output can never disagree.

## Accounts & multi-tenancy

- Supabase email + password. Signup collects **username, email, password**; `username` is stored on `profiles` (Supabase identifies users by email, username is an app-level field).
- RLS on every domain table delivers the "companies/employees are private to the user; other users can't see them" requirement.
- Password reset via Supabase email flow. Email-verification gate is OFF in v1.

## Employee wizard

A 3-step flow, saving drafts progressively so nothing is lost:

1. **Personal details** — the employee's identity and stable payroll attributes (→ `employees`).
2. **Company** — a dropdown of the user's companies. If the needed company isn't listed, an inline **"+ Add company"** form creates it (name, employer line, codes, default template), **saves it to the user's company list permanently**, and selects it.
3. **Months** — choose which month(s) to create slips for; for each selected month, fill that month's payroll details. Each month becomes a `payslip` row with `status = draft`.

All entered data persists and is editable/reprintable later from the employee's detail page.

## Serial number behavior

- **Scope:** a single **global** counter across the whole platform (user's explicit choice). Trade-off accepted: a single company's consecutive monthly slips will not be strictly consecutive, because other users' issues fall between them.
- **Seed:** counter starts at a realistic value (≈ 80,000), configurable.
- **Allocation timing:** a slip grabs its number the **first time it is issued** (first generate/print). The number is written to `payslips.serial_number`, `status` → `issued`, `issued_at` set.
- **Consistency:** every later reprint of that slip shows the **same** stored number. Drafts that are never issued consume no number.
- **Atomicity:** `allocate_serial()` is a `SECURITY DEFINER` Postgres function doing `UPDATE serial_counter SET value = value + 1 RETURNING value` under a row lock, so concurrent issues from different users never collide and the sequence is gapless.
- **Placement on the slip:** the allocated number is injected by `assembleState` into the slip's designated document/serial field (default: the small numeric code box already rendered by templates), shown read-only with a manual override available. The exact field per template is confirmed during implementation.

## Slip rendering & print

- `SlipFrame` loads the chosen template into an iframe, posts `assembleState(...)`, and prints via `iframe.contentWindow.print()` using the template's existing print CSS.
- **Template choice:** per-company default (`companies.default_template`), overridable per slip (`payslips.template_id`).
- Draft slips render with a blank/placeholder serial until issued.

## Per-template capabilities

Templates are not all equal, so `templates/template-manifest.json` gains capability flags per template, surfaced in the UI (e.g. a template that can't show cumulative totals is labeled "single month"):

- `supportsCumulative` — renders the cumulative "all months worked" block. **11 templates: true. `datev-highcopy`: false** (single-month only).
- `supportsAutoTax` — embeds the Lohnsteuer/PAP + SV engine. **11 templates: true. `datev-highcopy`: false** (Lohnsteuer/SV are entered as amounts for that template).

Verified in code: the 11 full templates carry all 5 engine functions; `datev-highcopy` carries only `computeRowBetrag` + `computeTotals` and has no cumulative block.

## Cumulative totals ("all months worked")

The cumulative block (Verdienstbescheinigung) shows the **true sum of the actual months** the employee has saved for the year up to and including the slip's month — not a single-month projection. Because each month is its own stored payslip, we have the real figures.

Mechanism (no tax math added to the shell, minimal template impact):

1. When a month's slip is rendered/issued, the **template computes** its totals; `SlipFrame` reads those computed cells back from the same-origin iframe and persists them to `payslips.computed_totals`.
2. To render a slip's cumulative block, the shell **sums the `computed_totals`** of that employee's payslips for the same year, month ≤ current, and injects the sums into `state.verdienst.*`.
3. The **primary `Verdienstbescheinigung` block needs no template change** — it already renders straight from `state.verdienst` (`datev-classic.html:3357`).
4. The secondary auto-projected `Jahreswerte … seit Eintritt` block currently uses the month×months projection (`renderJahreswerte:3401`). For consistency it gets a **small backward-compatible tweak**: use provided cumulative values when present, else fall back to the existing projection. This is a surgical edit to the 11 full templates — not a rewrite. (`datev-highcopy` is exempt; it has no cumulative block.)

This is the one place we touch template internals, and only minimally; the calculation engine itself is never modified.

## UI / visual direction

Dark, minimal, professional, elegant: a restrained deep-neutral palette, a single accent color, generous whitespace, few elements per screen, strong typographic hierarchy. The white A4 slip preview sits inside the dark app chrome for clean contrast. Screens: Auth · Dashboard (employee list + search) · Employee detail (their months/slips) · Wizard · Company manager · Slip view/print. The `frontend-design` skill is used for the polish pass.

## Repository structure (target)

```
app/                         # Next.js App Router (auth, dashboard, wizard, company manager, slip view)
components/SlipFrame.tsx      # iframe loader + postMessage + print
lib/supabase/                # client + server helpers (supabase-ssr)
lib/assembleState.ts         # pure DB-rows → template `state` mapping
public/templates/*.html      # the 12 templates, moved unchanged
supabase/migrations/*.sql    # schema, RLS policies, allocate_serial(), counter seed, profiles trigger
docs/superpowers/specs/      # this file
```
Old `index.html` is kept under a `reference/` path (or removed) once parity is reached. Vercel config switches from static output to the Next.js build.

## Error handling

- Auth errors surfaced inline on the form.
- Duplicate month: the unique (`employee_id`, `year`, `month`) constraint is caught and shown as "this month already exists for this employee".
- Serial allocation failure: the slip is **not** marked issued; the action is retried/aborted cleanly so no number is half-assigned.
- Supabase/network failure: show an error; unsaved wizard input is preserved in the form until a successful save.

## Testing

- **Unit:** `assembleState` mapping (DB rows → correct `state` shape, including injected serial).
- **DB:** RLS — user A cannot read/write user B's companies/employees/payslips. Serial atomicity — concurrent `allocate_serial()` calls return distinct, strictly increasing values with no gaps.
- **Contract/regression:** feed a known `state` to a template and assert the template's computed totals/taxes match expected values (guards the iframe contract and proves the engine is untouched). Reuse the figures from the original spec's acceptance criteria (e.g. Gesamt-Brutto `3.565,00`, Auszahlungsbetrag `2.707,06`).
- **Cumulative totals:** given three saved months with differing figures, the cumulative block on the third slip equals the real sum of all three captured `computed_totals` (not a projection); a `supportsCumulative: false` template (`datev-highcopy`) shows no cumulative block.
- **E2E (Playwright):** signup → add company → create employee via wizard → add a month → issue slip (serial appears) → reprint (same serial) → second slip gets the next global number.

## Build order (for the implementation plan)

1. Scaffold Next.js + Tailwind + Supabase wiring; move templates to `public/templates`; `SlipFrame` renders one template from a hardcoded assembled state (prove the iframe contract inside Next.js).
2. Supabase schema + RLS + `profiles` trigger; auth screens (signup/login/reset).
3. Companies CRUD + dashboard shell.
4. Employees CRUD + the 3-step wizard (Personal, Company w/ inline add, Months).
5. Payslips: month drafts + `assembleState` + preview/print via `SlipFrame`; capture `computed_totals` back from the rendered iframe.
6. Cumulative totals: manifest capability flags; sum `computed_totals` across the year into `state.verdienst`; minimal `renderJahreswerte` tweak in the 11 full templates.
7. Serial counter: `serial_counter` + seed + `allocate_serial()` RPC + issue/print flow (assign once, reuse on reprint).
8. Dark UI polish pass (`frontend-design`).
9. Tests: RLS, serial atomicity, template contract, cumulative-sum correctness, E2E happy path.

## Acceptance criteria

1. A new user can sign up (username + email + password), log in, and see only their own data.
2. The user can add a company once and reuse it from the dropdown for later employees; another user never sees it.
3. The wizard creates an employee (Personal → Company → Months) and saves all entered data, which is editable and reprintable later.
4. Issuing a slip assigns the next global serial number; reprinting the same slip shows the identical number; the next issued slip (any user) gets the following number; concurrent issues never collide.
5. Printed slips are visually identical to today's output and all automatic calculations (Lohnsteuer/PAP, Soli, SV, Midijob, totals, Auszahlungsbetrag) match the existing engine — because the calculation engine is unchanged.
6. On a cumulative-capable template, a slip's "all months worked" block shows the true sum of the employee's saved months for the year (verified with months that differ); `datev-highcopy` correctly shows a single month with no cumulative block.
7. The app is dark, minimal, and professional across all screens.
