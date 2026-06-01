# UX & Navigation Overhaul — Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The **frontend-design** skill should be consulted during the UI tasks (Phase A) for visual quality.

**Goal:** Give the app a consistent dark app-shell with sidebar navigation + breadcrumbs, a small reusable design system, a guided-but-skippable 3-step employee wizard, inline field help, and the missing company-edit / date-picker / single-Pers-Nr fixes — without touching the calculation engine, templates, serial logic, or persistence.

**Architecture:** Authenticated pages move under an `app/(app)/` route group whose `layout.tsx` renders a `Sidebar` + content frame and does the auth check once. A handful of presentational primitives in `components/ui/` (Button, Input, Select, Card, PageHeader, Tooltip, Field, Stepper) standardize every screen using Tailwind's default `zinc` + `indigo` palette (no token config needed). Forms reuse a shared `EmployeeFields` block; the wizard orchestrates existing server actions across three steps and can be skipped after step 1. Date fields use native date inputs with pure conversion helpers (`lib/date-format.ts`) between the `YYYY-MM-DD` input value and the engine's stored format.

**Tech Stack:** Next.js 15 App Router (route groups, server actions), React 19 (`useActionState`, `usePathname`), TypeScript 5, Tailwind CSS v4, Vitest (unit), Playwright (E2E).

**Hard boundary (do not cross):** no edits to `public/templates/*`, `lib/assembleState.ts`, `lib/cumulative.ts`, `lib/db/payslips.ts` serial logic, or any migration. Route-group moves keep URLs identical (`(app)` is ignored in routing), so middleware and existing tests keep working.

**Verified facts:**
- `app/globals.css` = `@import "tailwindcss";` + dark base + `.cmp-input` (kept).
- Tailwind v4 default theme includes the full `zinc` and `indigo` palettes — usable directly (`bg-indigo-500`, `border-zinc-800`, …).
- Current authenticated pages: `app/dashboard/`, `app/companies/` (+`actions.ts`), `app/employees/` (`new/`, `[id]/`, `[id]/edit/`, `[id]/payslips/...`, `actions.ts`).
- Components importing moved action paths (must be updated after the move): `components/EmployeeForm.tsx`, `components/EmployeeList.tsx` (`@/app/employees/actions`), `components/MonthForm.tsx`, `components/SlipPreview.tsx` (`@/app/employees/[id]/payslips/actions`).
- `saveEmployee` (employees actions) currently redirects to `/dashboard`; the wizard needs a non-redirecting variant returning the new id.
- Stored date formats: `geburtsdatum`/`eintritt`/`austritt` = `ddmmyy` (e.g. `"250789"`, 2-digit year pivot `<70 → 20xx`); `druckdatum` = `TT.MM.JJJJ` (e.g. `"31.03.2026"`).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `app/globals.css` | base bg = zinc-950; keep `.cmp-input` | Modify |
| `components/ui/Button.tsx` | button variants | Create |
| `components/ui/Input.tsx`, `Select.tsx` | dark form controls | Create |
| `components/ui/Card.tsx`, `PageHeader.tsx` | surfaces + page header | Create |
| `components/ui/Tooltip.tsx` | accessible info popover | Create |
| `components/ui/Field.tsx` | label + tooltip + control + error | Create |
| `components/ui/Stepper.tsx` | wizard progress indicator | Create |
| `components/app-shell/Sidebar.tsx` | nav + account/logout | Create |
| `components/app-shell/Breadcrumbs.tsx` | breadcrumb trail | Create |
| `app/(app)/layout.tsx` | shell + auth check | Create |
| `app/(app)/{dashboard,companies,employees}/**` | moved under shell | Move |
| `lib/date-format.ts` | date input ⇄ stored format | Create |
| `lib/employee-fields.ts` | + description/example/date; drop persNrBox | Modify |
| `lib/employee-data.ts` | date conversion on write | Modify |
| `lib/company-fields.ts` | company field config + help | Create |
| `components/EmployeeFields.tsx` | shared grouped employee inputs | Create |
| `components/EmployeeForm.tsx` | edit form using EmployeeFields | Modify |
| `components/EmployeeWizard.tsx` | 3-step skippable wizard | Create |
| `components/CompanyForm.tsx` | add/edit company | Create |
| `components/MonthForm.tsx` | optional `action` prop | Modify |
| `lib/db/companies.ts` | + `updateCompany` | Modify |
| `app/(app)/companies/actions.ts` | + `updateCompany` action | Modify |
| `app/(app)/companies/[id]/edit/page.tsx` | edit company page | Create |
| `app/(app)/employees/actions.ts` | + `saveEmployeeStep`, `setEmployeeCompany` | Modify |
| `tests/unit/date-format.test.ts` | conversion round-trip | Create |
| `tests/e2e/navigation.spec.ts` | sidebar + breadcrumbs | Create |
| `tests/e2e/wizard.spec.ts` | happy + skip path | Create |

---

# Phase A — Design system & app shell

## Task 1: dark base

**Files:** Modify `app/globals.css`

- [ ] **Step 1: Set the base background to zinc-950 and add a focus-ring helper**

Replace the `html, body` block in `app/globals.css` (keep the `@import` and `.cmp-input`):

```css
html,
body {
  background: #09090b; /* zinc-950 */
  color: #e4e4e7; /* zinc-200 */
}
```

- [ ] **Step 2: Verify the app still boots**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: zinc-950 base background"
```

---

## Task 2: Button, Input, Select primitives

**Files:** Create `components/ui/Button.tsx`, `components/ui/Input.tsx`, `components/ui/Select.tsx`

- [ ] **Step 1: Button**

```tsx
// components/ui/Button.tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-500 text-white hover:bg-indigo-400",
  secondary: "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800",
  ghost: "text-zinc-300 hover:bg-zinc-800/60",
  danger: "text-red-400 hover:bg-red-500/10",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
```

- [ ] **Step 2: Input**

```tsx
// components/ui/Input.tsx
import type { InputHTMLAttributes } from "react";

