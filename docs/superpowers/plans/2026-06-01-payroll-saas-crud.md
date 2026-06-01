# Payroll SaaS — Plan 3: Companies & Employees CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user manage their own private companies and employees — create/list/delete companies, and create/list/search/edit/delete employees (storing the person-level slip fields) — all isolated per user by RLS.

**Architecture:** Two new Postgres tables (`companies`, `employees`) with owner-scoped RLS, applied via `supabase db push`. A thin server-side data layer (`lib/db/*`) wraps Supabase queries; React Server Components render lists and forms; React 19 server actions perform mutations. Employee person-fields are stored as a JSONB `data` blob mirroring `SlipState`'s `mitarbeiter`/`meta`/`automatik`, and the employee form is generated from a field config so it stays DRY. The multi-step wizard, months, and slip generation come in Plan 4.

**Tech Stack:** Next.js 15 · React 19 · Supabase (Postgres + RLS) · `supabase` CLI (`db push`) · Vitest · Playwright.

**Spec:** `docs/superpowers/specs/2026-06-01-payroll-saas-design.md` (§ Data model)

**Builds on:** Plan 2 (auth, `lib/supabase/*`, `profiles`, RLS pattern, protected routes).

---

## File Structure (created/modified in this plan)

```
supabase/migrations/0002_companies.sql     # companies table + RLS
supabase/migrations/0003_employees.sql     # employees table + RLS
lib/db/types.ts                            # Company, Employee, EmployeeData types
lib/db/companies.ts                        # list/create/update/delete companies
lib/db/employees.ts                        # list/get/create/update/delete employees
lib/employee-fields.ts                     # field config that drives the employee form
lib/employee-data.ts                       # buildEmployeeData (FormData -> EmployeeData) + filterEmployees
app/companies/actions.ts                   # server actions: createCompany, deleteCompany
app/companies/page.tsx                     # companies list + add form + delete
app/employees/actions.ts                   # server actions: saveEmployee, deleteEmployee
app/employees/new/page.tsx                 # create employee
app/employees/[id]/edit/page.tsx           # edit employee
components/EmployeeForm.tsx                 # generic field-config form + company dropdown
components/EmployeeList.tsx                 # client list with search box
app/dashboard/page.tsx                     # MODIFY: employee list + search + New employee
tests/unit/employee-data.test.ts           # buildEmployeeData + filterEmployees
tests/e2e/crud.spec.ts                     # signup -> add company -> add employee -> search -> delete
```

---

### Task 1: companies table + RLS (via db push)

**Files:**
- Create: `supabase/migrations/0002_companies.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_companies.sql`:
```sql
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  firma text not null default '',
  mandant text not null default '',
  roc_code text not null default '',
  default_template text not null default 'datev-classic',
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "companies_select_own" on public.companies
  for select using (auth.uid() = owner_id);
create policy "companies_insert_own" on public.companies
  for insert with check (auth.uid() = owner_id);
create policy "companies_update_own" on public.companies
  for update using (auth.uid() = owner_id);
create policy "companies_delete_own" on public.companies
  for delete using (auth.uid() = owner_id);

create index companies_owner_idx on public.companies (owner_id);
```

- [ ] **Step 2: Apply it**

Run: `npx supabase db push`
Expected: the CLI lists `0002_companies.sql` as pending and applies it; ends with "Finished supabase db push." (Pass `--password "<db-password>"` if prompted.)

- [ ] **Step 3: Verify**

Run: `npx supabase migration list`
Expected: `0002` now appears in both **Local** and **Remote** columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_companies.sql
git commit -m "feat: companies table with owner RLS"
```

---

### Task 2: employees table + RLS (via db push)

**Files:**
- Create: `supabase/migrations/0003_employees.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0003_employees.sql`:
```sql
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;

create policy "employees_select_own" on public.employees
  for select using (auth.uid() = owner_id);
create policy "employees_insert_own" on public.employees
  for insert with check (auth.uid() = owner_id);
create policy "employees_update_own" on public.employees
  for update using (auth.uid() = owner_id);
create policy "employees_delete_own" on public.employees
  for delete using (auth.uid() = owner_id);

