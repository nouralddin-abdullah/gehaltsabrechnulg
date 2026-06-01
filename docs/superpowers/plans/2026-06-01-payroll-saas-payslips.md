# Payslips Engine — Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a saved employee into real, persisted monthly payslips that render through the existing template iframes, carry a true global serial number (assigned once, reused on reprint), and show a true-sum cumulative "all months worked" block — with all math staying inside the templates.

**Architecture:** A `payslips` table (one row per employee-month) stores the month's *inputs* (`data` JSONB) and a snapshot of the template-computed figures (`computed_totals` JSONB). A pure `assembleState()` maps `company + employee + payslip` → the exact `SlipState` the templates consume (no arithmetic). `SlipFrame` posts that state, then reads the template's own computed values back out of the same-origin iframe to capture `computed_totals`. Cumulative totals are the **sum** of those captured snapshots across the year. A global `serial_counter` + `allocate_serial()` SECURITY DEFINER function assigns gapless numbers; the number is injected into the slip's existing code field (`state.bank.code` → `#fCode`). Two small, backward-compatible template edits port the original shell's `autoVerdienst()` into the 11 full templates and make `renderJahreswerte()` prefer injected cumulative sums.

**Tech Stack:** Next.js 15 App Router (server actions), React 19, TypeScript 5, Supabase (Postgres + RLS + RPC), Vitest (unit), Playwright (E2E + template contract). German number format throughout (`"2.855,29"`).

**Verified facts this plan relies on (read before coding):**
- Templates listen for `postMessage({ type: "setState", state })`, replace their global `state`, and call `render()` (`public/templates/datev-classic.html:3460`).
- `render()` order: `renderMeta → renderEmployerAndAddress → renderBrutto → renderSteuerUndSV (→applyAutomatik) → renderVerdienst (→renderJahreswerte) → renderFooter` (`datev-classic.html:3450`).
- The Verdienst summary renders straight from `state.verdienst.*` (`datev-classic.html:3357`); under automatik the per-period Steuer/SV table is computed but `state.verdienst` is **not** filled by the template — the original shell filled it via `autoVerdienst()` (`index.html:3069`), which the `public/templates` copies lack.
- Global template helpers usable from the parent window: `computeTotals(state)`, `computeYearTotals(state)`, `sumSteuerBrutto(brutto)`, `sumSVBrutto(brutto)`, `computeRowBetrag(row)`, `formatDE(n)`, `parseDE(s)`.
- `computeTotals` returns `{ gesamtBrutto, steuerAbzuege, svAbzuege, nettoVerdienst, auszahlungsbetrag }` (numbers) (`datev-classic.html:874`).
- Serial slot: `state.bank.code` → `#fCode`, labeled "Code (kleines Feld)" (`index.html:394`, `datev-classic.html:685`).
- Cumulative block fields rendered by `renderJahreswerte()`: `gesamtBrutto, steuerBrutto, lohnsteuer, kirchensteuer, soli, svBrutto, kvBeitrag, rvBeitrag, avBeitrag, pvBeitrag, auszahlung, monatszahl` (`datev-classic.html:3401`).
- `datev-highcopy` has NO cumulative block and `supportsAutoTax:false` → it is **excluded** from both template edits.
- The 11 cumulative templates: `datev-classic, lexware-classic, sage-classic, viper-classic, neon-classic, atlas-classic, aurora-classic, ledger-classic, slate-classic, prism-classic, quartz-classic`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `supabase/migrations/0004_payslips.sql` | payslips table + RLS + unique(employee,year,month) | Create |
| `supabase/migrations/0005_serial_counter.sql` | global counter + seed + `allocate_serial()` | Create |
| `supabase/migrations/0006_companies_mandant_box.sql` | add `mandant_box` column | Create |
| `lib/slip-state.ts` | add optional `cumulative` + `CumulativeTotals` to the contract | Modify |
| `lib/db/types.ts` | `ComputedTotals`, `PayslipData`, `Payslip`; `mandant_box` on `Company` | Modify |
| `lib/db/companies.ts` | carry `mandant_box` in create | Modify |
| `lib/db/payslips.ts` | payslip data layer + serial issue + cumulative source query | Create |
| `lib/assembleState.ts` | pure `company+employee+payslip → SlipState` mapping | Create |
| `lib/cumulative.ts` | sum `ComputedTotals[]` → `CumulativeTotals` | Create |
| `lib/payslip-data.ts` | `buildPayslipData(FormData) → PayslipData` | Create |
| `components/SlipFrame.tsx` | add computed-totals read-back (`onComputed`) | Modify |
| `components/SlipPreview.tsx` | preview shell: template switch, capture, issue, print | Create |
| `components/MonthForm.tsx` | month-input form (zeitraum + dynamic brutto rows) | Create |
| `app/employees/[id]/page.tsx` | employee detail: months list + add | Create |
| `app/employees/[id]/payslips/actions.ts` | createMonth / saveComputedTotals / issue / setTemplate | Create |
| `app/employees/[id]/payslips/new/page.tsx` | month form page | Create |
| `app/employees/[id]/payslips/[payslipId]/page.tsx` | preview/print page | Create |
| `public/templates/*.html` (×11) | port `autoVerdienst()`; cumulative branch in `renderJahreswerte()` | Modify |
| `tests/unit/assemble-state.test.ts` | assembleState mapping incl. serial + Pers-Nr unify + Mandant | Create |
| `tests/unit/cumulative.test.ts` | true-sum correctness | Create |
| `tests/unit/payslip-data.test.ts` | FormData → PayslipData | Create |
| `tests/e2e/template-contract.spec.ts` | template computes + cumulative branch (all 11) | Create |
| `tests/e2e/payslip.spec.ts` | month → preview → issue → reprint → next number | Create |

---

## Task 1: payslips migration

**Files:**
- Create: `supabase/migrations/0004_payslips.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0004_payslips.sql — one row per employee-month; stores inputs + computed snapshot
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  year int not null,
  month int not null,
  status text not null default 'draft' check (status in ('draft', 'issued')),
  serial_number bigint,
  issued_at timestamptz,
  template_id text not null default 'datev-classic',
  data jsonb not null default '{}'::jsonb,
  computed_totals jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year, month)
);

alter table public.payslips enable row level security;

create policy payslips_select_own on public.payslips
  for select using (auth.uid() = owner_id);
create policy payslips_insert_own on public.payslips
  for insert with check (auth.uid() = owner_id);
create policy payslips_update_own on public.payslips
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy payslips_delete_own on public.payslips
  for delete using (auth.uid() = owner_id);

create index payslips_employee_idx on public.payslips (employee_id);
create index payslips_owner_idx on public.payslips (owner_id);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: applies `0004_payslips.sql` with no error; lists it as a new migration.

- [ ] **Step 3: Verify the table + RLS exist**

Run:
```bash
npx supabase db push --dry-run
```
Expected: "Remote database is up to date." (nothing pending) — confirms 0004 is applied.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_payslips.sql
git commit -m "feat: payslips table with owner RLS"
```

---

## Task 2: serial_counter migration + allocate_serial()

**Files:**
- Create: `supabase/migrations/0005_serial_counter.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0005_serial_counter.sql — single global counter; allocation only via SECURITY DEFINER fn
create table public.serial_counter (
  id boolean primary key default true,
  value bigint not null,
  constraint serial_counter_singleton check (id)
);

insert into public.serial_counter (id, value)
values (true, 80000)
on conflict (id) do nothing;

alter table public.serial_counter enable row level security;
-- intentionally NO policies: direct table access is denied to all clients.

create or replace function public.allocate_serial()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_val bigint;
begin
  update public.serial_counter
     set value = value + 1
   where id = true
  returning value into next_val;
  return next_val;
end;
$$;

revoke all on function public.allocate_serial() from public;
grant execute on function public.allocate_serial() to authenticated;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: applies `0005_serial_counter.sql` with no error.

- [ ] **Step 3: Verify allocation increments and is gapless**

Run (in the Supabase SQL editor or via psql):
```sql
select public.allocate_serial();  -- expect 80001
select public.allocate_serial();  -- expect 80002
select value from public.serial_counter;  -- expect 80002
```
Expected: strictly increasing, no gaps. (If run, reset the seed before real use: `update public.serial_counter set value = 80000 where id = true;`)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_serial_counter.sql
git commit -m "feat: global serial_counter + allocate_serial() rpc"
```

