# Payroll SaaS — Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js + Tailwind app, move the 12 slip templates in with capability flags, and prove the slip renders correctly inside the app from a typed `SlipState` object via the iframe `postMessage` contract.

**Architecture:** A fresh Next.js (App Router, TypeScript) shell coexists with the existing repo files. The 12 templates become static assets under `public/templates` and are reused untouched — each is an iframe render+calc engine driven by one `postMessage({type:"setState", state})`. A `SlipFrame` client component loads a template, posts a `SlipState`, and prints it. This plan ships a `/demo` page that renders a real slip from a fixture and verifies the embedded calculation engine still runs.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 3 · Vitest (unit) · Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-01-payroll-saas-design.md`

---

## File Structure (created in this plan)

```
package.json                              # scripts + deps
tsconfig.json                             # TS config (App Router)
next.config.mjs                           # Next config
postcss.config.mjs                        # Tailwind/Autoprefixer
tailwind.config.ts                        # content globs
vitest.config.ts                          # unit test config (node env)
playwright.config.ts                      # E2E config (boots dev server)
app/layout.tsx                            # root layout, imports globals.css
app/globals.css                           # tailwind directives + dark base
app/page.tsx                              # temporary home → links to /demo
app/demo/page.tsx                         # renders SlipFrame from the fixture
components/SlipFrame.tsx                   # iframe loader + postMessage + print (client)
lib/slip-state.ts                         # SlipState TypeScript contract (the template's expected shape)
lib/template-manifest.ts                  # typed loader + TemplateMeta type
lib/fixtures/sample-slip.ts               # a real, valid SlipState captured from index.html
public/templates/*.html                   # MOVED from /templates (unchanged)
public/templates/template-manifest.json   # MOVED + capability flags added
tests/unit/manifest.test.ts               # asserts capability flags + files exist
tests/unit/sample-slip.test.ts            # asserts fixture shape/values
tests/e2e/demo-slip.spec.ts               # renders /demo, asserts engine computed a total
```

The old `index.html` and root-level `*.pdf`/`*.png` reference files are left in place for now (a later plan moves them under `reference/`).

---

### Task 1: Scaffold Next.js + Tailwind + test runners

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gehaltsabrechnung-saas",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install next@15 react@19 react-dom@19
npm install -D typescript@5 @types/node @types/react @types/react-dom \
  tailwindcss@3 postcss autoprefixer \
  vitest@2 \
  @playwright/test eslint eslint-config-next@15
npx playwright install chromium
```
Expected: dependencies install; `node_modules` populated; no fatal errors.

- [ ] **Step 3: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "templates", "public/templates", "scripts"]
}
```

`next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`postcss.config.mjs`:
```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Create the app shell**

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}
html, body {
  background: #0b0d10;
  color: #e7e9ec;
}
```

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gehaltsabrechnung",
  description: "Payroll slips",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold">Gehaltsabrechnung SaaS</h1>
      <p className="mt-2 text-neutral-400">Foundation scaffold.</p>
      <Link
        href="/demo"
        className="mt-6 inline-block rounded bg-neutral-100 px-4 py-2 text-neutral-900"
      >
        Open slip demo
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Create test-runner configs**

`vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
```

`playwright.config.ts`:
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, output ends with "Compiled successfully" / route list including `/` and (after Task 4) `/demo`. At this point only `/` exists — that is fine.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts vitest.config.ts playwright.config.ts app/ .gitignore
git commit -m "chore: scaffold Next.js + Tailwind + Vitest + Playwright"
```

---

### Task 2: Move templates to `public/templates` with capability flags

**Files:**
- Move: `templates/*.html` → `public/templates/*.html`
- Move + edit: `templates/template-manifest.json` → `public/templates/template-manifest.json`
- Create: `lib/template-manifest.ts`
- Test: `tests/unit/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/manifest.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "templates");
const manifest = JSON.parse(
  readFileSync(join(DIR, "template-manifest.json"), "utf8"),
) as Array<{
  id: string;
  name: string;
  file: string;
  supportsCumulative: boolean;
  supportsAutoTax: boolean;
}>;

describe("template manifest", () => {
  it("has 12 templates", () => {
    expect(manifest).toHaveLength(12);
  });

  it("every referenced file exists", () => {
    for (const t of manifest) {
      expect(existsSync(join(DIR, t.file)), t.file).toBe(true);
    }
  });

  it("datev-highcopy is single-month (no cumulative, no auto-tax)", () => {
    const hc = manifest.find((t) => t.id === "datev-highcopy")!;
    expect(hc.supportsCumulative).toBe(false);
    expect(hc.supportsAutoTax).toBe(false);
  });

  it("the other 11 support cumulative + auto-tax", () => {
    for (const t of manifest.filter((t) => t.id !== "datev-highcopy")) {
      expect(t.supportsCumulative, t.id).toBe(true);
      expect(t.supportsAutoTax, t.id).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `public/templates/template-manifest.json` does not exist yet (ENOENT).

- [ ] **Step 3: Move the template files**

Run:
```bash
git mv templates public/templates
```
Expected: all `*.html` and `template-manifest.json` now live under `public/templates/`.

- [ ] **Step 4: Add capability flags to the manifest**

Replace the entire contents of `public/templates/template-manifest.json` with:
```json
[
  { "id": "datev-classic",   "name": "DATEV Classic",   "file": "datev-classic.html",   "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "datev-highcopy",  "name": "DATEV HighCopy",  "file": "datev-highcopy.html",  "supportsCumulative": false, "supportsAutoTax": false },
  { "id": "lexware-classic", "name": "Lexware Classic", "file": "lexware-classic.html", "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "sage-classic",    "name": "Sage Classic",    "file": "sage-classic.html",    "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "viper-classic",   "name": "Viper Classic",   "file": "viper-classic.html",   "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "neon-classic",    "name": "Neon Classic",    "file": "neon-classic.html",    "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "atlas-classic",   "name": "Atlas Classic",   "file": "atlas-classic.html",   "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "aurora-classic",  "name": "Aurora Classic",  "file": "aurora-classic.html",  "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "ledger-classic",  "name": "Ledger Classic",  "file": "ledger-classic.html",  "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "slate-classic",   "name": "Slate Classic",   "file": "slate-classic.html",   "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "prism-classic",   "name": "Prism Classic",   "file": "prism-classic.html",   "supportsCumulative": true,  "supportsAutoTax": true },
  { "id": "quartz-classic",  "name": "Quartz Classic",  "file": "quartz-classic.html",  "supportsCumulative": true,  "supportsAutoTax": true }
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 4 manifest tests green.

- [ ] **Step 6: Create the typed manifest loader**

`lib/template-manifest.ts`:
```typescript
import manifest from "@/public/templates/template-manifest.json";

export type TemplateMeta = {
  id: string;
  name: string;
  file: string;
  supportsCumulative: boolean;
  supportsAutoTax: boolean;
};

export const TEMPLATES: TemplateMeta[] = manifest as TemplateMeta[];

export const DEFAULT_TEMPLATE_ID = "datev-classic";

export function templateById(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
```

- [ ] **Step 7: Commit**

```bash
git add public/templates lib/template-manifest.ts tests/unit/manifest.test.ts
git commit -m "feat: move templates to public/templates with capability flags"
```

---

### Task 3: Define the `SlipState` contract + a real fixture

**Files:**
- Create: `lib/slip-state.ts`
- Create: `lib/fixtures/sample-slip.ts`
- Test: `tests/unit/sample-slip.test.ts`

- [ ] **Step 1: Write the `SlipState` type**

This is the exact object shape the templates consume (extracted from `index.html`'s `state`). `lib/slip-state.ts`:
```typescript
// The exact object a template renders. All values are strings as the user
// typed them (German-formatted, e.g. "2.855,29"); the template does the math.
export interface SlipMeta {
  persNr: string; geburtsdatum: string; stKl: string; faktor: string;
  kiFrbtr: string; konfession: string; freibetragJ: string; freibetragM: string;
  dba: string; midijob: string; stTg: string;
  vjUrlUeb: string; urlAnspr: string; urlTgGen: string; resturlaub: string;
  anwTage: string; urlaubTage: string; krankhTg: string; fehlzTage: string;
  anwStd: string; urlaubStd: string; krankhStd: string; fehlzStd: string;
  zeitlohnStd: string; ueberstd: string; bezStd: string;
  svNummer: string; krankenkasse: string; kkProzent: string;
  pgrs: string; bgrs: string; umSvTg: string;
  eintritt: string; austritt: string; steuerId: string; mfb: string;
  rocCode: string; mandant: string; druckdatum: string; blatt: string;
  persNrBox: string; abtNr: string; bn: string; mandantBox: string;
}

export interface BruttoRow {
  lohnart: string; bezeichnung: string; einheit: string;
  menge: string; faktor: string; prozent: string;
  st: string; sv: string; gb: string;
}

export interface SteuerRow {
  tag: string; steuerBrutto?: string; lohnsteuer?: string;
  kirchensteuer?: string; soli?: string;
}

export interface SvRow {
  tag: string; kvBrutto?: string; rvBrutto?: string; avBrutto?: string;
  pvBrutto?: string; kvBeitrag?: string; rvBeitrag?: string;
  avBeitrag?: string; pvBeitrag?: string;
}

export interface VerdienstBlock {
  nachberechnungVorjahr: boolean;
  gesamtBrutto: string; steuerBrutto: string; lohnsteuer: string;
  kirchensteuer: string; soli: string; steuerfreieBezuege: string;
  pVerstZukSich: string; pfaendungRest: string; darlehenRest: string;
  svBrutto: string; kvBeitrag: string; rvBeitrag: string;
  avBeitrag: string; pvBeitrag: string; vwlGesamt: string; kugAuszahlung: string;
}

export interface NettoRow { lohnart: string; bezeichnung: string; betrag: string; }

export interface BankBlock {
  name: string; iban: string; svAgAnteil: string;
  zusAgKosten: string; gesamtkosten: string; code: string;
}

// Drives the embedded Lohnsteuer/SV engine when enabled.
export interface AutomatikBlock {
  enabled: boolean; steuerklasse: number; faktor: string; konfession: string;
  bundesland: string; freibetragMonatlich: string; kkZusatzbeitrag: string;
  kinder: number; age: number; midijob: boolean; westOst: string;
}

export interface SlipState {
  meta: SlipMeta;
  firma: string;
  mitarbeiter: { name: string; strasse: string; plzOrt: string };
  zeitraum: { monat: string; jahr: string };
  brutto: BruttoRow[];
  steuer: SteuerRow[];
  sv: SvRow[];
  verdienst: VerdienstBlock;
  nettoBezuege: NettoRow[];
  bank: BankBlock;
  hinweiseZurAbrechnung: string;
  automatik: AutomatikBlock;
}
```

- [ ] **Step 2: Write the fixture**

`lib/fixtures/sample-slip.ts` (a real, valid sample lifted from `index.html`; `automatik.enabled` is true so the template auto-computes Steuer/SV):
```typescript
import type { SlipState } from "@/lib/slip-state";

export const sampleSlip: SlipState = {
  meta: {
    persNr: "1122672", geburtsdatum: "250789", stKl: "1", faktor: "",
    kiFrbtr: "0", konfession: "", freibetragJ: "", freibetragM: "",
    dba: "", midijob: "", stTg: "30",
    vjUrlUeb: "", urlAnspr: "", urlTgGen: "", resturlaub: "1,67",
    anwTage: "", urlaubTage: "0,00", krankhTg: "", fehlzTage: "",
    anwStd: "", urlaubStd: "", krankhStd: "", fehlzStd: "",
    zeitlohnStd: "", ueberstd: "", bezStd: "",
    svNummer: "65250789E018", krankenkasse: "Techniker Krankenkasse",
    kkProzent: "17,29", pgrs: "1111", bgrs: "2", umSvTg: "29",
    eintritt: "020326", austritt: "020426", steuerId: "69814453022", mfb: "",
    rocCode: "", mandant: "343424421", druckdatum: "31.03.2026", blatt: "1",
    persNrBox: "1122672", abtNr: "1", bn: "B/N", mandantBox: "",
  },
  firma: "ALLPOWER Personalprofis GmbH*Rankestraße 2*10789 Berlin",
  mitarbeiter: {
    name: "Mohammed El-Korazatti",
    strasse: "Schützenstraße 28",
    plzOrt: "12526 Berlin",
  },
  zeitraum: { monat: "März", jahr: "2026" },
  brutto: [
    { lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "119,00", faktor: "16,69", prozent: "", st: "L", sv: "L", gb: "J" },
    { lohnart: "104", bezeichnung: "Einsatzzulage", einheit: "Std", menge: "8,00", faktor: "3,31", prozent: "", st: "L", sv: "L", gb: "J" },
    { lohnart: "133", bezeichnung: "Branchenzuschlag Vergleichslo", einheit: "Std", menge: "102,08", faktor: "3,31", prozent: "", st: "L", sv: "L", gb: "J" },
    { lohnart: "741", bezeichnung: "Fahrtkostenzuschuss (Aufwendu", einheit: "Tage", menge: "15,00", faktor: "2,50", prozent: "", st: "F", sv: "F", gb: "J" },
  ],
  steuer: [],
  sv: [],
  verdienst: {
    nachberechnungVorjahr: false,
    gesamtBrutto: "2.855,29", steuerBrutto: "2.817,79", lohnsteuer: "254,58",
    kirchensteuer: "", soli: "", steuerfreieBezuege: "37,50",
    pVerstZukSich: "", pfaendungRest: "", darlehenRest: "",
    svBrutto: "2.817,79", kvBeitrag: "243,60", rvBeitrag: "262,05",
    avBeitrag: "36,63", pvBeitrag: "67,63", vwlGesamt: "", kugAuszahlung: "",
  },
  nettoBezuege: [],
  bank: {
    name: "Landesbank Berlin - Berliner S",
    iban: "DE58 1005 0000 1064 1292 65",
    svAgAnteil: "", zusAgKosten: "", gesamtkosten: "", code: "",
  },
  hinweiseZurAbrechnung: "",
  automatik: {
    enabled: true, steuerklasse: 1, faktor: "", konfession: "",
    bundesland: "BE", freibetragMonatlich: "", kkZusatzbeitrag: "2,69",
    kinder: 0, age: 36, midijob: false, westOst: "W",
  },
};
```

- [ ] **Step 3: Write the test**

`tests/unit/sample-slip.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { sampleSlip } from "@/lib/fixtures/sample-slip";

describe("sample slip fixture", () => {
  it("has the employer and employee", () => {
    expect(sampleSlip.firma).toContain("ALLPOWER");
    expect(sampleSlip.mitarbeiter.name).toBe("Mohammed El-Korazatti");
  });

  it("has brutto rows flagged into Gesamt-Brutto", () => {
    expect(sampleSlip.brutto.length).toBeGreaterThan(0);
    expect(sampleSlip.brutto.some((r) => r.gb === "J")).toBe(true);
  });

  it("has the auto-tax engine enabled", () => {
    expect(sampleSlip.automatik.enabled).toBe(true);
  });
});
```

- [ ] **Step 4: Run unit tests + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS — fixture tests green; TypeScript reports no errors (proves the fixture satisfies `SlipState`).

- [ ] **Step 5: Commit**

```bash
git add lib/slip-state.ts lib/fixtures/sample-slip.ts tests/unit/sample-slip.test.ts
git commit -m "feat: add SlipState contract and sample fixture"
```

---

### Task 4: `SlipFrame` component + `/demo` page (prove the iframe contract)

**Files:**
- Create: `components/SlipFrame.tsx`
- Create: `app/demo/page.tsx`
- Test: `tests/e2e/demo-slip.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

`tests/e2e/demo-slip.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test("demo page renders a slip and the engine computed Gesamt-Brutto", async ({
  page,
}) => {
  await page.goto("/demo");

  // The slip renders inside the template iframe.
  const frame = page.frameLocator("iframe[title='slip']");

  // #gesamtBruttoCell is filled by the template's own computeTotals().
  const cell = frame.locator("#gesamtBruttoCell");
  await expect(cell).toBeVisible();

  // German currency like "2.149,01" — proves the embedded engine ran.
  await expect(cell).toHaveText(/^\d{1,3}(\.\d{3})*,\d{2}$/);
});
```

- [ ] **Step 2: Run E2E to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `/demo` returns 404 (page not created yet), so the iframe is never found.

- [ ] **Step 3: Implement `SlipFrame`**

`components/SlipFrame.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import type { SlipState } from "@/lib/slip-state";

export function SlipFrame({
  templateFile,
  state,
}: {
  templateFile: string;
  state: SlipState;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  // Post the state whenever the frame is (re)loaded or the state changes.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const post = () => {
      iframe.contentWindow?.postMessage({ type: "setState", state }, "*");
    };
    iframe.addEventListener("load", post);
    // If it already loaded before this effect ran, post immediately.
    if (iframe.contentWindow) post();

    return () => iframe.removeEventListener("load", post);
  }, [state, templateFile]);

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

- [ ] **Step 4: Implement the `/demo` page**

`app/demo/page.tsx`:
```tsx
"use client";

import { SlipFrame } from "@/components/SlipFrame";
import { sampleSlip } from "@/lib/fixtures/sample-slip";
import { DEFAULT_TEMPLATE_ID, templateById } from "@/lib/template-manifest";

export default function DemoPage() {
  const template = templateById(DEFAULT_TEMPLATE_ID);
  return (
    <main className="min-h-screen overflow-auto p-6">
      <h1 className="mb-4 text-lg font-semibold text-neutral-200">
        Slip demo — {template.name}
      </h1>
      <SlipFrame templateFile={template.file} state={sampleSlip} />
    </main>
  );
}
```

- [ ] **Step 5: Run E2E to verify it passes**

Run: `npm run test:e2e`
Expected: PASS — the iframe renders, `#gesamtBruttoCell` is visible and shows a German-currency value computed by the template engine.

- [ ] **Step 6: Manual smoke (optional but recommended)**

Run: `npm run dev`, open `http://localhost:3000/demo`.
Expected: a DATEV slip for "Mohammed El-Korazatti / März 2026" renders on white paper; Steuer and SV rows are auto-filled by the engine; "Print / PDF" opens the print dialog for the slip only.

- [ ] **Step 7: Commit**

```bash
git add components/SlipFrame.tsx app/demo/page.tsx tests/e2e/demo-slip.spec.ts
git commit -m "feat: SlipFrame renders a slip from SlipState (iframe contract proven)"
```

---

## Self-Review

**1. Spec coverage (for the foundation slice):**
- "Next.js + Tailwind scaffold" → Task 1. ✓
- "templates moved to public/templates, reused as-is" → Task 2. ✓
- "per-template capability flags (supportsCumulative, supportsAutoTax); datev-highcopy single-month" → Task 2 (manifest + test). ✓
- "SlipFrame renders a template via iframe + postMessage" → Task 4. ✓
- "SlipState contract templates expect" → Task 3. ✓
- "prove the embedded calculation engine is intact" → Task 4 E2E asserts the engine-computed cell. ✓
- Deferred to later plans (correctly out of this slice): Supabase/auth/RLS (Plan 2), companies/employees CRUD + dashboard (Plan 3), wizard + payslips + `assembleState` (DB→SlipState) + capturing `computed_totals` + cumulative + serial counter + issue/print (Plan 4), dark UI polish (Plan 5).

**2. Placeholder scan:** No TBD/TODO. Every code step contains complete content. The fixture is real, valid data (a subset of the brutto rows is intentional and still valid — it exercises the engine). The E2E asserts a *format* (currency regex) rather than a hardcoded total, because the engine's exact output for this fixture isn't pre-verified here; an exact golden-value regression is added in a later plan once a verified golden fixture exists.

**3. Type consistency:** `SlipState` and its sub-types in Task 3 are referenced unchanged by `sampleSlip` (Task 3) and `SlipFrame`'s `state: SlipState` prop (Task 4). `TemplateMeta`/`templateById`/`DEFAULT_TEMPLATE_ID` defined in Task 2 are used in Task 4. The iframe title `"slip"` set in `SlipFrame` (Task 4 Step 3) matches the Playwright `frameLocator("iframe[title='slip']")` (Task 4 Step 1). The `postMessage` shape `{ type: "setState", state }` matches the contract used by `index.html:3065`.

**Open note for Plan 4:** reading `computed_totals` back from a rendered slip will need per-template cell selectors (e.g. datev-classic uses `#gesamtBruttoCell`, `#steuerTotal`, `#svTotal`, `#nettoVerdienstCell`, `#fAuszahlung`) or a small standardized post-back; that mechanism is designed and tested in Plan 4, not here.