create index employees_owner_idx on public.employees (owner_id);
create index employees_company_idx on public.employees (company_id);
```

- [ ] **Step 2: Apply it**

Run: `npx supabase db push`
Expected: applies `0003_employees.sql`; "Finished supabase db push."

- [ ] **Step 3: Verify**

Run: `npx supabase migration list`
Expected: `0003` in both **Local** and **Remote**.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_employees.sql
git commit -m "feat: employees table with owner RLS"
```

---

### Task 3: Types, data layer, and pure helpers (TDD)

**Files:**
- Create: `lib/db/types.ts`, `lib/db/companies.ts`, `lib/db/employees.ts`, `lib/employee-fields.ts`, `lib/employee-data.ts`
- Test: `tests/unit/employee-data.test.ts`

- [ ] **Step 1: Types**

`lib/db/types.ts`:
```typescript
export type Company = {
  id: string;
  owner_id: string;
  name: string;
  firma: string;
  mandant: string;
  roc_code: string;
  default_template: string;
  created_at: string;
};

export type EmployeeData = {
  mitarbeiter: { name: string; strasse: string; plzOrt: string };
  // person-stable slip meta fields (excludes mandant/rocCode -> company,
  // and druckdatum/blatt -> payslip)
  meta: Record<string, string>;
  automatik: {
    enabled: boolean;
    steuerklasse: number;
    faktor: string;
    konfession: string;
    bundesland: string;
    freibetragMonatlich: string;
    kkZusatzbeitrag: string;
    kinder: number;
    age: number;
    midijob: boolean;
    westOst: string;
  };
};

export type Employee = {
  id: string;
  owner_id: string;
  company_id: string | null;
  name: string;
  data: EmployeeData;
  created_at: string;
};
```

- [ ] **Step 2: Field config**

`lib/employee-fields.ts`:
```typescript
export type EmployeeField = { path: string; label: string; type?: "text" | "checkbox" };
export type EmployeeFieldGroup = { title: string; fields: EmployeeField[] };

export const EMPLOYEE_FIELD_GROUPS: EmployeeFieldGroup[] = [
  {
    title: "Mitarbeiter",
    fields: [
      { path: "mitarbeiter.name", label: "Name" },
      { path: "mitarbeiter.strasse", label: "Straße + Nr." },
      { path: "mitarbeiter.plzOrt", label: "PLZ + Ort" },
    ],
  },
  {
    title: "Kopfdaten",
    fields: [
      { path: "meta.persNr", label: "Personal-Nr." },
      { path: "meta.geburtsdatum", label: "Geburtsdatum" },
      { path: "meta.stKl", label: "Steuerklasse" },
      { path: "meta.konfession", label: "Konfession" },
      { path: "meta.svNummer", label: "SV-Nummer" },
      { path: "meta.krankenkasse", label: "Krankenkasse" },
      { path: "meta.kkProzent", label: "KK %" },
      { path: "meta.pgrs", label: "PGRS" },
      { path: "meta.bgrs", label: "BGRS" },
      { path: "meta.eintritt", label: "Eintritt" },
      { path: "meta.austritt", label: "Austritt" },
      { path: "meta.steuerId", label: "Steuer-ID" },
      { path: "meta.persNrBox", label: "Pers.-Nr. (Box)" },
      { path: "meta.abtNr", label: "Abt.-Nr." },
    ],
  },
  {
    title: "Automatik (Steuer/SV-Berechnung)",
    fields: [
      { path: "automatik.enabled", label: "Automatik aktiv", type: "checkbox" },
      { path: "automatik.steuerklasse", label: "Steuerklasse (1-6)" },
      { path: "automatik.bundesland", label: "Bundesland (z.B. BE)" },
      { path: "automatik.kkZusatzbeitrag", label: "KK-Zusatzbeitrag %" },
      { path: "automatik.kinder", label: "Kinder" },
      { path: "automatik.age", label: "Alter" },
      { path: "automatik.midijob", label: "Midijob", type: "checkbox" },
      { path: "automatik.westOst", label: "West/Ost (W/O)" },
      { path: "automatik.freibetragMonatlich", label: "Freibetrag mtl." },
    ],
  },
];

// flat list of every field path the form renders
export const EMPLOYEE_FIELD_PATHS = EMPLOYEE_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.path),
);
```

- [ ] **Step 3: Write the failing helper test**