---

## Task 3: companies.mandant_box column

Mandant-Code "oben" (e.g. `133267/30605/00107`) and the Mandant-Code box (e.g. `30605`) are different values and must stay separate. `companies.mandant` already holds the "oben" value; add `mandant_box` for the box.

**Files:**
- Create: `supabase/migrations/0006_companies_mandant_box.sql`
- Modify: `lib/db/types.ts`
- Modify: `lib/db/companies.ts`

- [ ] **Step 1: Write the migration**

```sql
-- 0006_companies_mandant_box.sql — Mandant box value, distinct from the "oben" mandant line
alter table public.companies
  add column if not exists mandant_box text not null default '';
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: applies `0006_companies_mandant_box.sql` with no error.

- [ ] **Step 3: Add `mandant_box` to the `Company` type**

In `lib/db/types.ts`, change the `Company` type to include the new column (place after `mandant`):

```ts
export type Company = {
  id: string;
  owner_id: string;
  name: string;
  firma: string;
  mandant: string;
  mandant_box: string;
  roc_code: string;
  default_template: string;
  created_at: string;
};
```

- [ ] **Step 4: Carry `mandant_box` through `createCompany`**

In `lib/db/companies.ts`, widen the `createCompany` input to include `mandant_box`:

```ts
export async function createCompany(input: {
  name: string;
  firma: string;
  mandant: string;
  mandant_box: string;
  roc_code: string;
  default_template: string;
}): Promise<Company> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("companies")
    .insert({ ...input, owner_id: user!.id })
    .select()
    .single();
  if (error) throw error;
  return data as Company;
}
```

- [ ] **Step 5: Keep `createCompany` action compiling**

In `app/companies/actions.ts`, add `mandant_box` to the object passed to `createCompanyDb` (the form input itself is added in Plan 5; default to "" for now):

```ts
  await createCompanyDb({
    name: String(formData.get("name") ?? "").trim(),
    firma: String(formData.get("firma") ?? ""),
    mandant: String(formData.get("mandant") ?? ""),
    mandant_box: String(formData.get("mandant_box") ?? ""),
    roc_code: String(formData.get("roc_code") ?? ""),
    default_template: String(
      formData.get("default_template") ?? "datev-classic",
    ),
  });
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0006_companies_mandant_box.sql lib/db/types.ts lib/db/companies.ts app/companies/actions.ts
git commit -m "feat: separate Mandant box value on companies"
```

---

## Task 4: SlipState gains optional cumulative

**Files:**
- Modify: `lib/slip-state.ts`

- [ ] **Step 1: Add `CumulativeTotals` and the optional field**

At the end of `lib/slip-state.ts`, before `export interface SlipState`, add:

```ts
// True-sum cumulative figures for the "all months worked" block. When present on
// the state, templates render these instead of the single-month projection.
export interface CumulativeTotals {
  monatszahl: number;
  gesamtBrutto: number; steuerBrutto: number; svBrutto: number;
  lohnsteuer: number; kirchensteuer: number; soli: number;
  kvBeitrag: number; rvBeitrag: number; avBeitrag: number; pvBeitrag: number;
  auszahlung: number;
}
```

Then add the optional field to `SlipState` (after `automatik`):

```ts
  automatik: AutomatikBlock;
  cumulative?: CumulativeTotals;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (field is optional; existing fixture still valid).

- [ ] **Step 3: Commit**

```bash
git add lib/slip-state.ts
git commit -m "feat: optional cumulative totals on SlipState"
```

---

## Task 5: Payslip + ComputedTotals types

**Files:**
- Modify: `lib/db/types.ts`

- [ ] **Step 1: Add the payslip-related types**

Append to `lib/db/types.ts` (import the row types from the slip contract at the top of the file):

```ts
import type {
  BruttoRow, SteuerRow, SvRow, NettoRow, VerdienstBlock, BankBlock,
} from "@/lib/slip-state";

// Snapshot of the template-computed figures for one month (numbers, not strings).
export type ComputedTotals = {
  gesamtBrutto: number; steuerBrutto: number; svBrutto: number;
  lohnsteuer: number; kirchensteuer: number; soli: number;
  kvBeitrag: number; rvBeitrag: number; avBeitrag: number; pvBeitrag: number;
  auszahlung: number;
};

// The month's variable inputs only (stable fields live on the employee/company).
export type PayslipData = {
  zeitraum: { monat: string; jahr: string };
  brutto: BruttoRow[];
  steuer: SteuerRow[];
  sv: SvRow[];
  verdienst: Partial<VerdienstBlock>;
  nettoBezuege: NettoRow[];
  bank: Partial<BankBlock>;
  meta: Record<string, string>; // per-month overrides, e.g. druckdatum, blatt
};

export type Payslip = {
  id: string;
  owner_id: string;
  employee_id: string;
  year: number;
  month: number;
  status: "draft" | "issued";
  serial_number: number | null;
  issued_at: string | null;
  template_id: string;
  data: PayslipData;
  computed_totals: ComputedTotals | null;
  created_at: string;
  updated_at: string;
};
```

> Note: the existing `import ... from "@/lib/supabase/server"` etc. are not in this file; only add the `slip-state` import. If `lib/db/types.ts` has no imports yet, this becomes its first import line.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/types.ts
git commit -m "feat: Payslip + ComputedTotals + PayslipData types"
```

---

## Task 6: cumulative sum (pure, TDD)

**Files:**
- Create: `lib/cumulative.ts`
- Test: `tests/unit/cumulative.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/cumulative.test.ts
import { describe, it, expect } from "vitest";
import { sumComputedTotals } from "@/lib/cumulative";
import type { ComputedTotals } from "@/lib/db/types";

const m = (over: Partial<ComputedTotals>): ComputedTotals => ({
  gesamtBrutto: 0, steuerBrutto: 0, svBrutto: 0, lohnsteuer: 0,
  kirchensteuer: 0, soli: 0, kvBeitrag: 0, rvBeitrag: 0, avBeitrag: 0,
  pvBeitrag: 0, auszahlung: 0, ...over,
});