export const CONTROL =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}
```

- [ ] **Step 3: Select**

```tsx
// components/ui/Select.tsx
import type { SelectHTMLAttributes } from "react";
import { CONTROL } from "./Input";

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL} ${className}`} {...props}>
      {children}
    </select>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Button.tsx components/ui/Input.tsx components/ui/Select.tsx
git commit -m "feat: Button/Input/Select UI primitives"
```

---

## Task 3: Card, PageHeader

**Files:** Create `components/ui/Card.tsx`, `components/ui/PageHeader.tsx`

- [ ] **Step 1: Card**

```tsx
// components/ui/Card.tsx
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-zinc-800 bg-zinc-900/50 ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: PageHeader**

```tsx
// components/ui/PageHeader.tsx
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode; // actions (right-aligned)
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/ui/Card.tsx components/ui/PageHeader.tsx
git commit -m "feat: Card + PageHeader primitives"
```

---

## Task 4: Tooltip + Field

**Files:** Create `components/ui/Tooltip.tsx`, `components/ui/Field.tsx`

- [ ] **Step 1: Tooltip (accessible info marker)**

```tsx
// components/ui/Tooltip.tsx
"use client";

import { useState } from "react";

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 text-[10px] leading-none text-zinc-400 hover:border-indigo-400 hover:text-indigo-300"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-5 top-0 z-10 w-60 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Field**

```tsx
// components/ui/Field.tsx
import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

export function Field({
  label,
  hint,
  example,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const tip = [hint, example ? `Example: ${example}` : ""].filter(Boolean).join(" ");
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        {label}
        {tip && <Tooltip text={tip} />}
      </span>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/ui/Tooltip.tsx components/ui/Field.tsx
git commit -m "feat: Tooltip + Field primitives"
```

---

## Task 5: Stepper

**Files:** Create `components/ui/Stepper.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/ui/Stepper.tsx
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number; // 0-based index of the active step
}) {
  return (
    <ol className="mb-8 flex items-center gap-2">
      {steps.map((label, i) => {
        const state =
          i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
                (state === "active"
                  ? "bg-indigo-500 text-white"
                  : state === "done"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-zinc-800 text-zinc-500")
              }
            >
              {i + 1}
            </span>
            <span
              className={
                "text-sm " +
                (state === "todo" ? "text-zinc-500" : "text-zinc-200")
              }
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 h-px w-8 bg-zinc-700" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/ui/Stepper.tsx
git commit -m "feat: Stepper primitive"
```

---

## Task 6: Sidebar + Breadcrumbs

**Files:** Create `components/app-shell/Sidebar.tsx`, `components/app-shell/Breadcrumbs.tsx`

- [ ] **Step 1: Sidebar**