`tests/unit/employee-data.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildEmployeeData, filterEmployees } from "@/lib/employee-data";
import type { Employee } from "@/lib/db/types";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("buildEmployeeData", () => {
  it("nests dotted field names and coerces checkbox + number fields", () => {
    const data = buildEmployeeData(
      form({
        "mitarbeiter.name": "Max",
        "meta.persNr": "1001",
        "automatik.enabled": "on",
        "automatik.steuerklasse": "1",
        "automatik.kinder": "2",
        "automatik.age": "30",
      }),
    );
    expect(data.mitarbeiter.name).toBe("Max");
    expect(data.meta.persNr).toBe("1001");
    expect(data.automatik.enabled).toBe(true);
    expect(data.automatik.steuerklasse).toBe(1);
    expect(data.automatik.kinder).toBe(2);
    expect(data.automatik.midijob).toBe(false); // unchecked checkbox absent
  });
});

describe("filterEmployees", () => {
  const list = [
    { id: "1", name: "Max Mustermann" },
    { id: "2", name: "Erika Beispiel" },
  ] as Employee[];

  it("returns all when query is empty", () => {
    expect(filterEmployees(list, "")).toHaveLength(2);
  });
  it("matches case-insensitively by name", () => {
    expect(filterEmployees(list, "erika").map((e) => e.id)).toEqual(["2"]);
  });
});
```

- [ ] **Step 4: Run it to verify failure**

Run: `npm test`
Expected: FAIL — `@/lib/employee-data` does not exist.

- [ ] **Step 5: Implement the helpers**

`lib/employee-data.ts`:
```typescript
import type { Employee, EmployeeData } from "@/lib/db/types";

const CHECKBOX_PATHS = new Set(["automatik.enabled", "automatik.midijob"]);
const NUMBER_PATHS = new Set([
  "automatik.steuerklasse",
  "automatik.kinder",
  "automatik.age",
]);

export function buildEmployeeData(formData: FormData): EmployeeData {
  const data: EmployeeData = {
    mitarbeiter: { name: "", strasse: "", plzOrt: "" },
    meta: {},
    automatik: {
      enabled: false,
      steuerklasse: 1,
      faktor: "",
      konfession: "",
      bundesland: "",
      freibetragMonatlich: "",
      kkZusatzbeitrag: "",
      kinder: 0,
      age: 0,
      midijob: false,
      westOst: "W",
    },
  };

  for (const [path, raw] of formData.entries()) {
    if (!path.includes(".")) continue;
    const value = typeof raw === "string" ? raw : "";
    const [group, key] = path.split(".");
    if (CHECKBOX_PATHS.has(path)) {
      setNested(data, group, key, value === "on" || value === "true");
    } else if (NUMBER_PATHS.has(path)) {
      setNested(data, group, key, Number(value) || 0);
    } else {
      setNested(data, group, key, value);
    }
  }

  // checkboxes are absent from FormData when unchecked
  if (!formData.has("automatik.enabled")) data.automatik.enabled = false;
  if (!formData.has("automatik.midijob")) data.automatik.midijob = false;

  return data;
}

function setNested(
  data: EmployeeData,
  group: string,
  key: string,
  value: string | number | boolean,
) {
  const bucket = (data as unknown as Record<string, Record<string, unknown>>)[
    group
  ];
  if (bucket) bucket[key] = value;
}

export function filterEmployees<T extends { name: string }>(
  list: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((e) => e.name.toLowerCase().includes(q));
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `buildEmployeeData` + `filterEmployees` green (plus all earlier unit tests).

- [ ] **Step 7: Companies data layer**

`lib/db/companies.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { Company } from "./types";

export async function listCompanies(): Promise<Company[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as Company[];
}