describe("sumComputedTotals", () => {
  it("sums each field and counts months", () => {
    const r = sumComputedTotals([
      m({ gesamtBrutto: 2855.29, lohnsteuer: 254.58, auszahlung: 2000.01 }),
      m({ gesamtBrutto: 3000.0, lohnsteuer: 300.0, auszahlung: 2100.0 }),
      m({ gesamtBrutto: 1000.5, lohnsteuer: 50.5, auszahlung: 800.5 }),
    ]);
    expect(r.monatszahl).toBe(3);
    expect(r.gesamtBrutto).toBeCloseTo(6855.79, 2);
    expect(r.lohnsteuer).toBeCloseTo(605.08, 2);
    expect(r.auszahlung).toBeCloseTo(4900.51, 2);
  });

  it("returns a zeroed total with monatszahl 0 for an empty list", () => {
    const r = sumComputedTotals([]);
    expect(r.monatszahl).toBe(0);
    expect(r.gesamtBrutto).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- cumulative`
Expected: FAIL — cannot find module `@/lib/cumulative`.

- [ ] **Step 3: Implement**

```ts
// lib/cumulative.ts
import type { ComputedTotals } from "@/lib/db/types";
import type { CumulativeTotals } from "@/lib/slip-state";

const FIELDS: (keyof ComputedTotals)[] = [
  "gesamtBrutto", "steuerBrutto", "svBrutto", "lohnsteuer", "kirchensteuer",
  "soli", "kvBeitrag", "rvBeitrag", "avBeitrag", "pvBeitrag", "auszahlung",
];

const round2 = (n: number) => Math.round(n * 100) / 100;

// True sum of the actual saved months — not a single-month projection.
export function sumComputedTotals(list: ComputedTotals[]): CumulativeTotals {
  const acc: ComputedTotals = {
    gesamtBrutto: 0, steuerBrutto: 0, svBrutto: 0, lohnsteuer: 0,
    kirchensteuer: 0, soli: 0, kvBeitrag: 0, rvBeitrag: 0, avBeitrag: 0,
    pvBeitrag: 0, auszahlung: 0,
  };
  for (const t of list) {
    for (const f of FIELDS) acc[f] = round2(acc[f] + (t[f] || 0));
  }
  return { ...acc, monatszahl: list.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- cumulative`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cumulative.ts tests/unit/cumulative.test.ts
git commit -m "feat: true-sum cumulative totals"
```

---

## Task 7: assembleState (pure mapping, TDD)

`assembleState` is field-shaping only — **no arithmetic**. It unifies Pers-Nr (one stored value drives both `meta.persNr` and `meta.persNrBox`), wires company codes (`mandant` oben, `mandant_box` box, `rocCode`), injects the serial into `bank.code`, and passes through cumulative.

**Files:**
- Create: `lib/assembleState.ts`
- Test: `tests/unit/assemble-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/assemble-state.test.ts
import { describe, it, expect } from "vitest";
import { assembleState } from "@/lib/assembleState";
import type { Company, Employee, Payslip } from "@/lib/db/types";

const company: Company = {
  id: "c1", owner_id: "u1", name: "ACME",
  firma: "ACME GmbH*Str 1*10115 Berlin",
  mandant: "133267/30605/00107", mandant_box: "30605", roc_code: "R0C9",
  default_template: "datev-classic", created_at: "",
};

const employee: Employee = {
  id: "e1", owner_id: "u1", company_id: "c1", name: "Max Mustermann",
  created_at: "",
  data: {
    mitarbeiter: { name: "Max Mustermann", strasse: "Weg 2", plzOrt: "10115 Berlin" },
    meta: { persNr: "778899", steuerId: "12345678901", abtNr: "7" },
    automatik: {
      enabled: true, steuerklasse: 1, faktor: "", konfession: "",
      bundesland: "BE", freibetragMonatlich: "", kkZusatzbeitrag: "2,69",
      kinder: 0, age: 30, midijob: false, westOst: "W",
    },
  },
};

const payslip: Payslip = {
  id: "p1", owner_id: "u1", employee_id: "e1", year: 2026, month: 3,
  status: "draft", serial_number: null, issued_at: null,
  template_id: "datev-classic", computed_totals: null,
  created_at: "", updated_at: "",
  data: {
    zeitraum: { monat: "März", jahr: "2026" },
    brutto: [{ lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "119,00", faktor: "16,69", prozent: "", st: "L", sv: "L", gb: "J" }],
    steuer: [], sv: [], verdienst: {}, nettoBezuege: [], bank: {},
    meta: { druckdatum: "31.03.2026", blatt: "1" },
  },
};

describe("assembleState", () => {
  it("maps person, company codes, period and brutto rows", () => {
    const s = assembleState(company, employee, payslip);
    expect(s.firma).toBe("ACME GmbH*Str 1*10115 Berlin");
    expect(s.mitarbeiter.name).toBe("Max Mustermann");
    expect(s.zeitraum).toEqual({ monat: "März", jahr: "2026" });
    expect(s.brutto).toHaveLength(1);
    expect(s.meta.mandant).toBe("133267/30605/00107");
    expect(s.meta.mandantBox).toBe("30605");
    expect(s.meta.rocCode).toBe("R0C9");
    expect(s.meta.druckdatum).toBe("31.03.2026");
    expect(s.meta.blatt).toBe("1");
    expect(s.automatik.enabled).toBe(true);
  });

  it("unifies Pers-Nr: one stored value fills both persNr and the box", () => {
    const s = assembleState(company, employee, payslip);
    expect(s.meta.persNr).toBe("778899");
    expect(s.meta.persNrBox).toBe("778899");
  });

  it("injects the serial into bank.code only when provided", () => {
    expect(assembleState(company, employee, payslip).bank.code).toBe("");
    const issued = assembleState(company, employee, payslip, { serial: 80012 });
    expect(issued.bank.code).toBe("80012");
  });

  it("passes cumulative through when provided", () => {
    const cumulative = {
      monatszahl: 2, gesamtBrutto: 100, steuerBrutto: 90, svBrutto: 90,
      lohnsteuer: 10, kirchensteuer: 0, soli: 0, kvBeitrag: 5, rvBeitrag: 5,
      avBeitrag: 1, pvBeitrag: 1, auszahlung: 70,
    };
    const s = assembleState(company, employee, payslip, { cumulative });
    expect(s.cumulative).toEqual(cumulative);
  });

  it("tolerates a null company", () => {
    const s = assembleState(null, employee, payslip);
    expect(s.firma).toBe("");
    expect(s.meta.mandant).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- assemble-state`
Expected: FAIL — cannot find module `@/lib/assembleState`.

- [ ] **Step 3: Implement**

```ts
// lib/assembleState.ts
import type { Company, Employee, Payslip } from "@/lib/db/types";
import type {
  SlipState, SlipMeta, BankBlock, VerdienstBlock, CumulativeTotals,
} from "@/lib/slip-state";

const EMPTY_META: SlipMeta = {
  persNr: "", geburtsdatum: "", stKl: "", faktor: "",
  kiFrbtr: "", konfession: "", freibetragJ: "", freibetragM: "",
  dba: "", midijob: "", stTg: "",
  vjUrlUeb: "", urlAnspr: "", urlTgGen: "", resturlaub: "",
  anwTage: "", urlaubTage: "", krankhTg: "", fehlzTage: "",
  anwStd: "", urlaubStd: "", krankhStd: "", fehlzStd: "",
  zeitlohnStd: "", ueberstd: "", bezStd: "",
  svNummer: "", krankenkasse: "", kkProzent: "",
  pgrs: "", bgrs: "", umSvTg: "",
  eintritt: "", austritt: "", steuerId: "", mfb: "",
  rocCode: "", mandant: "", druckdatum: "", blatt: "",
  persNrBox: "", abtNr: "", bn: "", mandantBox: "",
};

const EMPTY_VERDIENST: VerdienstBlock = {
  nachberechnungVorjahr: false,
  gesamtBrutto: "", steuerBrutto: "", lohnsteuer: "", kirchensteuer: "",
  soli: "", steuerfreieBezuege: "", pVerstZukSich: "", pfaendungRest: "",
  darlehenRest: "", svBrutto: "", kvBeitrag: "", rvBeitrag: "",
  avBeitrag: "", pvBeitrag: "", vwlGesamt: "", kugAuszahlung: "",
};

const EMPTY_BANK: BankBlock = {
  name: "", iban: "", svAgAnteil: "", zusAgKosten: "", gesamtkosten: "", code: "",
};

export function assembleState(
  company: Company | null,
  employee: Employee,
  payslip: Payslip,
  opts: { serial?: number | null; cumulative?: CumulativeTotals | null } = {},
): SlipState {
  const d = payslip.data;
  const empMeta = employee.data.meta ?? {};

  // Person-stable meta from the employee, company codes, then per-month overrides.
  const meta: SlipMeta = {
    ...EMPTY_META,
    ...empMeta,
    rocCode: company?.roc_code ?? "",
    mandant: company?.mandant ?? "",
    mandantBox: company?.mandant_box ?? "",
    ...d.meta, // per-month overrides (druckdatum, blatt, ...)
  };
  // Pers-Nr is one value shown in two places.
  meta.persNr = empMeta.persNr ?? "";
  meta.persNrBox = empMeta.persNr ?? "";

  const serial = opts.serial ?? null;
  const bank: BankBlock = {
    ...EMPTY_BANK,
    ...d.bank,
    code: serial != null ? String(serial) : (d.bank?.code ?? ""),
  };

  const state: SlipState = {
    meta,
    firma: company?.firma ?? "",
    mitarbeiter: employee.data.mitarbeiter,
    zeitraum: d.zeitraum,
    brutto: d.brutto ?? [],
    steuer: d.steuer ?? [],
    sv: d.sv ?? [],
    verdienst: { ...EMPTY_VERDIENST, ...d.verdienst },
    nettoBezuege: d.nettoBezuege ?? [],
    bank,
    hinweiseZurAbrechnung: "",
    automatik: employee.data.automatik,
  };
  if (opts.cumulative) state.cumulative = opts.cumulative;
  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- assemble-state`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/assembleState.ts tests/unit/assemble-state.test.ts
git commit -m "feat: assembleState pure DB-rows -> SlipState mapping"
```

---

## Task 8: buildPayslipData (FormData → PayslipData, TDD)

The month form submits the dynamic Brutto rows as one JSON string (`brutto_json`) plus scalar fields. `buildPayslipData` parses them.

**Files:**
- Create: `lib/payslip-data.ts`
- Test: `tests/unit/payslip-data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/payslip-data.test.ts
import { describe, it, expect } from "vitest";
import { buildPayslipData, monthNumber } from "@/lib/payslip-data";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("buildPayslipData", () => {
  it("parses period, print meta and brutto rows", () => {
    const data = buildPayslipData(
      fd({
        monat: "März",
        jahr: "2026",
        druckdatum: "31.03.2026",
        blatt: "1",
        brutto_json: JSON.stringify([
          { lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "119,00", faktor: "16,69", prozent: "", st: "L", sv: "L", gb: "J" },
        ]),
      }),
    );
    expect(data.zeitraum).toEqual({ monat: "März", jahr: "2026" });
    expect(data.meta.druckdatum).toBe("31.03.2026");
    expect(data.meta.blatt).toBe("1");
    expect(data.brutto).toHaveLength(1);
    expect(data.brutto[0].lohnart).toBe("100");
    expect(data.steuer).toEqual([]);
    expect(data.verdienst).toEqual({});
  });

  it("defaults to empty rows when brutto_json is absent or invalid", () => {
    expect(buildPayslipData(fd({ monat: "Mai", jahr: "2026" })).brutto).toEqual([]);
    expect(buildPayslipData(fd({ monat: "Mai", jahr: "2026", brutto_json: "oops" })).brutto).toEqual([]);
  });
});

describe("monthNumber", () => {
  it("maps German month names to 1-12", () => {
    expect(monthNumber("Januar")).toBe(1);
    expect(monthNumber("März")).toBe(3);
    expect(monthNumber("Dezember")).toBe(12);
    expect(monthNumber("nope")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- payslip-data`
Expected: FAIL — cannot find module `@/lib/payslip-data`.

- [ ] **Step 3: Implement**

```ts
// lib/payslip-data.ts
import type { BruttoRow } from "@/lib/slip-state";
import type { PayslipData } from "@/lib/db/types";

export const GERMAN_MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
] as const;

export function monthNumber(name: string): number {
  const i = GERMAN_MONTHS.findIndex(
    (m) => m.toLowerCase() === String(name).trim().toLowerCase(),
  );
  return i < 0 ? 0 : i + 1;
}

function parseBrutto(raw: string): BruttoRow[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as BruttoRow[]) : [];
  } catch {
    return [];
  }
}

export function buildPayslipData(formData: FormData): PayslipData {
  const monat = String(formData.get("monat") ?? "");
  const jahr = String(formData.get("jahr") ?? "");
  const brutto = parseBrutto(String(formData.get("brutto_json") ?? ""));
  return {
    zeitraum: { monat, jahr },
    brutto,
    steuer: [],
    sv: [],
    verdienst: {},
    nettoBezuege: [],
    bank: {},
    meta: {
      druckdatum: String(formData.get("druckdatum") ?? ""),
      blatt: String(formData.get("blatt") ?? "1"),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- payslip-data`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/payslip-data.ts tests/unit/payslip-data.test.ts
git commit -m "feat: buildPayslipData FormData parser"
```

---

## Task 9: payslips data layer

**Files:**
- Create: `lib/db/payslips.ts`

- [ ] **Step 1: Implement the data layer**

```ts
// lib/db/payslips.ts
import { createClient } from "@/lib/supabase/server";
import type { ComputedTotals, Payslip, PayslipData } from "./types";
import { monthNumber } from "@/lib/payslip-data";

export async function listPayslipsForEmployee(
  employeeId: string,
): Promise<Payslip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("employee_id", employeeId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return data as Payslip[];
}

export async function getPayslip(id: string): Promise<Payslip | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Payslip | null;
}

export async function createPayslip(input: {
  employee_id: string;
  template_id: string;
  data: PayslipData;
}): Promise<Payslip> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const year = Number(input.data.zeitraum.jahr) || 0;
  const month = monthNumber(input.data.zeitraum.monat);
  const { data, error } = await supabase
    .from("payslips")
    .insert({
      owner_id: user!.id,
      employee_id: input.employee_id,
      year,
      month,
      template_id: input.template_id,
      data: input.data,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Payslip;
}

export async function setPayslipTemplate(
  id: string,
  template_id: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payslips")
    .update({ template_id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function savePayslipComputedTotals(
  id: string,
  computed_totals: ComputedTotals,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payslips")
    .update({ computed_totals, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Assign-once / reuse-forever: if already issued, return the stored serial.
export async function issuePayslip(id: string): Promise<number> {
  const supabase = await createClient();
  const existing = await getPayslip(id);
  if (!existing) throw new Error("payslip not found");
  if (existing.status === "issued" && existing.serial_number != null) {
    return existing.serial_number;
  }
  const { data: serial, error: rpcError } =
    await supabase.rpc("allocate_serial");
  if (rpcError) throw rpcError;
  const { error } = await supabase
    .from("payslips")
    .update({
      serial_number: serial as number,
      status: "issued",
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return serial as number;
}

// computed_totals of the employee's saved months for `year`, month <= maxMonth,
// excluding `excludeId` (the slip currently being previewed contributes live).
export async function getYearComputedTotals(
  employeeId: string,
  year: number,
  maxMonth: number,
  excludeId?: string,
): Promise<ComputedTotals[]> {
  const supabase = await createClient();
  let q = supabase
    .from("payslips")
    .select("computed_totals")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .lte("month", maxMonth)
    .not("computed_totals", "is", null);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as { computed_totals: ComputedTotals }[]).map(
    (r) => r.computed_totals,
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/payslips.ts
git commit -m "feat: payslips data layer + serial issue + cumulative source"
```

---

## Task 10: template edits — autoVerdienst + cumulative branch

Port the original shell's `autoVerdienst()` into the 11 cumulative templates so the Verdienst summary self-computes under automatik, and make `renderJahreswerte()` prefer an injected `state.cumulative`. **Skip `datev-highcopy.html`.**

**Files (Modify):** `public/templates/{datev-classic,lexware-classic,sage-classic,viper-classic,neon-classic,atlas-classic,aurora-classic,ledger-classic,slate-classic,prism-classic,quartz-classic}.html`

- [ ] **Step 1: Edit `datev-classic.html` first — add `autoVerdienst()`**

In `public/templates/datev-classic.html`, immediately **before** `function renderJahreswerte() {`, insert:

```js
      function autoVerdienst() {
        if (!state.automatik || !state.automatik.enabled) return;
        const t = computeTotals(state);
        const steuer = state.steuer && state.steuer[0] ? state.steuer[0] : {};
        const sv = state.sv && state.sv[0] ? state.sv[0] : {};
        const v = state.verdienst || (state.verdienst = {});
        v.gesamtBrutto = formatDE(t.gesamtBrutto);
        v.steuerBrutto = formatDE(sumSteuerBrutto(state.brutto || []));
        v.svBrutto = formatDE(sumSVBrutto(state.brutto || []));
        v.lohnsteuer = steuer.lohnsteuer || "";
        v.kirchensteuer = steuer.kirchensteuer || "";
        v.soli = steuer.soli || "";
        v.kvBeitrag = sv.kvBeitrag || "";
        v.rvBeitrag = sv.rvBeitrag || "";
        v.avBeitrag = sv.avBeitrag || "";
        v.pvBeitrag = sv.pvBeitrag || "";
        let stFrei = 0;
        for (const r of state.brutto || []) {
          if (/^F$/i.test(r.st || "")) stFrei += computeRowBetrag(r);
        }
        v.steuerfreieBezuege = stFrei > 0 ? formatDE(stFrei) : "";
      }
```

- [ ] **Step 2: Edit `datev-classic.html` — call it in `render()`**

In the `render()` function, insert `autoVerdienst();` between `renderSteuerUndSV();` and `renderVerdienst();`:

```js
      function render() {
        renderMeta();
        renderEmployerAndAddress();
        renderBrutto();
        renderSteuerUndSV();
        autoVerdienst();
        renderVerdienst();
        renderFooter();
      }
```

- [ ] **Step 3: Edit `datev-classic.html` — cumulative branch in `renderJahreswerte()`**

Replace the first line of `renderJahreswerte()` (`const y = computeYearTotals(state);`) with a branch that prefers injected cumulative sums:

```js
      function renderJahreswerte() {
        const c = state.cumulative;
        const y = c
          ? {
              monatszahl: c.monatszahl,
              gesamtBrutto: c.gesamtBrutto, steuerBrutto: c.steuerBrutto,
              svBrutto: c.svBrutto, lohnsteuer: c.lohnsteuer,
              kirchensteuer: c.kirchensteuer, soli: c.soli,
              kvBeitrag: c.kvBeitrag, rvBeitrag: c.rvBeitrag,
              avBeitrag: c.avBeitrag, pvBeitrag: c.pvBeitrag,
              auszahlung: c.auszahlung,
            }
          : computeYearTotals(state);
        const label = y.monatszahl > 0
          ? ` (${y.monatszahl} ${y.monatszahl === 1 ? "Monat" : "Monate"} seit Eintritt)`
          : "";
        // ... rest of the function is unchanged ...
```

(Leave everything after `const label = ...` exactly as-is.)

- [ ] **Step 4: Write the template-contract test (datev-classic only, first)**

```ts
// tests/e2e/template-contract.spec.ts
import { test, expect } from "@playwright/test";

const SAMPLE = {
  meta: {
    persNr: "1", geburtsdatum: "", stKl: "1", faktor: "", kiFrbtr: "0",
    konfession: "", freibetragJ: "", freibetragM: "", dba: "", midijob: "",
    stTg: "30", vjUrlUeb: "", urlAnspr: "", urlTgGen: "", resturlaub: "",
    anwTage: "", urlaubTage: "", krankhTg: "", fehlzTage: "", anwStd: "",
    urlaubStd: "", krankhStd: "", fehlzStd: "", zeitlohnStd: "", ueberstd: "",
    bezStd: "", svNummer: "", krankenkasse: "", kkProzent: "", pgrs: "",
    bgrs: "", umSvTg: "", eintritt: "010126", austritt: "", steuerId: "",
    mfb: "", rocCode: "", mandant: "", druckdatum: "31.03.2026", blatt: "1",
    persNrBox: "1", abtNr: "1", bn: "B/N", mandantBox: "",
  },
  firma: "Test GmbH",
  mitarbeiter: { name: "Max", strasse: "Weg 1", plzOrt: "10115 Berlin" },
  zeitraum: { monat: "März", jahr: "2026" },
  brutto: [
    { lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "100,00", faktor: "20,00", prozent: "", st: "L", sv: "L", gb: "J" },
  ],
  steuer: [], sv: [], nettoBezuege: [],
  verdienst: {
    nachberechnungVorjahr: false, gesamtBrutto: "", steuerBrutto: "",
    lohnsteuer: "", kirchensteuer: "", soli: "", steuerfreieBezuege: "",
    pVerstZukSich: "", pfaendungRest: "", darlehenRest: "", svBrutto: "",
    kvBeitrag: "", rvBeitrag: "", avBeitrag: "", pvBeitrag: "", vwlGesamt: "",
    kugAuszahlung: "",
  },
  bank: { name: "", iban: "", svAgAnteil: "", zusAgKosten: "", gesamtkosten: "", code: "" },
  hinweiseZurAbrechnung: "",
  automatik: {
    enabled: true, steuerklasse: 1, faktor: "", konfession: "",
    bundesland: "BE", freibetragMonatlich: "", kkZusatzbeitrag: "2,69",
    kinder: 0, age: 30, midijob: false, westOst: "W",
  },
};

async function postState(page: import("@playwright/test").Page, file: string, state: unknown) {
  await page.goto(`/templates/${file}`);
  await page.evaluate((s) => {
    window.postMessage({ type: "setState", state: s }, "*");
  }, state);
  // give the message loop a tick to render
  await page.waitForTimeout(150);
}

test("datev-classic self-computes the Verdienst summary under automatik", async ({ page }) => {
  await postState(page, "datev-classic.html", SAMPLE);
  // Gesamt-Brutto = 100,00 * 20,00 = 2.000,00
  await expect(page.locator("#gesamtBruttoCell")).toHaveText("2.000,00");
  // autoVerdienst fills the summary from the engine (non-empty Lohnsteuer)
  await expect(page.locator("#vGesamtBrutto")).toHaveText("2.000,00");
  await expect(page.locator("#vLohnsteuer")).not.toHaveText("");
});

test("datev-classic renders injected cumulative sums verbatim", async ({ page }) => {
  const withCumulative = {
    ...SAMPLE,
    cumulative: {
      monatszahl: 3, gesamtBrutto: 6000, steuerBrutto: 6000, svBrutto: 6000,
      lohnsteuer: 600, kirchensteuer: 0, soli: 0, kvBeitrag: 50, rvBeitrag: 50,
      avBeitrag: 10, pvBeitrag: 10, auszahlung: 4800,
    },
  };
  await postState(page, "datev-classic.html", withCumulative);
  await expect(page.locator("#yGesamtBrutto")).toHaveText("6.000,00");
  await expect(page.locator("#yLohnsteuer")).toHaveText("600,00");
  await expect(page.locator("#yAuszahlungCell")).toHaveText("4.800,00");
  await expect(page.locator("#yearSuffix")).toContainText("3 Monate");
});
```

- [ ] **Step 5: Run the contract test against datev-classic**

Run: `npx playwright test tests/e2e/template-contract.spec.ts`
Expected: the two `datev-classic` tests PASS. (If a locator text mismatches, confirm the edit positions — do not change the engine.)

- [ ] **Step 6: Apply the SAME three edits to the other 10 templates**

For each of `lexware-classic, sage-classic, viper-classic, neon-classic, atlas-classic, aurora-classic, ledger-classic, slate-classic, prism-classic, quartz-classic`:
1. Insert the `autoVerdienst()` function (exact code from Step 1) before that file's `function renderJahreswerte() {`.
2. Add `autoVerdienst();` between `renderSteuerUndSV();` and `renderVerdienst();` in that file's `render()`.
3. Apply the cumulative branch from Step 3 to that file's `renderJahreswerte()`.

These templates share the same engine functions (`computeTotals`, `formatDE`, `sumSteuerBrutto`, `sumSVBrutto`, `computeRowBetrag`, `computeYearTotals`) and the same `#y*`/`#v*` element IDs. If any template's `render()` or `renderJahreswerte()` differs structurally, adapt the insertion point but keep the inserted code identical.

- [ ] **Step 7: Extend the contract test to cover all 11 templates**

Add to `tests/e2e/template-contract.spec.ts`:

```ts
const CUMULATIVE_TEMPLATES = [
  "datev-classic.html", "lexware-classic.html", "sage-classic.html",
  "viper-classic.html", "neon-classic.html", "atlas-classic.html",
  "aurora-classic.html", "ledger-classic.html", "slate-classic.html",
  "prism-classic.html", "quartz-classic.html",
];

for (const file of CUMULATIVE_TEMPLATES) {
  test(`${file}: autoVerdienst + cumulative branch work`, async ({ page }) => {
    await postState(page, file, {
      ...SAMPLE,
      cumulative: {
        monatszahl: 2, gesamtBrutto: 4000, steuerBrutto: 4000, svBrutto: 4000,
        lohnsteuer: 400, kirchensteuer: 0, soli: 0, kvBeitrag: 40, rvBeitrag: 40,
        avBeitrag: 8, pvBeitrag: 8, auszahlung: 3200,
      },
    });
    await expect(page.locator("#vGesamtBrutto")).toHaveText("2.000,00");
    await expect(page.locator("#yGesamtBrutto")).toHaveText("4.000,00");
  });
}
```

- [ ] **Step 8: Run the full contract suite**

Run: `npx playwright test tests/e2e/template-contract.spec.ts`
Expected: all tests PASS (2 datev-classic + 11 loop).

- [ ] **Step 9: Commit**

```bash
git add public/templates/*.html tests/e2e/template-contract.spec.ts
git commit -m "feat: templates self-compute Verdienst + accept cumulative sums"
```

---

## Task 11: SlipFrame computed-totals read-back

`SlipFrame` already posts state on load/change. Add an optional `onComputed` callback that reads the template's own computed values back out of the (same-origin) iframe after each render.

**Files:**
- Modify: `components/SlipFrame.tsx`

- [ ] **Step 1: Implement the read-back**

Replace `components/SlipFrame.tsx` with:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { SlipState } from "@/lib/slip-state";
import type { ComputedTotals } from "@/lib/db/types";

// Reads the template's own computed figures from the same-origin iframe window.
// The template owns all math; we only copy what it produced.
function captureComputed(win: Window): ComputedTotals | null {
  const w = win as unknown as {
    state?: SlipState;
    computeTotals?: (s: unknown) => { gesamtBrutto: number; auszahlungsbetrag: number };
    sumSteuerBrutto?: (b: unknown) => number;
    sumSVBrutto?: (b: unknown) => number;
    parseDE?: (s: string | undefined) => number | null;
  };
  if (!w.state || !w.computeTotals || !w.sumSteuerBrutto || !w.sumSVBrutto || !w.parseDE) {
    return null;
  }
  const s = w.state;
  const t = w.computeTotals(s);
  const st = (s.steuer && s.steuer[0]) || {};
  const sv = (s.sv && s.sv[0]) || {};
  const num = (v: string | undefined) => w.parseDE!(v) || 0;
  return {
    gesamtBrutto: t.gesamtBrutto,
    steuerBrutto: w.sumSteuerBrutto(s.brutto || []),
    svBrutto: w.sumSVBrutto(s.brutto || []),
    lohnsteuer: num(st.lohnsteuer),
    kirchensteuer: num(st.kirchensteuer),
    soli: num(st.soli),
    kvBeitrag: num(sv.kvBeitrag),
    rvBeitrag: num(sv.rvBeitrag),
    avBeitrag: num(sv.avBeitrag),
    pvBeitrag: num(sv.pvBeitrag),
    auszahlung: t.auszahlungsbetrag,
  };
}

export function SlipFrame({
  templateFile,
  state,
  onComputed,
}: {
  templateFile: string;
  state: SlipState;
  onComputed?: (totals: ComputedTotals) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const post = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.postMessage({ type: "setState", state }, "*");
      if (onComputed) {
        // let the template handle the message + render, then read it back
        setTimeout(() => {
          try {
            const totals = captureComputed(win);
            if (totals) onComputed(totals);
          } catch {
            /* cross-origin or not-ready: ignore */
          }
        }, 120);
      }
    };
    iframe.addEventListener("load", post);
    if (iframe.contentWindow) post();
    return () => iframe.removeEventListener("load", post);
  }, [state, templateFile, onComputed]);

  const print = () => ref.current?.contentWindow?.print();

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={print}
        className="self-end rounded bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900"
      >
        Print / PDF
      </button>
      <iframe
        ref={ref}
        title="slip"
        src={`/templates/${templateFile}`}
        className="h-[297mm] w-[210mm] border border-neutral-700 bg-white"
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + confirm the demo still renders**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx playwright test tests/e2e/demo-slip.spec.ts`
Expected: PASS (the demo page still renders; `onComputed` is optional and unused there).

- [ ] **Step 3: Commit**

```bash
git add components/SlipFrame.tsx
git commit -m "feat: SlipFrame reads computed totals back from the template"
```

---

## Task 12: payslip server actions

**Files:**
- Create: `app/employees/[id]/payslips/actions.ts`

- [ ] **Step 1: Implement the actions**

```ts
// app/employees/[id]/payslips/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildPayslipData } from "@/lib/payslip-data";
import {
  createPayslip,
  issuePayslip as issuePayslipDb,
  savePayslipComputedTotals,
  setPayslipTemplate,
} from "@/lib/db/payslips";
import type { ComputedTotals } from "@/lib/db/types";

export async function createMonth(
  employeeId: string,
  templateId: string,
  formData: FormData,
): Promise<void> {
  const data = buildPayslipData(formData);
  const payslip = await createPayslip({
    employee_id: employeeId,
    template_id: templateId,
    data,
  });
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}/payslips/${payslip.id}`);
}

export async function saveComputedTotals(
  payslipId: string,
  totals: ComputedTotals,
): Promise<void> {
  await savePayslipComputedTotals(payslipId, totals);
}

export async function issuePayslip(
  employeeId: string,
  payslipId: string,
): Promise<void> {
  await issuePayslipDb(payslipId);
  revalidatePath(`/employees/${employeeId}/payslips/${payslipId}`);
  revalidatePath(`/employees/${employeeId}`);
}

export async function changeTemplate(
  employeeId: string,
  payslipId: string,
  templateId: string,
): Promise<void> {
  await setPayslipTemplate(payslipId, templateId);
  revalidatePath(`/employees/${employeeId}/payslips/${payslipId}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/employees/[id]/payslips/actions.ts
git commit -m "feat: payslip server actions (create/issue/template/computed)"
```

---

## Task 13: MonthForm component

A lean month-input form: Abrechnungszeitraum (month dropdown + year), print meta (Druckdatum, Blatt), and dynamic Brutto rows. Steuer/SV come from the employee's Automatik; manual entry for non-automatik months is a Plan 5 enhancement.

**Files:**
- Create: `components/MonthForm.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState } from "react";
import type { BruttoRow } from "@/lib/slip-state";
import { GERMAN_MONTHS } from "@/lib/payslip-data";
import { createMonth } from "@/app/employees/[id]/payslips/actions";

const EMPTY_ROW: BruttoRow = {
  lohnart: "", bezeichnung: "", einheit: "", menge: "", faktor: "",
  prozent: "", st: "L", sv: "L", gb: "J",
};

export function MonthForm({
  employeeId,
  templateId,
}: {
  employeeId: string;
  templateId: string;
}) {
  const [rows, setRows] = useState<BruttoRow[]>([{ ...EMPTY_ROW }]);

  const update = (i: number, key: keyof BruttoRow, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const action = createMonth.bind(null, employeeId, templateId);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="brutto_json" value={JSON.stringify(rows)} />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-neutral-300">
          Abrechnungszeitraum
        </legend>
        <div className="flex gap-3">
          <select name="monat" defaultValue="" className="cmp-input flex-1" required>
            <option value="" disabled>
              Monat …
            </option>
            {GERMAN_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input name="jahr" placeholder="Jahr" defaultValue="2026" className="cmp-input w-28" required />
        </div>
        <div className="flex gap-3">
          <input name="druckdatum" placeholder="Druckdatum (TT.MM.JJJJ)" className="cmp-input flex-1" />
          <input name="blatt" placeholder="Blatt" defaultValue="1" className="cmp-input w-20" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-300">
          Brutto-Bezüge
        </legend>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[5rem_1fr_4rem_5rem_5rem_3rem_3rem] gap-2">
            <input value={r.lohnart} onChange={(e) => update(i, "lohnart", e.target.value)} placeholder="LA" className="cmp-input" />
            <input value={r.bezeichnung} onChange={(e) => update(i, "bezeichnung", e.target.value)} placeholder="Bezeichnung" className="cmp-input" />
            <input value={r.einheit} onChange={(e) => update(i, "einheit", e.target.value)} placeholder="Einheit" className="cmp-input" />
            <input value={r.menge} onChange={(e) => update(i, "menge", e.target.value)} placeholder="Menge" className="cmp-input" />
            <input value={r.faktor} onChange={(e) => update(i, "faktor", e.target.value)} placeholder="Faktor" className="cmp-input" />
            <input value={r.st} onChange={(e) => update(i, "st", e.target.value)} placeholder="St" className="cmp-input" />
            <input value={r.sv} onChange={(e) => update(i, "sv", e.target.value)} placeholder="SV" className="cmp-input" />
          </div>
        ))}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { ...EMPTY_ROW }])}
            className="text-xs text-neutral-400 underline"
          >
            + Add row
          </button>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows((rs) => rs.slice(0, -1))}
              className="text-xs text-red-400 underline"
            >
              − Remove last
            </button>
          )}
        </div>
      </fieldset>

      <button className="self-start rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900">
        Save month
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MonthForm.tsx
git commit -m "feat: MonthForm (period + dynamic brutto rows)"
```

---

## Task 14: SlipPreview component

Renders the slip, switches templates, captures `computed_totals`, merges this month into the cumulative client-side, and issues a serial.

**Files:**
- Create: `components/SlipPreview.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SlipFrame } from "@/components/SlipFrame";
import { assembleState } from "@/lib/assembleState";
import { sumComputedTotals } from "@/lib/cumulative";
import type { Company, Employee, Payslip, ComputedTotals } from "@/lib/db/types";
import type { TemplateMeta } from "@/lib/template-manifest";
import {
  saveComputedTotals,
  issuePayslip,
  changeTemplate,
} from "@/app/employees/[id]/payslips/actions";

export function SlipPreview({
  company,
  employee,
  payslip,
  templates,
  otherMonths,
}: {
  company: Company | null;
  employee: Employee;
  payslip: Payslip;
  templates: TemplateMeta[];
  otherMonths: ComputedTotals[]; // captured totals of the year's other months <= this one
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(payslip.template_id);
  const [thisMonth, setThisMonth] = useState<ComputedTotals | null>(
    payslip.computed_totals,
  );

  const meta = templates.find((t) => t.id === templateId) ?? templates[0];
  const supportsCumulative = meta.supportsCumulative;

  const cumulative = supportsCumulative
    ? sumComputedTotals([...otherMonths, ...(thisMonth ? [thisMonth] : [])])
    : null;

  const state = assembleState(company, employee, payslip, {
    serial: payslip.serial_number,
    cumulative,
  });

  const onComputed = useCallback(
    (totals: ComputedTotals) => {
      // persist + feed this month into the cumulative; only re-render if changed
      setThisMonth((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(totals)) return prev;
        void saveComputedTotals(payslip.id, totals);
        return totals;
      });
    },
    [payslip.id],
  );

  const onTemplateChange = async (id: string) => {
    setTemplateId(id);
    await changeTemplate(employee.id, payslip.id, id);
  };

  const onIssue = async () => {
    await issuePayslip(employee.id, payslip.id);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-neutral-300">
          Template{" "}
          <select
            value={templateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="cmp-input"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.supportsCumulative ? "" : " (single month)"}
              </option>
            ))}
          </select>
        </label>

        {payslip.serial_number != null ? (
          <span className="text-sm text-neutral-300">
            Serial #{payslip.serial_number}
          </span>
        ) : (
          <button
            onClick={onIssue}
            className="rounded bg-emerald-500 px-3 py-1.5 text-sm font-medium text-neutral-950"
          >
            Issue &amp; assign serial
          </button>
        )}
      </div>

      <SlipFrame
        templateFile={meta.file}
        state={state}
        onComputed={onComputed}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SlipPreview.tsx
git commit -m "feat: SlipPreview (template switch, capture, issue, cumulative)"
```

---

## Task 15: employee detail page (months list)

**Files:**
- Create: `app/employees/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listPayslipsForEmployee } from "@/lib/db/payslips";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();
  const payslips = await listPayslipsForEmployee(id);

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">
            {employee.name || "(unnamed)"}
          </h1>
          <Link href="/dashboard" className="text-xs text-neutral-500">
            ← Employees
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/employees/${id}/edit`} className="text-sm text-neutral-400">
            Edit details
          </Link>
          <Link
            href={`/employees/${id}/payslips/new`}
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900"
          >
            Add month
          </Link>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-neutral-800">
        {payslips.length === 0 && (
          <li className="py-4 text-neutral-500">No months yet.</li>
        )}
        {payslips.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <Link
              href={`/employees/${id}/payslips/${p.id}`}
              className="text-neutral-100 hover:underline"
            >
              {p.data.zeitraum.monat} {p.data.zeitraum.jahr}
            </Link>
            <span className="text-xs text-neutral-500">
              {p.status === "issued" ? `#${p.serial_number}` : "draft"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Make the dashboard link to the detail page**