```tsx
// components/app-shell/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";

const NAV = [
  { href: "/dashboard", label: "Employees" },
  { href: "/companies", label: "Companies" },
];

export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4">
      <div className="px-2 py-3 text-sm font-semibold tracking-tight text-zinc-100">
        Gehaltsabrechnung
      </div>
      <nav className="mt-4 flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-md px-3 py-2 text-sm transition " +
                (active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-zinc-800 pt-4">
        <p className="truncate px-3 text-xs text-zinc-500">{username}</p>
        <form action={logout}>
          <button className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-100">
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Breadcrumbs**

```tsx
// components/app-shell/Breadcrumbs.tsx
import Link from "next/link";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="mb-6 flex items-center gap-1.5 text-sm text-zinc-500">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-zinc-700">›</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-zinc-300">
              {it.label}
            </Link>
          ) : (
            <span className="text-zinc-300">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/app-shell/Sidebar.tsx components/app-shell/Breadcrumbs.tsx
git commit -m "feat: Sidebar + Breadcrumbs"
```

---

## Task 7: route group + shell layout (move pages)

**Files:** Create `app/(app)/layout.tsx`; move `app/{dashboard,companies,employees}` → `app/(app)/...`; update 4 component imports.

- [ ] **Step 1: Move the authenticated route folders into the `(app)` group**

Run (Bash tool):
```bash
mkdir -p "app/(app)"
git mv app/dashboard "app/(app)/dashboard"
git mv app/companies "app/(app)/companies"
git mv app/employees "app/(app)/employees"
```
Expected: three folders moved; URLs are unchanged because `(app)` is a route group.

- [ ] **Step 2: Create the shell layout**

```tsx
// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app-shell/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <Sidebar username={profile?.username ?? user.email ?? ""} />
      <div className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update the 4 component imports to the moved action paths**

In `components/EmployeeForm.tsx` and `components/EmployeeList.tsx`, change `@/app/employees/actions` → `@/app/(app)/employees/actions`.
In `components/MonthForm.tsx` and `components/SlipPreview.tsx`, change `@/app/employees/[id]/payslips/actions` → `@/app/(app)/employees/[id]/payslips/actions`.

- [ ] **Step 4: Verify build + existing E2E unaffected by the move**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds; routes `/dashboard`, `/companies`, `/employees/...` still listed (unchanged paths).

Run: `npx playwright test tests/e2e/crud.spec.ts tests/e2e/payslip.spec.ts`
Expected: PASS (URLs unchanged).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: app shell layout + (app) route group"
```

---

**▶ CHECKPOINT 1 (end of Phase A):** the app now has a persistent sidebar + framed content on every signed-in page. Good place to review the navigation feel before the forms/wizard work.

---

# Phase B — Forms, wizard & company edit

## Task 8: date-format helpers (TDD)

**Files:** Create `lib/date-format.ts`, `tests/unit/date-format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/date-format.test.ts
import { describe, it, expect } from "vitest";
import { toDateInput, fromDateInput } from "@/lib/date-format";

describe("ddmmyy <-> ISO", () => {
  it("stored ddmmyy to date-input ISO", () => {
    expect(toDateInput("250789", "ddmmyy")).toBe("1989-07-25");
    expect(toDateInput("020326", "ddmmyy")).toBe("2026-03-02");
    expect(toDateInput("", "ddmmyy")).toBe("");
  });
  it("date-input ISO to stored ddmmyy", () => {
    expect(fromDateInput("1989-07-25", "ddmmyy")).toBe("250789");
    expect(fromDateInput("2026-03-02", "ddmmyy")).toBe("020326");
    expect(fromDateInput("", "ddmmyy")).toBe("");
  });
});

describe("TT.MM.JJJJ <-> ISO", () => {
  it("stored dotted to ISO and back", () => {
    expect(toDateInput("31.03.2026", "dmy-dot")).toBe("2026-03-31");
    expect(fromDateInput("2026-03-31", "dmy-dot")).toBe("31.03.2026");
  });
  it("passes through unparseable values unchanged on read", () => {
    expect(toDateInput("garbage", "ddmmyy")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- date-format`
Expected: FAIL — cannot find module `@/lib/date-format`.

- [ ] **Step 3: Implement**

```ts
// lib/date-format.ts
// Converts between a native <input type="date"> value ("YYYY-MM-DD") and the
// formats the slip engine stores. Pure; no Date objects (avoid TZ surprises).
export type DateFmt = "ddmmyy" | "dmy-dot";

const pad = (n: string) => n.padStart(2, "0");

export function toDateInput(stored: string, fmt: DateFmt): string {
  const s = (stored || "").trim();
  if (!s) return "";
  if (fmt === "ddmmyy") {
    const m = /^(\d{2})(\d{2})(\d{2})$/.exec(s);
    if (!m) return "";
    const [, dd, mm, yy] = m;
    const year = Number(yy) < 70 ? `20${yy}` : `19${yy}`;
    return `${year}-${mm}-${dd}`;
  }
  // dmy-dot: "TT.MM.JJJJ"
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export function fromDateInput(iso: string, fmt: DateFmt): string {
  const s = (iso || "").trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s; // already in another format; leave as-is
  const [, yyyy, mm, dd] = m;
  if (fmt === "ddmmyy") return `${pad(dd)}${pad(mm)}${yyyy.slice(2)}`;
  return `${pad(dd)}.${pad(mm)}.${yyyy}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- date-format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/date-format.ts tests/unit/date-format.test.ts
git commit -m "feat: date input <-> stored format helpers"
```

---

## Task 9: field configs + date-aware buildEmployeeData (TDD) + EmployeeFields

**Files:** Modify `lib/employee-fields.ts`, `lib/employee-data.ts`; Create `lib/company-fields.ts`, `components/EmployeeFields.tsx`; Test `tests/unit/employee-data.test.ts`

- [ ] **Step 1: Extend the employee field type + add help/date metadata; drop the Box field**

Replace `lib/employee-fields.ts` with:

```ts
import type { DateFmt } from "@/lib/date-format";

export type EmployeeField = {
  path: string;
  label: string;
  type?: "text" | "checkbox";
  description?: string;
  example?: string;
  date?: DateFmt;
};
export type EmployeeFieldGroup = { title: string; fields: EmployeeField[] };

export const EMPLOYEE_FIELD_GROUPS: EmployeeFieldGroup[] = [
  {
    title: "Mitarbeiter",
    fields: [
      { path: "mitarbeiter.name", label: "Name", description: "Employee full name.", example: "Max Mustermann" },
      { path: "mitarbeiter.strasse", label: "Straße + Nr.", description: "Street and house number.", example: "Hauptstr. 12" },
      { path: "mitarbeiter.plzOrt", label: "PLZ + Ort", description: "Postal code and city.", example: "10115 Berlin" },
    ],
  },
  {
    title: "Kopfdaten",
    fields: [
      { path: "meta.persNr", label: "Personal-Nr.", description: "Internal personnel number; also shown in the slip's number box.", example: "1122672" },
      { path: "meta.geburtsdatum", label: "Geburtsdatum", description: "Date of birth.", example: "25.07.1989", date: "ddmmyy" },
      { path: "meta.stKl", label: "Steuerklasse", description: "German income-tax class, 1–6.", example: "1" },
      { path: "meta.konfession", label: "Konfession", description: "Religious denomination for church tax (blank = none).", example: "rk" },
      { path: "meta.svNummer", label: "SV-Nummer", description: "Social-insurance number.", example: "65250789E018" },
      { path: "meta.krankenkasse", label: "Krankenkasse", description: "Health-insurance fund name.", example: "Techniker Krankenkasse" },
      { path: "meta.kkProzent", label: "KK %", description: "Total health-insurance rate shown on the slip.", example: "17,29" },
      { path: "meta.pgrs", label: "PGRS", description: "Personengruppenschlüssel — person-group key.", example: "1111" },
      { path: "meta.bgrs", label: "BGRS", description: "Beitragsgruppenschlüssel — contribution-group key.", example: "2" },
      { path: "meta.eintritt", label: "Eintritt", description: "Employment start date.", example: "02.03.2026", date: "ddmmyy" },
      { path: "meta.austritt", label: "Austritt", description: "Employment end date (blank if ongoing).", example: "02.04.2026", date: "ddmmyy" },
      { path: "meta.steuerId", label: "Steuer-ID", description: "Tax identification number (IdNr).", example: "69814453022" },
      { path: "meta.abtNr", label: "Abt.-Nr.", description: "Department number.", example: "1" },
    ],
  },
  {
    title: "Automatik (Steuer/SV-Berechnung)",
    fields: [
      { path: "automatik.enabled", label: "Automatik aktiv", type: "checkbox", description: "When on, the slip auto-computes Lohnsteuer + SV from the values below." },
      { path: "automatik.steuerklasse", label: "Steuerklasse (1-6)", description: "Tax class used by the auto calculation.", example: "1" },
      { path: "automatik.bundesland", label: "Bundesland (z.B. BE)", description: "Federal state code (affects church tax / Sachsen PV).", example: "BE" },
      { path: "automatik.kkZusatzbeitrag", label: "KK-Zusatzbeitrag %", description: "Health-insurance additional contribution rate.", example: "2,69" },
      { path: "automatik.kinder", label: "Kinder", description: "Number of children (affects PV rate).", example: "0" },
      { path: "automatik.age", label: "Alter", description: "Age (affects childless PV surcharge ≥23).", example: "36" },
      { path: "automatik.midijob", label: "Midijob", type: "checkbox", description: "Apply the Midijob reduced contribution base." },
      { path: "automatik.westOst", label: "West/Ost (W/O)", description: "Region for the RV/AV ceiling.", example: "W" },
      { path: "automatik.freibetragMonatlich", label: "Freibetrag mtl.", description: "Monthly tax allowance.", example: "0" },
    ],
  },
];

export const EMPLOYEE_FIELD_PATHS = EMPLOYEE_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.path),
);

// path -> stored format, for fields rendered as date pickers
export const EMPLOYEE_DATE_PATHS: Record<string, DateFmt> = Object.fromEntries(
  EMPLOYEE_FIELD_GROUPS.flatMap((g) =>
    g.fields.filter((f) => f.date).map((f) => [f.path, f.date as DateFmt]),
  ),
);
```

- [ ] **Step 2: Write the failing test for date conversion on write**

Add to `tests/unit/employee-data.test.ts` (new `describe`):

```ts
import { describe, it, expect } from "vitest";
import { buildEmployeeData } from "@/lib/employee-data";

describe("buildEmployeeData date conversion", () => {
  it("converts ISO date inputs to the stored ddmmyy format", () => {
    const f = new FormData();
    f.append("mitarbeiter.name", "Max");
    f.append("meta.geburtsdatum", "1989-07-25");
    f.append("meta.eintritt", "2026-03-02");
    const data = buildEmployeeData(f);
    expect(data.meta.geburtsdatum).toBe("250789");
    expect(data.meta.eintritt).toBe("020326");
  });

  it("leaves non-date meta fields untouched", () => {
    const f = new FormData();
    f.append("meta.steuerId", "69814453022");
    expect(buildEmployeeData(f).meta.steuerId).toBe("69814453022");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test -- employee-data`
Expected: FAIL — `geburtsdatum` is still `"1989-07-25"` (no conversion yet).

- [ ] **Step 4: Add the conversion to buildEmployeeData**

In `lib/employee-data.ts`, add the import and convert date paths. At the top:

```ts
import { EMPLOYEE_DATE_PATHS } from "@/lib/employee-fields";
import { fromDateInput } from "@/lib/date-format";
```

Then inside the `for (const [path, raw] of formData.entries())` loop, replace the final `else` branch so date paths convert:

```ts
    } else if (EMPLOYEE_DATE_PATHS[path]) {
      setNested(data, group, key, fromDateInput(value, EMPLOYEE_DATE_PATHS[path]));
    } else {
      setNested(data, group, key, value);
    }
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test -- employee-data`
Expected: PASS (existing + 2 new).

- [ ] **Step 6: Company field config**

```ts
// lib/company-fields.ts
export type CompanyField = {
  name: string;
  label: string;
  description: string;
  example?: string;
};

export const COMPANY_FIELDS: CompanyField[] = [
  { name: "name", label: "Display name", description: "Internal name for the dropdown (not printed).", example: "ACME GmbH" },
  { name: "firma", label: "Employer line", description: "Employer address printed on the slip; use * to separate lines.", example: "ACME GmbH*Rankestr. 2*10789 Berlin" },
  { name: "mandant", label: "Mandant-Code (oben)", description: "Full Mandant code line printed at the top.", example: "133267/30605/00107" },
  { name: "mandant_box", label: "Mandant-Code (Box)", description: "Short Mandant value printed in the small box. Often just one segment of the code above.", example: "30605" },
  { name: "roc_code", label: "R0C-Code", description: "Optional R0C reference code.", example: "R0C9" },
];
```

- [ ] **Step 7: EmployeeFields shared block**

```tsx
// components/EmployeeFields.tsx
"use client";

import { EMPLOYEE_FIELD_GROUPS } from "@/lib/employee-fields";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { toDateInput } from "@/lib/date-format";
import type { EmployeeData } from "@/lib/db/types";

function getPath(obj: unknown, path: string): string {
  const [g, k] = path.split(".");
  const bucket = (obj as Record<string, Record<string, unknown>> | undefined)?.[g];
  const v = bucket?.[k];
  if (v === undefined || v === null) return "";
  return typeof v === "boolean" ? (v ? "on" : "") : String(v);
}

export function EmployeeFields({ data }: { data?: EmployeeData }) {
  return (
    <div className="flex flex-col gap-8">
      {EMPLOYEE_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-4">
          <legend className="text-sm font-medium text-zinc-300">{group.title}</legend>
          <div className="grid grid-cols-2 gap-4">
            {group.fields.map((f) => {
              const value = data ? getPath(data, f.path) : "";
              if (f.type === "checkbox") {
                return (
                  <label key={f.path} className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" name={f.path} defaultChecked={value === "on"} />
                    {f.label}
                  </label>
                );
              }
              return (
                <Field key={f.path} label={f.label} hint={f.description} example={f.example}>
                  <Input
                    name={f.path}
                    type={f.date ? "date" : "text"}
                    defaultValue={f.date ? toDateInput(value, f.date) : value}
                  />
                </Field>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/employee-fields.ts lib/employee-data.ts lib/company-fields.ts components/EmployeeFields.tsx tests/unit/employee-data.test.ts
git commit -m "feat: field help + date fields config; date-aware buildEmployeeData; EmployeeFields"
```

---

## Task 10: restyle EmployeeForm (edit) + dashboard/detail/preview with the shell

**Files:** Modify `components/EmployeeForm.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/employees/[id]/page.tsx`, `app/(app)/employees/[id]/edit/page.tsx`, `app/(app)/employees/[id]/payslips/[payslipId]/page.tsx`

- [ ] **Step 1: EmployeeForm uses EmployeeFields + primitives (company select + save)**

Replace `components/EmployeeForm.tsx` with:

```tsx
import { EmployeeFields } from "@/components/EmployeeFields";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { Company, Employee } from "@/lib/db/types";
import { saveEmployee } from "@/app/(app)/employees/actions";

export function EmployeeForm({
  companies,
  employee,
}: {
  companies: Company[];
  employee?: Employee;
}) {
  return (
    <form action={saveEmployee} className="flex flex-col gap-8">
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <Field label="Company" hint="Which company this employee is paid under.">
        <Select name="company_id" defaultValue={employee?.company_id ?? ""}>
          <option value="">— none —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <EmployeeFields data={employee?.data} />
      <Button type="submit" className="self-start">
        Save employee
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Dashboard — PageHeader + actions (Employees list)**

Replace the `return (...)` of `app/(app)/dashboard/page.tsx` so it uses `PageHeader` (drop the inline logout — it now lives in the sidebar):

```tsx
  return (
    <>
      <PageHeader title="Employees" description={profile?.username ?? user.email ?? ""}>
        <Link href="/companies" className="text-sm text-zinc-400 hover:text-zinc-200">
          Companies
        </Link>
        <Link
          href="/employees/new"
          className="rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          New employee
        </Link>
      </PageHeader>
      <EmployeeList employees={employees} />
    </>
  );
```

Add `import { PageHeader } from "@/components/ui/PageHeader";` at the top and remove the `import { logout }` line and the surrounding `<main>` wrapper (the shell provides the frame).

- [ ] **Step 3: Employee detail — breadcrumbs + PageHeader**

Replace the `return (...)` of `app/(app)/employees/[id]/page.tsx`:

```tsx
  return (
    <>
      <Breadcrumbs
        items={[{ label: "Employees", href: "/dashboard" }, { label: employee.name || "(unnamed)" }]}
      />
      <PageHeader title={employee.name || "(unnamed)"}>
        <Link href={`/employees/${id}/edit`} className="text-sm text-zinc-400 hover:text-zinc-200">
          Edit details
        </Link>
        <Link
          href={`/employees/${id}/payslips/new`}
          className="rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Add month
        </Link>
      </PageHeader>
      <ul className="divide-y divide-zinc-800">
        {payslips.length === 0 && <li className="py-4 text-zinc-500">No months yet.</li>}
        {payslips.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <Link href={`/employees/${id}/payslips/${p.id}`} className="text-zinc-100 hover:underline">
              {p.data.zeitraum.monat} {p.data.zeitraum.jahr}
            </Link>
            <span className="text-xs text-zinc-500">
              {p.status === "issued" ? `#${p.serial_number}` : "draft"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
```

Add imports `PageHeader` and `Breadcrumbs`; remove the outer `<main>` wrapper.

- [ ] **Step 4: Edit-employee page — breadcrumbs + header, drop `<main>`**

Replace `app/(app)/employees/[id]/edit/page.tsx` body so the content is wrapped by the shell (no `<main className="mx-auto max-w-3xl p-10">`), with a `Breadcrumbs` (Employees › name › Edit) and `PageHeader title="Edit employee"`, keeping `<EmployeeForm companies={companies} employee={employee} />`.

```tsx
import { notFound } from "next/navigation";
import { listCompanies } from "@/lib/db/companies";
import { getEmployee } from "@/lib/db/employees";
import { EmployeeForm } from "@/components/EmployeeForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [companies, employee] = await Promise.all([listCompanies(), getEmployee(id)]);
  if (!employee) notFound();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/dashboard" },
          { label: employee.name || "(unnamed)", href: `/employees/${id}` },
          { label: "Edit" },
        ]}
      />
      <PageHeader title="Edit employee" />
      <EmployeeForm companies={companies} employee={employee} />
    </>
  );
}
```

- [ ] **Step 5: Preview page — breadcrumbs + drop `<main>`**

In `app/(app)/employees/[id]/payslips/[payslipId]/page.tsx`, replace the outer `<main className="mx-auto max-w-5xl p-6">` wrapper with a fragment containing a `Breadcrumbs` (Employees › name › `Monat Jahr`) above `<SlipPreview ... />`.

```tsx
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/dashboard" },
          { label: employee.name || "(unnamed)", href: `/employees/${id}` },
          { label: `${payslip.data.zeitraum.monat} ${payslip.data.zeitraum.jahr}` },
        ]}
      />
      <SlipPreview
        company={company}
        employee={employee}
        payslip={payslip}
        templates={TEMPLATES}
        otherMonths={otherMonths}
      />
    </>
  );
```

Add `import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";`.

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: restyle employee screens with shell + primitives + tooltips + date pickers"
```

---

## Task 11: EmployeeWizard (skippable) + wizard actions + new-employee page

**Files:** Modify `app/(app)/employees/actions.ts`, `components/MonthForm.tsx`; Create `components/EmployeeWizard.tsx`; Modify `app/(app)/employees/new/page.tsx`

- [ ] **Step 1: Add wizard server actions (no redirect on step 1)**

Append to `app/(app)/employees/actions.ts`:

```ts
import { createEmployee as createEmployeeDb } from "@/lib/db/employees";

export type WizardSaveState = { employeeId?: string; error?: string };

// Step 1: create the employee draft and return its id (no redirect).
export async function saveEmployeeStep(
  _prev: WizardSaveState,
  formData: FormData,
): Promise<WizardSaveState> {
  const companyRaw = String(formData.get("company_id") ?? "");
  const company_id = companyRaw === "" ? null : companyRaw;
  const data = buildEmployeeData(formData);
  const employee = await createEmployeeDb({ company_id, data });
  revalidatePath("/dashboard");
  return { employeeId: employee.id };
}

// Step 2: attach the chosen company to the employee.
export async function setEmployeeCompany(
  employeeId: string,
  companyId: string | null,
): Promise<void> {
  const { getEmployee } = await import("@/lib/db/employees");
  const emp = await getEmployee(employeeId);
  if (!emp) return;
  await updateEmployee(employeeId, { company_id: companyId, data: emp.data });
}
```

(`buildEmployeeData`, `updateEmployee`, `revalidatePath` are already imported in this file from Plan 4.)

- [ ] **Step 2: MonthForm accepts an optional `action` override**

In `components/MonthForm.tsx`, change the signature + action binding so the wizard can redirect elsewhere:

```tsx
export function MonthForm({
  employeeId,
  templateId,
  action,
}: {
  employeeId: string;
  templateId: string;
  action?: (formData: FormData) => void;
}) {
  // ...
  const boundAction = action ?? createMonth.bind(null, employeeId, templateId);
  // replace `action={action}` on the <form> with `action={boundAction}`
```

(Keep the rest of MonthForm unchanged; only the prop + the `<form action={boundAction}>` binding change.)

- [ ] **Step 3: Add a wizard month action that lands on the employee page**

Append to `app/(app)/employees/[id]/payslips/actions.ts`:

```ts
// Like createMonth, but returns to the employee detail page (used by the wizard).
export async function createMonthThenDetail(
  employeeId: string,
  templateId: string,
  formData: FormData,
): Promise<void> {
  const { buildPayslipData } = await import("@/lib/payslip-data");
  const { createPayslip } = await import("@/lib/db/payslips");
  await createPayslip({
    employee_id: employeeId,
    template_id: templateId,
    data: buildPayslipData(formData),
  });
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}`);
}
```

- [ ] **Step 4: EmployeeWizard**

```tsx
// components/EmployeeWizard.tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { EmployeeFields } from "@/components/EmployeeFields";
import { CompanyForm } from "@/components/CompanyForm";
import { MonthForm } from "@/components/MonthForm";
import {
  saveEmployeeStep,
  setEmployeeCompany,
  type WizardSaveState,
} from "@/app/(app)/employees/actions";
import { createMonthThenDetail } from "@/app/(app)/employees/[id]/payslips/actions";
import { DEFAULT_TEMPLATE_ID } from "@/lib/template-manifest";
import type { Company } from "@/lib/db/types";

const STEPS = ["Personal", "Company", "Months"];

export function EmployeeWizard({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [addingCompany, setAddingCompany] = useState(false);
  const [localCompanies, setLocalCompanies] = useState(companies);

  const [state, formAction, pending] = useActionState<WizardSaveState, FormData>(
    saveEmployeeStep,
    {},
  );

  useEffect(() => {
    if (state.employeeId && !employeeId) {
      setEmployeeId(state.employeeId);
      setStep(1);
    }
  }, [state.employeeId, employeeId]);

  const finish = () => router.push(`/employees/${employeeId}`);

  const goCompany = async () => {
    if (employeeId) await setEmployeeCompany(employeeId, companyId || null);
    setStep(2);
  };

  const template =
    localCompanies.find((c) => c.id === companyId)?.default_template ??
    DEFAULT_TEMPLATE_ID;

  return (
    <div>
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <form action={formAction} className="flex flex-col gap-8">
          <EmployeeFields />
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Saving…" : "Continue"}
          </Button>
        </form>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <Field label="Company" hint="Pick the company this employee is paid under, or add a new one.">
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">— none —</option>
              {localCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {addingCompany ? (
            <CompanyForm
              onCreated={(c) => {
                setLocalCompanies((list) => [...list, c]);
                setCompanyId(c.id);
                setAddingCompany(false);
              }}
              onCancel={() => setAddingCompany(false)}
            />
          ) : (
            <Button variant="ghost" className="self-start" onClick={() => setAddingCompany(true)}>
              + Add company
            </Button>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={goCompany}>Continue</Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Skip for now
            </Button>
            <Button variant="ghost" onClick={finish}>
              Save &amp; finish
            </Button>
          </div>
        </div>
      )}

      {step === 2 && employeeId && (
        <div className="flex flex-col gap-6">
          <MonthForm
            employeeId={employeeId}
            templateId={template}
            action={createMonthThenDetail.bind(null, employeeId, template)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="ghost" onClick={finish}>
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: New-employee page renders the wizard**

Replace `app/(app)/employees/new/page.tsx`:

```tsx
import { listCompanies } from "@/lib/db/companies";
import { EmployeeWizard } from "@/components/EmployeeWizard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function NewEmployeePage() {
  const companies = await listCompanies();
  return (
    <>
      <Breadcrumbs items={[{ label: "Employees", href: "/dashboard" }, { label: "New" }]} />
      <PageHeader title="New employee" />
      <EmployeeWizard companies={companies} />
    </>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Depends on `CompanyForm` from Task 12 — if running tasks in order, implement Task 12 before this typecheck, or stub `CompanyForm`'s `onCreated`/`onCancel` props now. **Recommendation: do Task 12 before this step's typecheck.**)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 3-step employee wizard (skippable) + wizard actions"
```

---

## Task 12: CompanyForm + edit company + companies page

**Files:** Modify `lib/db/companies.ts`, `app/(app)/companies/actions.ts`, `app/(app)/companies/page.tsx`; Create `components/CompanyForm.tsx`, `app/(app)/companies/[id]/edit/page.tsx`

- [ ] **Step 1: `updateCompany` data-layer function**

Append to `lib/db/companies.ts`:

```ts
export async function updateCompany(
  id: string,
  input: {
    name: string;
    firma: string;
    mandant: string;
    mandant_box: string;
    roc_code: string;
    default_template: string;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(input).eq("id", id);
  if (error) throw error;
}

export async function getCompany(id: string): Promise<Company | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Company | null;
}
```

- [ ] **Step 2: `updateCompany` + returning-create server actions**

In `app/(app)/companies/actions.ts`, add (keep the existing `createCompany`/`deleteCompany`):

```ts
import { redirect } from "next/navigation";
import {
  createCompany as createCompanyDb,
  updateCompany as updateCompanyDb,
} from "@/lib/db/companies";
import type { Company } from "@/lib/db/types";

function readCompany(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    firma: String(formData.get("firma") ?? ""),
    mandant: String(formData.get("mandant") ?? ""),
    mandant_box: String(formData.get("mandant_box") ?? ""),
    roc_code: String(formData.get("roc_code") ?? ""),
    default_template: String(formData.get("default_template") ?? "datev-classic"),
  };
}

export async function updateCompany(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  await updateCompanyDb(id, readCompany(formData));
  revalidatePath("/companies");
  redirect("/companies");
}

// Used by the wizard's inline add; returns the created company.
export async function createCompanyReturning(formData: FormData): Promise<Company> {
  const company = await createCompanyDb(readCompany(formData));
  revalidatePath("/companies");
  return company;
}
```

(Refactor the existing `createCompany` to call `readCompany(formData)` to avoid duplication.)

- [ ] **Step 3: CompanyForm (server-action form + optional inline callback mode)**

```tsx
// components/CompanyForm.tsx
"use client";

import { useState } from "react";
import { COMPANY_FIELDS } from "@/lib/company-fields";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TEMPLATES } from "@/lib/template-manifest";
import {
  createCompany,
  updateCompany,
  createCompanyReturning,
} from "@/app/(app)/companies/actions";
import type { Company } from "@/lib/db/types";

export function CompanyForm({
  company,
  onCreated,
  onCancel,
}: {
  company?: Company;
  onCreated?: (c: Company) => void; // inline mode (wizard)
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // Inline mode: capture the created company instead of navigating.
  if (onCreated) {
    return (
      <form
        className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
        action={async (fd) => {
          setBusy(true);
          const c = await createCompanyReturning(fd);
          setBusy(false);
          onCreated(c);
        }}
      >
        <CompanyFields company={company} />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save company"}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    );
  }

  // Page mode: create or edit, then navigate (server action redirects).
  return (
    <form action={company ? updateCompany : createCompany} className="flex flex-col gap-4">
      {company && <input type="hidden" name="id" value={company.id} />}
      <CompanyFields company={company} />
      <Button type="submit" className="self-start">
        {company ? "Save changes" : "Add company"}
      </Button>
    </form>
  );
}

function CompanyFields({ company }: { company?: Company }) {
  return (
    <>
      {COMPANY_FIELDS.map((f) => (
        <Field key={f.name} label={f.label} hint={f.description} example={f.example}>
          <Input
            name={f.name}
            defaultValue={(company as unknown as Record<string, string>)?.[f.name] ?? ""}
          />
        </Field>
      ))}
      <Field label="Default template" hint="Used as the starting template for new slips (changeable per slip).">
        <Select name="default_template" defaultValue={company?.default_template ?? "datev-classic"}>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
```

- [ ] **Step 4: Companies page — cards with Edit/Delete + add form**

Replace `app/(app)/companies/page.tsx`:

```tsx
import Link from "next/link";
import { listCompanies } from "@/lib/db/companies";
import { CompanyForm } from "@/components/CompanyForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { deleteCompany } from "./actions";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  return (
    <>
      <PageHeader title="Companies" description="Private to your account." />
      <ul className="flex flex-col gap-2">
        {companies.length === 0 && <li className="text-zinc-500">No companies yet.</li>}
        {companies.map((c) => (
          <li key={c.id}>
            <Card className="flex items-center justify-between p-4">
              <div>
                <p className="text-zinc-100">{c.name}</p>
                <p className="text-xs text-zinc-500">{c.firma}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/companies/${c.id}/edit`} className="text-sm text-zinc-400 hover:text-zinc-200">
                  Edit
                </Link>
                <form action={deleteCompany}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-red-400">Delete</button>
                </form>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-zinc-800 pt-8">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">Add company</h2>
        <CompanyForm />
      </div>
    </>
  );
}
```

- [ ] **Step 5: Edit-company page**

```tsx
// app/(app)/companies/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/db/companies";
import { CompanyForm } from "@/components/CompanyForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();
  return (
    <>
      <Breadcrumbs
        items={[{ label: "Companies", href: "/companies" }, { label: company.name }, { label: "Edit" }]}
      />
      <PageHeader title="Edit company" />
      <CompanyForm company={company} />
    </>
  );
}
```

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds; `/companies/[id]/edit` route listed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: company add/edit form with help; edit-company page"
```

---

## Task 13: SlipPreview toolbar polish + auth pages restyle

**Files:** Modify `components/SlipPreview.tsx`, `components/AuthForm.tsx`

- [ ] **Step 1: SlipPreview toolbar uses primitives**

In `components/SlipPreview.tsx`, swap the raw `<select>`/`<button>` in the toolbar for `Select` and `Button` primitives (import them), keeping all handlers and logic identical:

```tsx
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
// ...
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-zinc-300">
          Template{" "}
          <Select
            value={templateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="inline-block w-auto"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.supportsCumulative ? "" : " (single month)"}
              </option>
            ))}
          </Select>
        </label>
        {payslip.serial_number != null ? (
          <span className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300">
            Serial #{payslip.serial_number}
          </span>
        ) : (
          <Button onClick={onIssue}>Issue &amp; assign serial</Button>
        )}
      </div>
```

- [ ] **Step 2: AuthForm matches the design system**

In `components/AuthForm.tsx`, replace the raw input/button classes with the shared control + Button. Import `{ Input } from "@/components/ui/Input"` and `{ Button } from "@/components/ui/Button"`, render each field with `Input`, and the submit as `<Button type="submit" disabled={pending}>`. Keep the centered `<main>` layout (auth pages stay outside the shell). The error/footer markup is unchanged except color classes `text-neutral-*` → `text-zinc-*`.

- [ ] **Step 3: Typecheck + build + demo/auth E2E**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

Run: `npx playwright test tests/e2e/auth.spec.ts tests/e2e/demo-slip.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/SlipPreview.tsx components/AuthForm.tsx
git commit -m "style: slip toolbar + auth form use primitives"
```

---

# Phase C — Tests & close-out

## Task 14: navigation + wizard E2E, full suite, close-out

**Files:** Create `tests/e2e/navigation.spec.ts`, `tests/e2e/wizard.spec.ts`

- [ ] **Step 1: Navigation E2E**

```ts
// tests/e2e/navigation.spec.ts
import { test, expect } from "@playwright/test";

test("sidebar navigates between sections; breadcrumbs render", async ({ page }) => {
  const tag = Date.now().toString(36);
  await page.goto("/signup");
  await page.fill("input[name='username']", `n${tag}`);
  await page.fill("input[name='email']", `nav_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  // sidebar is present and reaches Companies
  await page.getByRole("link", { name: "Companies" }).first().click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();

  // back to Employees via sidebar
  await page.getByRole("link", { name: "Employees" }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
```

- [ ] **Step 2: Wizard E2E (happy + skip)**

```ts
// tests/e2e/wizard.spec.ts
import { test, expect } from "@playwright/test";

async function signup(page: import("@playwright/test").Page, tag: string) {
  await page.goto("/signup");
  await page.fill("input[name='username']", `w${tag}`);
  await page.fill("input[name='email']", `wiz_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("wizard: personal -> inline company -> month -> employee detail", async ({ page }) => {
  const tag = Date.now().toString(36);
  await signup(page, tag);

  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Wizard Hero");
  await page.click("button:has-text('Continue')");

  // step 2: add a company inline
  await page.click("button:has-text('+ Add company')");
  await page.fill("input[name='name']", "WizCo");
  await page.fill("input[name='firma']", "WizCo GmbH*Str 1*10115 Berlin");
  await page.click("button:has-text('Save company')");
  await page.click("button:has-text('Continue')");

  // step 3: add a month, finish on employee detail
  await page.selectOption("select[name='monat']", "März");
  await page.fill("input[name='jahr']", "2026");
  await page.fill("input[placeholder='Menge']", "100,00");
  await page.fill("input[placeholder='Faktor']", "20,00");
  await page.click("button:has-text('Save month')");

  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Wizard Hero" })).toBeVisible();
  await expect(page.getByText("März 2026")).toBeVisible();
});

test("wizard: can skip company and months after step 1", async ({ page }) => {
  const tag = Date.now().toString(36) + "s";
  await signup(page, tag);

  await page.goto("/employees/new");
  await page.fill("input[name='mitarbeiter.name']", "Skip Person");
  await page.click("button:has-text('Continue')");
  await page.click("button:has-text('Skip for now')"); // company
  await page.click("button:has-text('Skip for now')"); // months

  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Skip Person" })).toBeVisible();
  await expect(page.getByText("No months yet.")).toBeVisible();
});
```

- [ ] **Step 3: Company-edit E2E**

Add to `tests/e2e/navigation.spec.ts`:

```ts
test("company can be edited", async ({ page }) => {
  const tag = Date.now().toString(36) + "e";
  await page.goto("/signup");
  await page.fill("input[name='username']", `e${tag}`);
  await page.fill("input[name='email']", `edit_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/companies");
  await page.fill("input[name='name']", "OldName");
  await page.fill("input[name='firma']", "OldName GmbH*Str 1*10115 Berlin");
  await page.click("button:has-text('Add company')");
  await expect(page.getByText("OldName", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit" }).first().click();
  await page.fill("input[name='name']", "NewName");
  await page.fill("input[name='mandant_box']", "30605");
  await page.click("button:has-text('Save changes')");

  await expect(page.getByText("NewName", { exact: true })).toBeVisible();
});
```

- [ ] **Step 4: Run the new E2E specs**

Run: `npx playwright test tests/e2e/navigation.spec.ts tests/e2e/wizard.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Full suite**

Run: `npm run test`
Expected: all unit PASS (incl. date-format + employee-data date conversion).

Run: `npm run test:e2e`
Expected: all E2E PASS (auth, demo, crud, payslip, template-contract, navigation, wizard).

- [ ] **Step 6: Update project memory**

In `project-saas-refactor.md`, mark Plan 5 done (app shell + design system + wizard + field help + company edit + date pickers); note `(app)` route group, `components/ui/` primitives, `EmployeeWizard`, `lib/date-format.ts`.

- [ ] **Step 7: Present the Plan 5 completion checkpoint.**

---

## Self-Review (against the spec)

**Spec coverage:**
- Persistent sidebar on every authed page + active state → Tasks 6, 7. ✓
- Breadcrumbs on nested pages → Tasks 6, 10, 11, 12. ✓
- Dark design system (palette + primitives) → Tasks 1–5. ✓
- 3-step wizard, saved after step 1, skippable, finish early → Task 11. ✓
- Edit uses panels without stepper → Task 10 (EmployeeForm + EmployeeFields). ✓
- Field tooltips (description + example) → Tasks 4, 9 (employee), 12 (company). ✓
- Edit company + Mandant oben/box labeled → Task 12. ✓
- Date pickers, stored format preserved → Tasks 8, 9. ✓
- Pers-Nr shown once → Task 9 (persNrBox removed from groups; `assembleState` still mirrors it). ✓
- Slip preview in shell with clean toolbar → Tasks 10 (breadcrumbs), 13 (toolbar). ✓
- Engine/templates/serial/persistence untouched; existing tests pass → enforced by the hard boundary + Task 7/13 regression runs. ✓

**Placeholder scan:** every code step has complete code. The one cross-task dependency (Task 11 needs `CompanyForm` from Task 12) is called out explicitly with the recommended ordering. No TBD/TODO.

**Type consistency:** `WizardSaveState` defined in Task 11 and consumed there. `CompanyForm` props (`company?`, `onCreated?`, `onCancel?`) defined in Task 12 and used by the wizard in Task 11. `createCompanyReturning`/`updateCompany` actions (Task 12) match their imports. `toDateInput`/`fromDateInput(value, fmt)` signatures consistent across Tasks 8, 9. `EMPLOYEE_DATE_PATHS` defined in Task 9 step 1 and used in step 4. `Button`/`Input`/`Select`/`Field`/`Card`/`PageHeader`/`Stepper`/`Breadcrumbs`/`Sidebar` APIs are stable across all consuming tasks.

**Ordering note for the executor:** implement **Task 12 before Task 11's typecheck** (the wizard imports `CompanyForm`). All other tasks are in dependency order.