export async function createCompany(input: {
  name: string;
  firma: string;
  mandant: string;
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

export async function deleteCompany(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 8: Employees data layer**

`lib/db/employees.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { Employee, EmployeeData } from "./types";

export async function listEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Employee[];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Employee | null;
}

export async function createEmployee(input: {
  company_id: string | null;
  data: EmployeeData;
}): Promise<Employee> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("employees")
    .insert({
      owner_id: user!.id,
      company_id: input.company_id,
      name: input.data.mitarbeiter.name,
      data: input.data,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(
  id: string,
  input: { company_id: string | null; data: EmployeeData },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      company_id: input.company_id,
      name: input.data.mitarbeiter.name,
      data: input.data,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEmployee(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 9: Commit**

```bash
git add lib/db lib/employee-fields.ts lib/employee-data.ts tests/unit/employee-data.test.ts
git commit -m "feat: companies/employees data layer + employee field config"
```

---

### Task 4: Companies management page

**Files:**
- Create: `app/companies/actions.ts`, `app/companies/page.tsx`

- [ ] **Step 1: Server actions**

`app/companies/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import {
  createCompany as createCompanyDb,
  deleteCompany as deleteCompanyDb,
} from "@/lib/db/companies";

export async function createCompany(formData: FormData): Promise<void> {
  await createCompanyDb({
    name: String(formData.get("name") ?? "").trim(),
    firma: String(formData.get("firma") ?? ""),
    mandant: String(formData.get("mandant") ?? ""),
    roc_code: String(formData.get("roc_code") ?? ""),
    default_template: String(formData.get("default_template") ?? "datev-classic"),
  });
  revalidatePath("/companies");
}

export async function deleteCompany(formData: FormData): Promise<void> {
  await deleteCompanyDb(String(formData.get("id")));
  revalidatePath("/companies");
}
```

- [ ] **Step 2: Companies page**

`app/companies/page.tsx`:
```tsx
import Link from "next/link";
import { listCompanies } from "@/lib/db/companies";
import { TEMPLATES } from "@/lib/template-manifest";
import { createCompany, deleteCompany } from "./actions";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Companies</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400">
          ← Dashboard
        </Link>
      </div>

      <ul className="mt-6 divide-y divide-neutral-800">
        {companies.length === 0 && (
          <li className="py-4 text-neutral-500">No companies yet.</li>
        )}
        {companies.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-neutral-100">{c.name}</p>
              <p className="text-xs text-neutral-500">{c.firma}</p>
            </div>
            <form action={deleteCompany}>
              <input type="hidden" name="id" value={c.id} />
              <button className="text-xs text-red-400">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <form
        action={createCompany}
        className="mt-8 flex flex-col gap-3 border-t border-neutral-800 pt-6"
      >
        <h2 className="text-sm font-medium text-neutral-300">Add company</h2>
        <input name="name" placeholder="Display name" required className="cmp-input" />
        <input name="firma" placeholder="Employer line (Firma*Straße*PLZ Ort)" className="cmp-input" />
        <div className="flex gap-3">
          <input name="mandant" placeholder="Mandant" className="cmp-input flex-1" />
          <input name="roc_code" placeholder="R0C code" className="cmp-input flex-1" />
        </div>
        <select name="default_template" className="cmp-input" defaultValue="datev-classic">
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="self-start rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">
          Add company
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Shared input style**

Append to `app/globals.css`:
```css
.cmp-input {
  border: 1px solid #2d3138;
  background: #14171c;
  color: #e7e9ec;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  outline: none;
}
.cmp-input:focus {
  border-color: #6b7280;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`; route `/companies` listed.

- [ ] **Step 5: Commit**

```bash
git add app/companies app/globals.css
git commit -m "feat: companies management page"
```

---

### Task 5: Employee form + dashboard list

**Files:**
- Create: `components/EmployeeForm.tsx`, `components/EmployeeList.tsx`, `app/employees/actions.ts`, `app/employees/new/page.tsx`, `app/employees/[id]/edit/page.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Employee server actions**

`app/employees/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildEmployeeData } from "@/lib/employee-data";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee as deleteEmployeeDb,
} from "@/lib/db/employees";

export async function saveEmployee(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const companyRaw = String(formData.get("company_id") ?? "");
  const company_id = companyRaw === "" ? null : companyRaw;
  const data = buildEmployeeData(formData);

  if (id) {
    await updateEmployee(id, { company_id, data });
  } else {
    await createEmployee({ company_id, data });
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteEmployee(formData: FormData): Promise<void> {
  await deleteEmployeeDb(String(formData.get("id")));
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Employee form component**

`components/EmployeeForm.tsx`:
```tsx
import { EMPLOYEE_FIELD_GROUPS } from "@/lib/employee-fields";
import type { Company, Employee } from "@/lib/db/types";
import { saveEmployee } from "@/app/employees/actions";

function getPath(obj: unknown, path: string): string {
  const [g, k] = path.split(".");
  const bucket = (obj as Record<string, Record<string, unknown>> | undefined)?.[g];
  const v = bucket?.[k];
  if (v === undefined || v === null) return "";
  return typeof v === "boolean" ? (v ? "on" : "") : String(v);
}

export function EmployeeForm({
  companies,
  employee,
}: {
  companies: Company[];
  employee?: Employee;
}) {
  const d = employee?.data;
  return (
    <form action={saveEmployee} className="flex flex-col gap-6">
      {employee && <input type="hidden" name="id" value={employee.id} />}

      <label className="flex flex-col gap-1 text-sm text-neutral-300">
        Company
        <select
          name="company_id"
          defaultValue={employee?.company_id ?? ""}
          className="cmp-input"
        >
          <option value="">— none —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <a href="/companies" className="text-xs text-neutral-500 underline">
          Manage companies
        </a>
      </label>

      {EMPLOYEE_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-300">
            {group.title}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {group.fields.map((f) => {
              const value = d ? getPath(d, f.path) : "";
              if (f.type === "checkbox") {
                return (
                  <label
                    key={f.path}
                    className="flex items-center gap-2 text-sm text-neutral-300"
                  >
                    <input
                      type="checkbox"
                      name={f.path}
                      defaultChecked={value === "on"}
                    />
                    {f.label}
                  </label>
                );
              }
              return (
                <label
                  key={f.path}
                  className="flex flex-col gap-1 text-xs text-neutral-400"
                >
                  {f.label}
                  <input
                    name={f.path}
                    defaultValue={value}
                    className="cmp-input"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <button className="self-start rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900">
        Save employee
      </button>
    </form>
  );
}
```

- [ ] **Step 3: New + edit pages**

`app/employees/new/page.tsx`:
```tsx
import { listCompanies } from "@/lib/db/companies";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function NewEmployeePage() {
  const companies = await listCompanies();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">
        New employee
      </h1>
      <EmployeeForm companies={companies} />
    </main>
  );
}
```

`app/employees/[id]/edit/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { listCompanies } from "@/lib/db/companies";
import { getEmployee } from "@/lib/db/employees";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [companies, employee] = await Promise.all([
    listCompanies(),
    getEmployee(id),
  ]);
  if (!employee) notFound();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">
        Edit employee
      </h1>
      <EmployeeForm companies={companies} employee={employee} />
    </main>
  );
}
```

- [ ] **Step 4: Employee list (client, with search)**

`components/EmployeeList.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Employee } from "@/lib/db/types";
import { filterEmployees } from "@/lib/employee-data";
import { deleteEmployee } from "@/app/employees/actions";

export function EmployeeList({ employees }: { employees: Employee[] }) {
  const [q, setQ] = useState("");
  const shown = filterEmployees(employees, q);
  return (
    <div className="mt-6">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search employees…"
        className="cmp-input w-full"
      />
      <ul className="mt-4 divide-y divide-neutral-800">
        {shown.length === 0 && (
          <li className="py-4 text-neutral-500">No employees.</li>
        )}
        {shown.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-3">
            <Link
              href={`/employees/${e.id}/edit`}
              className="text-neutral-100 hover:underline"
            >
              {e.name || "(unnamed)"}
            </Link>
            <form action={deleteEmployee}>
              <input type="hidden" name="id" value={e.id} />
              <button className="text-xs text-red-400">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Update the dashboard**

Replace `app/dashboard/page.tsx` with:
```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { listEmployees } from "@/lib/db/employees";
import { EmployeeList } from "@/components/EmployeeList";

export default async function DashboardPage() {
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

  const employees = await listEmployees();

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Employees</h1>
          <p className="text-xs text-neutral-500">
            {profile?.username ?? user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/companies" className="text-sm text-neutral-400">
            Companies
          </Link>
          <Link
            href="/employees/new"
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900"
          >
            New employee
          </Link>
          <form action={logout}>
            <button className="text-sm text-neutral-400">Log out</button>
          </form>
        </div>
      </div>

      <EmployeeList employees={employees} />
    </main>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`; routes `/employees/new`, `/employees/[id]/edit`, `/companies`, `/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add components/EmployeeForm.tsx components/EmployeeList.tsx app/employees app/dashboard/page.tsx
git commit -m "feat: employee form + searchable dashboard list"
```

---

### Task 6: End-to-end CRUD happy path

**Files:**
- Create: `tests/e2e/crud.spec.ts`

- [ ] **Step 1: Write the E2E**

`tests/e2e/crud.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test("user can add a company and an employee, then search and delete", async ({
  page,
}) => {
  // fresh account
  const tag = Date.now().toString(36);
  await page.goto("/signup");
  await page.fill("input[name='username']", `u${tag}`);
  await page.fill("input[name='email']", `crud_${tag}@example.com`);
  await page.fill("input[name='password']", "supersecret123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard$/);

  // add a company
  await page.goto("/companies");
  await page.fill("input[name='name']", "ACME GmbH");
  await page.fill("input[name='firma']", "ACME GmbH*Street 1*10115 Berlin");
  await page.click("button:has-text('Add company')");
  await expect(page.getByText("ACME GmbH")).toBeVisible();

  // add an employee
  await page.goto("/employees/new");
  await page.selectOption("select[name='company_id']", { label: "ACME GmbH" });
  await page.fill("input[name='mitarbeiter.name']", "Max Mustermann");
  await page.click("button:has-text('Save employee')");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Max Mustermann")).toBeVisible();

  // search narrows the list
  await page.fill("input[placeholder='Search employees…']", "zzz");
  await expect(page.getByText("Max Mustermann")).toHaveCount(0);
  await page.fill("input[placeholder='Search employees…']", "max");
  await expect(page.getByText("Max Mustermann")).toBeVisible();

  // delete
  await page.fill("input[placeholder='Search employees…']", "");
  await page.click("li:has-text('Max Mustermann') button:has-text('Delete')");
  await expect(page.getByText("Max Mustermann")).toHaveCount(0);
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e`
Expected: PASS — all E2E (demo, auth, crud). The crud test signs up, adds a company, adds an employee, searches, and deletes.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/crud.spec.ts
git commit -m "test: e2e companies + employees CRUD happy path"
```

---

## Self-Review

**1. Spec coverage (§ Data model):**
- "companies — owner_id, name, firma, codes, default_template; private per user via RLS" → Task 1. ✓
- "employees — owner_id, company_id, person-level fields" → Task 2 (table) + Task 3 (`EmployeeData` JSONB mirroring `SlipState` mitarbeiter/meta/automatik). ✓
- "the company dropdown; add companies and reuse them" → Task 4 (companies CRUD) + Task 5 (dropdown in the employee form). Inline add-from-wizard is Plan 4. ✓
- "dashboard: employee list + search + New employee" → Task 5. ✓
- "data is saved, editable later" → Task 5 (edit page) + Task 3 (`updateEmployee`). ✓
- RLS isolation reuses the Plan 2 pattern (`owner_id = auth.uid()`, insert WITH CHECK). ✓
- Deferred to Plan 4 (correct): the 3-step wizard, inline company add inside the wizard, months/payslips, `assembleState`, serial counter, slip print. Month-varying meta (`mandant`/`rocCode` from company; `druckdatum`/`blatt` from payslip) are intentionally not employee fields.

**2. Placeholder scan:** No TBD/TODO. All migrations, data-layer functions, components, and the field config are complete. The employee form renders from `EMPLOYEE_FIELD_GROUPS`, so adding fields later is a config edit, not new JSX. The E2E creates a real account/data (inherent to testing an auth-gated app); it uses a timestamp tag so reruns don't collide.

**3. Type consistency:** `Company`, `Employee`, `EmployeeData` (`lib/db/types.ts`) are used identically across the data layer, server actions, form, and list. `buildEmployeeData(FormData): EmployeeData` and `filterEmployees(list, q)` signatures match their call sites and tests. Field `path` strings in `EMPLOYEE_FIELD_GROUPS` ("group.key") match what `buildEmployeeData`/`getPath` split on. Server actions use `(formData: FormData) => Promise<void>` to match `<form action=…>`. The `.cmp-input` class is defined once (Task 4) and reused by the company form, employee form, and search box.

**Note for Plan 4:** `assembleState(company, employee, payslip)` composes `SlipState` as: `firma`/`mandant`/`rocCode`/template ← company; `mitarbeiter`/`meta`(rest)/`automatik` ← `employee.data`; `zeitraum`/`brutto`/`steuer`/`sv`/`verdienst`/`nettoBezuege`/`bank`/`druckdatum`/`blatt` ← `payslip.data`; plus the injected serial number and summed cumulative `verdienst`.