In `components/EmployeeList.tsx`, change the employee link target from the edit page to the detail page:

```tsx
            <Link
              href={`/employees/${e.id}`}
              className="text-neutral-100 hover:underline"
            >
              {e.name || "(unnamed)"}
            </Link>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/employees/[id]/page.tsx components/EmployeeList.tsx
git commit -m "feat: employee detail page with months list"
```

---

## Task 16: month form page + preview page

**Files:**
- Create: `app/employees/[id]/payslips/new/page.tsx`
- Create: `app/employees/[id]/payslips/[payslipId]/page.tsx`

- [ ] **Step 1: Month form page**

```tsx
// app/employees/[id]/payslips/new/page.tsx
import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listCompanies } from "@/lib/db/companies";
import { MonthForm } from "@/components/MonthForm";
import { DEFAULT_TEMPLATE_ID } from "@/lib/template-manifest";

export default async function NewMonthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();
  const companies = await listCompanies();
  const company = companies.find((c) => c.id === employee.company_id) ?? null;
  const templateId = company?.default_template ?? DEFAULT_TEMPLATE_ID;

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">
        Add month — {employee.name}
      </h1>
      <MonthForm employeeId={id} templateId={templateId} />
    </main>
  );
}
```

- [ ] **Step 2: Preview page**

```tsx
// app/employees/[id]/payslips/[payslipId]/page.tsx
import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listCompanies } from "@/lib/db/companies";
import { getPayslip, getYearComputedTotals } from "@/lib/db/payslips";
import { SlipPreview } from "@/components/SlipPreview";
import { TEMPLATES } from "@/lib/template-manifest";

export default async function PayslipPreviewPage({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>;
}) {
  const { id, payslipId } = await params;
  const [employee, payslip, companies] = await Promise.all([
    getEmployee(id),
    getPayslip(payslipId),
    listCompanies(),
  ]);
  if (!employee || !payslip) notFound();
  const company = companies.find((c) => c.id === employee.company_id) ?? null;

  // captured totals for the year's other months up to and including this one
  const otherMonths = await getYearComputedTotals(
    id,
    payslip.year,
    payslip.month,
    payslip.id,
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <SlipPreview
        company={company}
        employee={employee}
        payslip={payslip}
        templates={TEMPLATES}
        otherMonths={otherMonths}
      />
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + dev smoke**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the two new dynamic routes appear in the output.

- [ ] **Step 4: Commit**

```bash
git add "app/employees/[id]/payslips/new/page.tsx" "app/employees/[id]/payslips/[payslipId]/page.tsx"
git commit -m "feat: month form + slip preview pages"
```

---

## Task 17: E2E — month → preview → issue → reprint → next number

**Files:**
- Create: `tests/e2e/payslip.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/payslip.spec.ts
import { test, expect } from "@playwright/test";

test("issue assigns a serial; reprint keeps it; next slip gets the next number", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  await page.goto("/signup");
  await page.fill("input[name='username']", `p${tag}`);
  await page.fill("input[name='email']", `pay_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  // company
  await page.goto("/companies");
  await page.fill("input[name='name']", "PayCo");
  await page.fill("input[name='firma']", "PayCo GmbH*Str 1*10115 Berlin");
  await page.click("button:has-text('Add company')");
  await expect(page.getByText("PayCo", { exact: true })).toBeVisible();

  // employee (automatik on so the engine computes)
  await page.goto("/employees/new");
  await page.selectOption("select[name='company_id']", { label: "PayCo" });
  await page.fill("input[name='mitarbeiter.name']", "Erika Beispiel");
  await page.check("input[name='automatik.enabled']");
  await page.fill("input[name='automatik.steuerklasse']", "1");
  await page.fill("input[name='automatik.bundesland']", "BE");
  await page.fill("input[name='automatik.age']", "30");
  await page.click("button:has-text('Save employee')");
  await expect(page).toHaveURL(/\/dashboard$/);

  // open employee detail
  await page.click("text=Erika Beispiel");
  await expect(page.getByRole("heading", { name: "Erika Beispiel" })).toBeVisible();

  // month 1 (März)
  await page.click("text=Add month");
  await page.selectOption("select[name='monat']", "März");
  await page.fill("input[name='jahr']", "2026");
  await page.fill("input[name='druckdatum']", "31.03.2026");
  // fill the first brutto row
  await page.fill("input[placeholder='LA']", "100");
  await page.fill("input[placeholder='Bezeichnung']", "Normalstunden");
  await page.fill("input[placeholder='Menge']", "100,00");
  await page.fill("input[placeholder='Faktor']", "20,00");
  await page.click("button:has-text('Save month')");

  // preview page → issue
  await expect(page.getByText("Issue & assign serial")).toBeVisible();
  await page.click("button:has-text('Issue & assign serial')");
  const serial1Text = await page.getByText(/Serial #\d+/).textContent();
  const serial1 = Number(serial1Text!.match(/\d+/)![0]);
  expect(serial1).toBeGreaterThan(0);

  // reprint = revisit: same serial
  await page.reload();
  await expect(page.getByText(`Serial #${serial1}`)).toBeVisible();

  // month 2 (April) → issue → next number
  await page.goto(`/dashboard`);
  await page.click("text=Erika Beispiel");
  await page.click("text=Add month");
  await page.selectOption("select[name='monat']", "April");
  await page.fill("input[name='jahr']", "2026");
  await page.fill("input[placeholder='LA']", "100");
  await page.fill("input[placeholder='Menge']", "100,00");
  await page.fill("input[placeholder='Faktor']", "20,00");
  await page.click("button:has-text('Save month')");
  await page.click("button:has-text('Issue & assign serial')");
  const serial2Text = await page.getByText(/Serial #\d+/).textContent();
  const serial2 = Number(serial2Text!.match(/\d+/)![0]);
  expect(serial2).toBe(serial1 + 1);
});
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test tests/e2e/payslip.spec.ts`
Expected: PASS. (If the issue button times out, confirm the serial RPC is applied — Task 2 — and that the dev server has the latest `.env.local`.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/payslip.spec.ts
git commit -m "test: e2e payslip issue/reprint/serial sequence"
```

---

## Task 18: full suite + plan close-out

- [ ] **Step 1: Run the unit suite**

Run: `npm run test`
Expected: all unit tests PASS (existing + cumulative + assemble-state + payslip-data).

- [ ] **Step 2: Run the E2E suite**

Run: `npm run test:e2e`
Expected: all E2E PASS (auth, demo, crud, template-contract, payslip).

- [ ] **Step 3: Update project memory**

Mark Plan 4 done in `C:\Users\sadap\.claude\projects\C--Users-sadap-Documents-GitHub-gehaltsabrechnulg\memory\project-saas-refactor.md` (roadmap line) and note: serial slot = `bank.code`; templates now carry `autoVerdienst` + cumulative branch; `assembleState`/`cumulative`/`payslips` data layer exist.

- [ ] **Step 4: Present the Plan 4 completion checkpoint** and offer Plan 5 (wizard + form polish).

---

## Deferred to Plan 5 (Wizard UX & form polish) — tracked so nothing is lost

- 3-step stepper: Personal → Company (dropdown + inline add) → Months, wrapping the existing employee form + `MonthForm`.
- **Field tooltips:** an info marker on every employee/company field showing an English description **and an example** on hover (extend `EMPLOYEE_FIELD_GROUPS` and the company field set with `description` + `example`).
- **Edit company** (currently only add/delete exist): add `updateCompany` + an edit form, and a `mandant_box` input on the company form.
- **Date pickers** for date fields (German-style if practical, otherwise a native date input).
- Pers-Nr unify in the form UI (one input labeled "Personal-Nr."; the separate "Pers.-Nr. (Box)" field is removed since `assembleState` already mirrors it).
- Verify employee create/edit happy paths through the new wizard.
- Optional: manual Steuer/SV/Verdienst entry for non-automatik months and `datev-highcopy`.

## Deferred to Plan 6 — Dark UI polish (`frontend-design`).

---

## Self-Review (run against the spec)

**Spec coverage:**
- Data model payslips + serial_counter → Tasks 1, 2. `computed_totals` capture → Task 11. ✓
- `assembleState` pure mapping incl. injected serial → Task 7. ✓
- `allocate_serial()` atomic global, assign-once/reuse → Tasks 2, 9 (`issuePayslip` reuse branch). ✓
- Cumulative true-sum + capability flags + `renderJahreswerte` tweak → Tasks 6, 10, 14 (uses `supportsCumulative`). ✓
- Per-template capabilities respected (`datev-highcopy` excluded from edits; "(single month)" label) → Tasks 10, 14. ✓
- Template choice per-company default, overridable per slip → Task 14 switcher + Task 16 default. ✓
- Tests: assembleState mapping, cumulative correctness, template contract, E2E happy path → Tasks 7, 6, 10, 17. (RLS + serial-atomicity DB tests are exercised via the E2E sequence + the SQL check in Task 2; a dedicated cross-user RLS test is a Plan-level testing add-on, noted here.)
- User notes: Pers-Nr unify (Task 7), Mandant box/oben separation (Tasks 3, 7), template switch on preview (Task 14). Field tooltips / edit company / date pickers / wizard → Plan 5 (listed above). ✓

**Placeholder scan:** every code step contains complete code; the only "apply identical edit to N files" instruction (Task 10 Step 6) repeats the exact code from Steps 1–3 and is guarded by the all-11 contract test in Step 7. No TBD/TODO left.

**Type consistency:** `ComputedTotals` (numbers) defined in Task 5 and reused by `sumComputedTotals` (Task 6), `SlipFrame.captureComputed` (Task 11), `payslips` layer (Task 9), `SlipPreview` (Task 14). `CumulativeTotals` (Task 4) = `ComputedTotals` + `monatszahl`; its field names match the `renderJahreswerte` branch (Task 10). `PayslipData` (Task 5) matches `buildPayslipData` output (Task 8) and `assembleState` reads (Task 7). `assembleState(company, employee, payslip, opts)` signature is identical across Tasks 7 and 14.
