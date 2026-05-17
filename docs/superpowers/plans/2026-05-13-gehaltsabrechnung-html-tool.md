# Gehaltsabrechnung HTML Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained `gehaltsabrechnung.html` file the manager can open with a double-click, fill in a German Gehaltsabrechnung form, see a live DATEV-style preview, and print to PDF via the browser. Manager enters all values including tax/SV amounts; the tool only sums and computes the payout.

**Architecture:** One HTML file with inline CSS and inline vanilla JS. Two-panel screen layout (form left, slip preview right). `@media print` hides the form and shows a single A4 slip. Pure-logic helpers (parsing, formatting, sum reducers) live in a `<script>` block and are unit-tested via `node --test` against an extracted mirror in `tests/calc.mjs`. Layout fidelity is verified by manual visual comparison against the reference PDF `Gehaltsabrechnung 10_2023_260121_171407.pdf`.

**Tech Stack:** HTML5, CSS3 (CSS Grid, `@page`, `@media print`), vanilla ES2020+ JavaScript. No frameworks. No CDNs. Dev-time only: Node.js ≥ 20 for `node --test`.

**Reference:** `docs/superpowers/specs/2026-05-13-gehaltsabrechnung-html-tool-design.md` and `Gehaltsabrechnung 10_2023_260121_171407.pdf` (both in repo root).

**Note on TDD:** Strict TDD applies to the pure calculation/formatting helpers (Tasks 3-6). For the DOM/print layout work (Tasks 7-12), the equivalent discipline is **"visual verification against the reference PDF before committing"** — each layout task ends with an explicit checklist comparing the rendered slip section against the matching region of the reference PDF.

---

## File Structure

```
gehaltsabrechnung.html               # main deliverable — all inline
tests/calc.mjs                       # extracted pure helpers (mirror of inline script section)
tests/calc.test.mjs                  # node --test suite for calc.mjs
.gitignore                           # node_modules, .DS_Store, etc.
docs/superpowers/specs/2026-05-13-gehaltsabrechnung-html-tool-design.md   # exists
docs/superpowers/plans/2026-05-13-gehaltsabrechnung-html-tool.md          # this file
Gehaltsabrechnung 10_2023_260121_171407.pdf   # exists — reference
```

**Why the mirror file (`tests/calc.mjs`):** The deliverable is a single HTML file with no module imports — that is the manager's experience. But to run unit tests, Node needs to import the functions. We keep one source of truth (`tests/calc.mjs`) and **paste its contents** into the `<script>` block in `gehaltsabrechnung.html`. Task 15 includes a verification step that the inlined copy matches the module file byte-for-byte.

---

## Task 1: Initialize repo and create empty skeleton file

**Files:**

- Create: `gehaltsabrechnung.html` (skeleton)
- Create: `.gitignore`

- [ ] **Step 1: Initialize git**

Run:

```bash
git init
git config user.name "$(git config --global user.name || echo developer)"
git config user.email "$(git config --global user.email || echo dev@local)"
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.DS_Store
Thumbs.db
*.log
.idea/
.vscode/
```

- [ ] **Step 3: Create skeleton `gehaltsabrechnung.html`**

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gehaltsabrechnung</title>
    <style>
      /* CSS will be added in later tasks */
      body {
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="app">
      <section class="form-panel" aria-label="Eingabe"></section>
      <section class="slip" aria-label="Vorschau"></section>
    </div>
    <script></script>
  </body>
</html>
```

- [ ] **Step 4: Verify it opens**

Open the file in your default browser:

```bash
# Windows
start "" "gehaltsabrechnung.html"
# macOS
open gehaltsabrechnung.html
# Linux
xdg-open gehaltsabrechnung.html
```

Expected: blank page, no console errors. Title bar says "Gehaltsabrechnung".

- [ ] **Step 5: Commit**

```bash
git add .gitignore gehaltsabrechnung.html
git commit -m "chore: initialize repo with empty Gehaltsabrechnung skeleton"
```

---

## Task 2: Set up Node test harness

**Files:**

- Create: `tests/calc.mjs`
- Create: `tests/calc.test.mjs`

- [ ] **Step 1: Create the empty module**

`tests/calc.mjs`:

```js
// Pure helpers for the Gehaltsabrechnung tool.
// This file is the source of truth; its contents are inlined into
// gehaltsabrechnung.html's <script> block during Task 15.

// (functions added in later tasks)
export {};
```

- [ ] **Step 2: Create a sanity test**

`tests/calc.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("test harness works", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: Run the harness**

```bash
node --test tests/
```

Expected output contains: `# pass 1`, `# fail 0`.

- [ ] **Step 4: Commit**

```bash
git add tests/calc.mjs tests/calc.test.mjs
git commit -m "chore: add node --test harness for pure helpers"
```

---

## Task 3: German number parsing and formatting

**Files:**

- Modify: `tests/calc.mjs`
- Modify: `tests/calc.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `tests/calc.test.mjs`:

```js
import { parseDE, formatDE } from "./calc.mjs";

test('parseDE: "1.595,00" → 1595', () => {
  assert.equal(parseDE("1.595,00"), 1595);
});

test('parseDE: "20,00" → 20', () => {
  assert.equal(parseDE("20,00"), 20);
});

test('parseDE: "" → null', () => {
  assert.equal(parseDE(""), null);
});

test('parseDE: "  " → null', () => {
  assert.equal(parseDE("  "), null);
});

test('parseDE: "Z" → null (non-numeric marker)', () => {
  assert.equal(parseDE("Z"), null);
});

test('parseDE: "-12,34" → -12.34', () => {
  assert.equal(parseDE("-12,34"), -12.34);
});

test("parseDE: number passes through", () => {
  assert.equal(parseDE(42.5), 42.5);
});

test('formatDE: 1595 → "1.595,00"', () => {
  assert.equal(formatDE(1595), "1.595,00");
});

test('formatDE: 0 → "0,00"', () => {
  assert.equal(formatDE(0), "0,00");
});

test('formatDE: null → ""', () => {
  assert.equal(formatDE(null), "");
});

test('formatDE: -12.34 → "-12,34"', () => {
  assert.equal(formatDE(-12.34), "-12,34");
});

test('formatDE: rounding 2.705 → "2,71" (banker rounding NOT required)', () => {
  // We accept either 2,70 or 2,71 — document whichever Intl picks.
  const r = formatDE(2.705);
  assert.ok(r === "2,71" || r === "2,70", `unexpected: ${r}`);
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
node --test tests/
```

Expected: failures saying `parseDE is not a function` / `formatDE is not a function`.

- [ ] **Step 3: Implement**

Append to `tests/calc.mjs` (replace the placeholder `export {};` line):

```js
const _fmt = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseDE(input) {
  if (typeof input === "number") return input;
  if (input == null) return null;
  const s = String(input).trim();
  if (s === "") return null;
  // Accept "1.234,56", "1234,56", "1234.56", "-12,34".
  // Strip thousand separators (.), then convert decimal comma to dot.
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatDE(n) {
  if (n == null || !Number.isFinite(n)) return "";
  return _fmt.format(n);
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
node --test tests/
```

Expected: all tests pass (`# pass 13`, `# fail 0`).

- [ ] **Step 5: Commit**

```bash
git add tests/calc.mjs tests/calc.test.mjs
git commit -m "feat(calc): add German number parse/format helpers"
```

---

## Task 4: Brutto-Bezüge row math and sum

**Files:**

- Modify: `tests/calc.mjs`
- Modify: `tests/calc.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `tests/calc.test.mjs`:

```js
import { computeRowBetrag, sumBrutto } from "./calc.mjs";

test("computeRowBetrag: 79,75 × 20,00 = 1595", () => {
  assert.equal(computeRowBetrag({ menge: "79,75", faktor: "20,00" }), 1595);
});

test("computeRowBetrag: explicit betrag overrides product", () => {
  assert.equal(
    computeRowBetrag({ menge: "5", faktor: "10", betrag: "99,99" }),
    99.99,
  );
});

test("computeRowBetrag: missing menge → null", () => {
  assert.equal(computeRowBetrag({ menge: "", faktor: "20,00" }), null);
});

test("computeRowBetrag: missing both menge and betrag → null", () => {
  assert.equal(computeRowBetrag({ menge: "", faktor: "" }), null);
});

test("computeRowBetrag: pauschal-style (betrag only) returns the betrag", () => {
  assert.equal(
    computeRowBetrag({ einheit: "Pauschal", betrag: "500,00" }),
    500,
  );
});

test("sumBrutto: only GB=J rows are summed", () => {
  const rows = [
    { gb: "J", menge: "79,75", faktor: "20,00" },
    { gb: "J", menge: "8", faktor: "20,00" },
    { gb: "J", menge: "90,50", faktor: "20,00" },
    { gb: "N", menge: "100", faktor: "1,00" },
    { hinweis: true, text: "Nachberechnung 09/2023" },
  ];
  assert.equal(sumBrutto(rows), 3565);
});

test("sumBrutto: empty list → 0", () => {
  assert.equal(sumBrutto([]), 0);
});
```

- [ ] **Step 2: Run, verify fail**

```bash
node --test tests/
```

Expected: `computeRowBetrag is not a function`, `sumBrutto is not a function`.

- [ ] **Step 3: Implement**

Append to `tests/calc.mjs`:

```js
export function computeRowBetrag(row) {
  if (row.hinweis) return null;
  const explicit = parseDE(row.betrag);
  if (explicit != null) return explicit;
  const menge = parseDE(row.menge);
  const faktor = parseDE(row.faktor);
  if (menge == null || faktor == null) return null;
  return Math.round(menge * faktor * 100) / 100;
}

export function sumBrutto(rows) {
  let total = 0;
  for (const r of rows) {
    if (r.hinweis) continue;
    if ((r.gb || "").toUpperCase() !== "J") continue;
    const b = computeRowBetrag(r);
    if (b != null) total += b;
  }
  return Math.round(total * 100) / 100;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
node --test tests/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/calc.mjs tests/calc.test.mjs
git commit -m "feat(calc): compute Brutto row Betrag and Gesamt-Brutto sum"
```

---

## Task 5: Tax and SV deduction sums

**Files:**

- Modify: `tests/calc.mjs`
- Modify: `tests/calc.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `tests/calc.test.mjs`:

```js
import { sumSteuerAbzuege, sumSVAbzuege } from "./calc.mjs";

test("sumSteuerAbzuege: reference PDF L+N rows = 521", () => {
  const rows = [
    { tag: "L", lohnsteuer: "79,25", kirchensteuer: "", soli: "" },
    { tag: "N", lohnsteuer: "441,75", kirchensteuer: "", soli: "" },
  ];
  assert.equal(sumSteuerAbzuege(rows), 521);
});

test("sumSteuerAbzuege: includes all three columns", () => {
  const rows = [
    { tag: "L", lohnsteuer: "100,00", kirchensteuer: "8,00", soli: "5,50" },
  ];
  assert.equal(sumSteuerAbzuege(rows), 113.5);
});

test("sumSteuerAbzuege: blanks treated as 0", () => {
  const rows = [{ tag: "L", lohnsteuer: "", kirchensteuer: "", soli: "" }];
  assert.equal(sumSteuerAbzuege(rows), 0);
});

test("sumSVAbzuege: reference PDF L+N rows = 336,94", () => {
  const rows = [
    {
      tag: "L",
      kvBeitrag: "155,21",
      rvBeitrag: "",
      avBeitrag: "Z",
      pvBeitrag: "",
    },
    {
      tag: "N",
      kvBeitrag: "181,73",
      rvBeitrag: "",
      avBeitrag: "Z",
      pvBeitrag: "",
    },
  ];
  assert.equal(sumSVAbzuege(rows), 336.94);
});

test('sumSVAbzuege: ignores non-numeric markers like "Z"', () => {
  const rows = [
    {
      tag: "L",
      kvBeitrag: "100,00",
      rvBeitrag: "Z",
      avBeitrag: "50,00",
      pvBeitrag: "",
    },
  ];
  assert.equal(sumSVAbzuege(rows), 150);
});
```

- [ ] **Step 2: Run, verify fail**

```bash
node --test tests/
```

- [ ] **Step 3: Implement**

Append to `tests/calc.mjs`:

```js
function _sumFields(rows, fields) {
  let total = 0;
  for (const r of rows) {
    for (const f of fields) {
      const v = parseDE(r[f]);
      if (v != null) total += v;
    }
  }
  return Math.round(total * 100) / 100;
}

export function sumSteuerAbzuege(rows) {
  return _sumFields(rows, ["lohnsteuer", "kirchensteuer", "soli"]);
}

export function sumSVAbzuege(rows) {
  return _sumFields(rows, ["kvBeitrag", "rvBeitrag", "avBeitrag", "pvBeitrag"]);
}
```

- [ ] **Step 4: Run, verify pass**

```bash
node --test tests/
```

- [ ] **Step 5: Commit**

```bash
git add tests/calc.mjs tests/calc.test.mjs
git commit -m "feat(calc): sum Steuer and SV deductions ignoring non-numeric markers"
```

---

## Task 6: Netto-Verdienst and Auszahlungsbetrag pipeline

**Files:**

- Modify: `tests/calc.mjs`
- Modify: `tests/calc.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `tests/calc.test.mjs`:

```js
import { computeTotals } from "./calc.mjs";

test("computeTotals: matches reference PDF", () => {
  const state = {
    brutto: [
      { gb: "J", menge: "79,75", faktor: "20,00" },
      { gb: "J", menge: "8", faktor: "20,00" },
      { gb: "J", menge: "90,50", faktor: "20,00" },
    ],
    steuer: [
      { tag: "L", lohnsteuer: "79,25", kirchensteuer: "", soli: "" },
      { tag: "N", lohnsteuer: "441,75", kirchensteuer: "", soli: "" },
    ],
    sv: [
      {
        tag: "L",
        kvBeitrag: "155,21",
        rvBeitrag: "",
        avBeitrag: "Z",
        pvBeitrag: "",
      },
      {
        tag: "N",
        kvBeitrag: "181,73",
        rvBeitrag: "",
        avBeitrag: "Z",
        pvBeitrag: "",
      },
    ],
    nettoBezuege: [],
  };
  const t = computeTotals(state);
  assert.equal(t.gesamtBrutto, 3565);
  assert.equal(t.steuerAbzuege, 521);
  assert.equal(t.svAbzuege, 336.94);
  assert.equal(t.nettoVerdienst, 2707.06);
  assert.equal(t.auszahlungsbetrag, 2707.06);
});

test("computeTotals: netto rows shift the Auszahlungsbetrag", () => {
  const state = {
    brutto: [{ gb: "J", menge: "100", faktor: "1,00" }],
    steuer: [],
    sv: [],
    nettoBezuege: [{ betrag: "50,00" }, { betrag: "-10,00" }],
  };
  const t = computeTotals(state);
  assert.equal(t.gesamtBrutto, 100);
  assert.equal(t.nettoVerdienst, 100);
  assert.equal(t.auszahlungsbetrag, 140);
});
```

- [ ] **Step 2: Run, verify fail**

```bash
node --test tests/
```

- [ ] **Step 3: Implement**

Append to `tests/calc.mjs`:

```js
function _sumBetrag(rows) {
  let total = 0;
  for (const r of rows) {
    const v = parseDE(r.betrag);
    if (v != null) total += v;
  }
  return Math.round(total * 100) / 100;
}

export function computeTotals(state) {
  const gesamtBrutto = sumBrutto(state.brutto || []);
  const steuerAbzuege = sumSteuerAbzuege(state.steuer || []);
  const svAbzuege = sumSVAbzuege(state.sv || []);
  const nettoSaldo = _sumBetrag(state.nettoBezuege || []);
  const nettoVerdienst =
    Math.round((gesamtBrutto - steuerAbzuege - svAbzuege) * 100) / 100;
  const auszahlungsbetrag =
    Math.round((nettoVerdienst + nettoSaldo) * 100) / 100;
  return {
    gesamtBrutto,
    steuerAbzuege,
    svAbzuege,
    nettoVerdienst,
    auszahlungsbetrag,
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
node --test tests/
```

- [ ] **Step 5: Commit**

```bash
git add tests/calc.mjs tests/calc.test.mjs
git commit -m "feat(calc): computeTotals pipeline matches reference PDF"
```

---

## Task 7: Inline calc helpers into the HTML and wire a global `state`

**Files:**

- Modify: `gehaltsabrechnung.html`

- [ ] **Step 1: Copy the contents of `tests/calc.mjs` into the `<script>` block**

Open `tests/calc.mjs`, take everything **after** the leading comment block, and paste into `gehaltsabrechnung.html` inside the `<script>` tag. Drop the `export` keywords (we want plain functions on the script scope).

Result inside `<script>`:

```js
// ===== Inlined from tests/calc.mjs — keep in sync (Task 15 verifies) =====
const _fmt = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseDE(input) {
  if (typeof input === "number") return input;
  if (input == null) return null;
  const s = String(input).trim();
  if (s === "") return null;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatDE(n) {
  if (n == null || !Number.isFinite(n)) return "";
  return _fmt.format(n);
}

function computeRowBetrag(row) {
  if (row.hinweis) return null;
  const explicit = parseDE(row.betrag);
  if (explicit != null) return explicit;
  const menge = parseDE(row.menge);
  const faktor = parseDE(row.faktor);
  if (menge == null || faktor == null) return null;
  return Math.round(menge * faktor * 100) / 100;
}

function sumBrutto(rows) {
  let total = 0;
  for (const r of rows) {
    if (r.hinweis) continue;
    if ((r.gb || "").toUpperCase() !== "J") continue;
    const b = computeRowBetrag(r);
    if (b != null) total += b;
  }
  return Math.round(total * 100) / 100;
}

function _sumFields(rows, fields) {
  let total = 0;
  for (const r of rows) {
    for (const f of fields) {
      const v = parseDE(r[f]);
      if (v != null) total += v;
    }
  }
  return Math.round(total * 100) / 100;
}

function sumSteuerAbzuege(rows) {
  return _sumFields(rows, ["lohnsteuer", "kirchensteuer", "soli"]);
}

function sumSVAbzuege(rows) {
  return _sumFields(rows, ["kvBeitrag", "rvBeitrag", "avBeitrag", "pvBeitrag"]);
}

function _sumBetrag(rows) {
  let total = 0;
  for (const r of rows) {
    const v = parseDE(r.betrag);
    if (v != null) total += v;
  }
  return Math.round(total * 100) / 100;
}

function computeTotals(state) {
  const gesamtBrutto = sumBrutto(state.brutto || []);
  const steuerAbzuege = sumSteuerAbzuege(state.steuer || []);
  const svAbzuege = sumSVAbzuege(state.sv || []);
  const nettoSaldo = _sumBetrag(state.nettoBezuege || []);
  const nettoVerdienst =
    Math.round((gesamtBrutto - steuerAbzuege - svAbzuege) * 100) / 100;
  const auszahlungsbetrag =
    Math.round((nettoVerdienst + nettoSaldo) * 100) / 100;
  return {
    gesamtBrutto,
    steuerAbzuege,
    svAbzuege,
    nettoVerdienst,
    auszahlungsbetrag,
  };
}
// ===== End of inlined calc.mjs =====
```

- [ ] **Step 2: Add the default state and a render scaffold below the helpers**

```js
const state = {
  meta: {
    persNr: "00107",
    geburtsdatum: "021097",
    stKl: "1",
    faktor: "",
    kiFrbtr: "",
    konfession: "",
    freibetragJ: "",
    freibetragM: "",
    dba: "",
    midijob: "Ja",
    stTg: "30",
    vjUrlUeb: "",
    urlAnspr: "",
    urlTgGen: "",
    resturlaub: "",
    anwTage: "",
    urlaubTage: "",
    krankhTg: "",
    fehlzTage: "",
    anwStd: "",
    urlaubStd: "",
    krankhStd: "",
    fehlzStd: "",
    zeitlohnStd: "",
    ueberstd: "",
    bezStd: "",
    svNummer: "25021097A060",
    krankenkasse: "AOK Sachsen-Anhalt",
    kkProzent: "106 0100 2 30",
    pgrs: "",
    bgrs: "",
    umSvTg: "",
    eintritt: "290719",
    austritt: "",
    steuerId: "15270956832",
    mfb: "",
    rocCode: "R0C",
    mandant: "133267/30605/00107",
    druckdatum: "23.10.2023",
    blatt: "1",
    persNrBox: "00107",
    abtNr: "1",
    bn: "B/N",
    mandantBox: "30605",
  },
  firma:
    "ILS Integrated Lab Solutions GmbH*Barbara-McClintock-Straße 11*12489 Berlin",
  mitarbeiter: {
    name: "Yacoub Youssef Abu Naaj",
    strasse: "Joachimsthaler Str. 6",
    plzOrt: "13055 Berlin",
  },
  zeitraum: { monat: "Oktober", jahr: "2023" },
  brutto: [
    {
      lohnart: "1000",
      bezeichnung: "Stundenlohn",
      einheit: "Std",
      menge: "79,75",
      faktor: "20,00",
      prozent: "",
      st: "L",
      sv: "L",
      gb: "J",
    },
    {
      lohnart: "1012",
      bezeichnung: "Feiertagslohn",
      einheit: "Std",
      menge: "8",
      faktor: "20,00",
      prozent: "",
      st: "L",
      sv: "L",
      gb: "J",
    },
    {
      hinweis: true,
      text: "Nachberechnung 09/2023: - Midijob nicht angewandt -",
    },
    {
      lohnart: "1000",
      bezeichnung: "Stundenlohn",
      einheit: "Std",
      menge: "90,50",
      faktor: "20,00",
      prozent: "",
      st: "L",
      sv: "L",
      gb: "J",
    },
  ],
  steuer: [
    {
      tag: "L",
      steuerBrutto: "1.755,00",
      lohnsteuer: "79,25",
      kirchensteuer: "",
      soli: "",
    },
    {
      tag: "N",
      steuerBrutto: "1.810,00",
      lohnsteuer: "441,75",
      kirchensteuer: "",
      soli: "",
    },
  ],
  sv: [
    {
      tag: "L",
      kvBrutto: "1.668,92",
      rvBrutto: "",
      avBrutto: "",
      pvBrutto: "",
      kvBeitrag: "155,21",
      rvBeitrag: "",
      avBeitrag: "Z",
      pvBeitrag: "",
    },
    {
      tag: "N",
      kvBrutto: "1.854,34",
      rvBrutto: "",
      avBrutto: "",
      pvBrutto: "",
      kvBeitrag: "181,73",
      rvBeitrag: "",
      avBeitrag: "Z",
      pvBeitrag: "",
    },
  ],
  verdienst: {
    nachberechnungVorjahr: true,
    gesamtBrutto: "19.251,00",
    steuerBrutto: "19.251,00",
    lohnsteuer: "1.397,48",
    kirchensteuer: "",
    soli: "",
    steuerfreieBezuege: "",
    pVerstZukSich: "",
    pfaendungRest: "",
    darlehenRest: "",
    svBrutto: "18.843,26",
    kvBeitrag: "1.668,11",
    rvBeitrag: "",
    avBeitrag: "",
    pvBeitrag: "",
    vwlGesamt: "",
    kugAuszahlung: "",
  },
  nettoBezuege: [],
  bank: {
    name: "Deutsche Bank",
    iban: "DE97 1007 0124 0303 6XXX XX",
    svAgAnteil: "",
    zusAgKosten: "",
    gesamtkosten: "",
    code: "32946",
  },
  hinweiseZurAbrechnung: "",
};

function render() {
  // Wired up section by section in later tasks.
  console.log("totals →", computeTotals(state));
}

document.addEventListener("DOMContentLoaded", render);
```

- [ ] **Step 3: Open the file, check console**

Open `gehaltsabrechnung.html`. Open DevTools → Console.
Expected log line:

```
totals → { gesamtBrutto: 3565, steuerAbzuege: 521, svAbzuege: 336.94, nettoVerdienst: 2707.06, auszahlungsbetrag: 2707.06 }
```

- [ ] **Step 4: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat: inline calc helpers and seed default state from reference PDF"
```

---

## Task 8: Slip layout — Header metadata grid

**Files:**

- Modify: `gehaltsabrechnung.html`

This task targets the top of the slip: title bar, R0C/Mandant/Blatt block, and the five metadata rows. Open the reference PDF and the rendered slip side by side as you work.

- [ ] **Step 1: Add slip container CSS**

Inside the `<style>` block, replace the placeholder rules with:

```css
:root {
  --slip-fg: #111;
  --slip-rule: #888;
  --slip-rule-strong: #333;
  --slip-bg: #fff;
  --caption-size: 7pt;
  --value-size: 9.5pt;
  --mono: Consolas, "Liberation Mono", "Courier New", monospace;
  --sans: Arial, Helvetica, sans-serif;
}

* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
  background: #e6e8eb;
}
body {
  font-family: var(--sans);
  color: var(--slip-fg);
}

.app {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) 210mm;
  gap: 16px;
  padding: 16px;
}

.form-panel {
  background: #fff;
  padding: 16px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  max-height: calc(100vh - 32px);
  overflow: auto;
}

.slip {
  background: var(--slip-bg);
  width: 210mm;
  min-height: 297mm;
  padding: 10mm 10mm 8mm 10mm;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-size: var(--value-size);
  color: var(--slip-fg);
}

.slip .caption {
  font-size: var(--caption-size);
  color: #444;
}
.slip .num {
  font-family: var(--mono);
  text-align: right;
}

.slip .title-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 8mm;
  margin-bottom: 2mm;
}
.slip .title-row h1 {
  font-size: 11pt;
  margin: 0;
  font-weight: 700;
}
.slip .title-row .period {
  font-size: 10pt;
  margin-left: 4mm;
}
.slip .roc-block {
  font-family: var(--mono);
  font-size: 9pt;
  text-align: right;
  line-height: 1.2;
}
.slip .roc-block .roc-line {
  letter-spacing: 0.5px;
}
.slip .roc-block .date-line {
  margin-top: 1.5mm;
}

.slip .meta-grid {
  display: grid;
  border: 1px solid var(--slip-rule);
  border-collapse: collapse;
  font-size: var(--caption-size);
}
.slip .meta-grid .cell {
  border: 1px solid var(--slip-rule);
  padding: 0.6mm 1.2mm;
  min-height: 7mm;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.5mm;
}
.slip .meta-grid .cell .label {
  font-size: var(--caption-size);
  color: #333;
}
.slip .meta-grid .cell .value {
  font-family: var(--mono);
  font-size: var(--value-size);
}
.slip .meta-grid .row {
  display: grid;
  grid-template-columns: var(--cols, repeat(11, 1fr));
}
```

- [ ] **Step 2: Render the title row + R0C block + first metadata row**

Replace the `<section class="slip">…</section>` body with:

```html
<section class="slip" aria-label="Vorschau">
  <header class="title-row">
    <div>
      <h1>
        Abrechnung der Brutto/Netto-Bezüge<span
          class="period"
          id="periodLabel"
        ></span>
      </h1>
    </div>
    <div class="roc-block">
      <div class="roc-line">
        <span id="rocCode"></span>&nbsp;&nbsp;<span id="mandant"></span>
      </div>
      <div class="date-line">
        <span id="druckdatum"></span>&nbsp;&nbsp;Blatt&nbsp;<span
          id="blatt"
        ></span>
      </div>
    </div>
  </header>

  <div class="meta-grid" id="metaGrid">
    <!-- five rows injected by renderMeta() -->
  </div>

  <!-- remaining slip sections in later tasks -->
</section>
```

- [ ] **Step 3: Add `renderMeta()` and wire it from `render()`**

Inside `<script>`, replace the placeholder `render()` with:

```js
function renderMeta() {
  const m = state.meta;
  const z = state.zeitraum;
  document.getElementById("periodLabel").textContent =
    ` für ${z.monat} ${z.jahr}`;
  document.getElementById("rocCode").textContent = m.rocCode;
  document.getElementById("mandant").textContent = m.mandant;
  document.getElementById("druckdatum").textContent = m.druckdatum;
  document.getElementById("blatt").textContent = m.blatt;

  const grid = document.getElementById("metaGrid");
  grid.innerHTML = "";

  // Row 1: 11 left cells + 4 right cells (use two stacked rows for clarity)
  const rows = [
    {
      cols: "0.9fr 1.1fr 0.5fr 0.6fr 0.7fr 0.9fr 1fr 1fr 0.5fr 0.7fr 0.5fr",
      cells: [
        ["Personal-Nr.", m.persNr],
        ["Geburtsdatum", m.geburtsdatum],
        ["StKl", m.stKl],
        ["Faktor", m.faktor],
        ["Ki.Frbtr", m.kiFrbtr],
        ["Konfession", m.konfession],
        ["Freibetrag jährl.¹", m.freibetragJ],
        ["Freibetrag mtl.¹", m.freibetragM],
        ["DBA", m.dba],
        ["Midijob", m.midijob],
        ["St-Tg", m.stTg],
      ],
    },
    {
      cols: "1.4fr 2.4fr 0.6fr 0.6fr 0.6fr 0.6fr",
      cells: [
        ["SV-Nummer", m.svNummer],
        ["Krankenkasse", m.krankenkasse],
        ["KK % ⁸", m.kkProzent],
        ["PGRS", m.pgrs],
        ["BGRS", m.bgrs],
        ["Um.SV-Tg", m.umSvTg],
      ],
    },
    {
      cols: "0.7fr 0.7fr 4fr",
      cells: [
        ["Eintritt", m.eintritt],
        ["Austritt", m.austritt],
        ["", ""],
      ],
    },
    {
      cols: "1.4fr 0.6fr 4fr",
      cells: [
        ["Steuer-ID", m.steuerId],
        ["MFB⁷", m.mfb],
        ["", ""],
      ],
    },
  ];

  for (const r of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.style.setProperty("--cols", r.cols);
    for (const [label, value] of r.cells) {
      const c = document.createElement("div");
      c.className = "cell";
      c.innerHTML = `<span class="label">${label}</span><span class="value">${value ?? ""}</span>`;
      rowEl.appendChild(c);
    }
    grid.appendChild(rowEl);
  }
}

function render() {
  renderMeta();
}

document.addEventListener("DOMContentLoaded", render);
```

- [ ] **Step 4: Visual verification**

Open the file in Chrome/Edge. Compare top of rendered slip against the **top metadata grid** of `Gehaltsabrechnung 10_2023_260121_171407.pdf`. Check each item:

- [ ] Title "Abrechnung der Brutto/Netto-Bezüge" present, bold, ~11pt
- [ ] Period reads " für Oktober 2023"
- [ ] Top-right shows "R0C 133267/30605/00107" on first line, "23.10.2023 Blatt 1" on second
- [ ] First metadata row: Personal-Nr., Geburtsdatum, StKl, Faktor, Ki.Frbtr, Konfession, Freibetrag jährl.¹, Freibetrag mtl.¹, DBA, Midijob, St-Tg all visible with values "00107", "021097", "1", "", "", "", "", "", "", "Ja", "30"
- [ ] Second row shows SV-Nummer, Krankenkasse, KK %⁸, PGRS, BGRS, Um.SV-Tg
- [ ] Eintritt row shows "290719"; Steuer-ID row shows "15270956832"
- [ ] Border style: thin gray rules matching DATEV

Any mismatch → adjust CSS / cells until each box looks right. Don't proceed until it does.

- [ ] **Step 5: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat(slip): render top metadata grid matching DATEV layout"
```

---

## Task 9: Slip layout — Employer line, Pers./Abt. box, employee address, Hinweise

**Files:**

- Modify: `gehaltsabrechnung.html`

- [ ] **Step 1: Add CSS for this block**

Inside `<style>`:

```css
.slip .employer-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 4mm;
  margin: 3mm 0 2mm 0;
  font-size: 7pt;
  color: #222;
}
.slip .employer-row .pers-box {
  border: 1px solid var(--slip-rule);
  padding: 0.6mm 1.5mm;
  font-family: var(--mono);
  font-size: 7pt;
  line-height: 1.2;
  text-align: left;
}
.slip .employer-row .bn-box {
  border: 1px solid var(--slip-rule);
  padding: 0.6mm 1.5mm;
  font-family: var(--mono);
  font-size: 7pt;
  text-align: center;
  line-height: 1.2;
}

.slip .address-and-hinweise {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8mm;
  margin: 4mm 0 6mm 0;
}
.slip .address {
  font-family: var(--mono);
  font-size: 10pt;
  line-height: 1.35;
  white-space: pre-line;
}
.slip .hinweise {
  border-top: 1px solid var(--slip-rule);
  padding-top: 1.5mm;
}
.slip .hinweise .heading {
  font-size: 8pt;
  font-weight: 700;
  margin-bottom: 1mm;
}
.slip .hinweise .body {
  font-size: 8pt;
  white-space: pre-wrap;
  min-height: 12mm;
}
```

- [ ] **Step 2: Add the markup beneath `#metaGrid`**

In the `<section class="slip">` block, after `</div><!-- meta-grid -->` insert:

```html
<div class="employer-row">
  <div class="employer-line" id="employerLine"></div>
  <div class="pers-box" id="persBox"></div>
  <div class="bn-box" id="bnBox"></div>
</div>

<div class="address-and-hinweise">
  <address class="address" id="address"></address>
  <div class="hinweise">
    <div class="heading">Hinweise zur Abrechnung</div>
    <div class="body" id="hinweiseBody"></div>
  </div>
</div>
```

- [ ] **Step 3: Add `renderEmployerAndAddress()` and call it from `render()`**

Append inside `<script>`:

```js
function renderEmployerAndAddress() {
  document.getElementById("employerLine").textContent = state.firma;
  const m = state.meta;
  document.getElementById("persBox").innerHTML =
    `*Pers.-Nr. ${m.persNrBox}*<br>*Abt.-Nr. ${m.abtNr}*`;
  document.getElementById("bnBox").innerHTML =
    `${m.bn}<br>${m.rocCode}<br>${m.mandantBox}`;
  const a = state.mitarbeiter;
  document.getElementById("address").textContent =
    `${a.name}\n${a.strasse}\n${a.plzOrt}`;
  document.getElementById("hinweiseBody").textContent =
    state.hinweiseZurAbrechnung;
}
```

Update `render()`:

```js
function render() {
  renderMeta();
  renderEmployerAndAddress();
}
```

- [ ] **Step 4: Visual verification**

- [ ] Employer line shows `ILS Integrated Lab Solutions GmbH*Barbara-McClintock-Straße 11*12489 Berlin` with the `*` separators literal
- [ ] Small box on the right shows `*Pers.-Nr. 00107*` over `*Abt.-Nr. 1*`
- [ ] Next small box shows `B/N` / `R0C` / `30605`
- [ ] Address block shows three lines: name / street / PLZ Ort
- [ ] "Hinweise zur Abrechnung" heading appears in the right column, body empty

Adjust spacing/positioning until it matches the PDF.

- [ ] **Step 5: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat(slip): render employer line, Pers./Abt. box, address, Hinweise"
```

---

## Task 10: Slip layout — Brutto-Bezüge table + Gesamt-Brutto cell

**Files:**

- Modify: `gehaltsabrechnung.html`

- [ ] **Step 1: Add CSS**

```css
.slip .section-heading {
  font-size: 8pt;
  font-weight: 700;
  margin: 4mm 0 1mm 0;
}

.slip table.brutto {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--value-size);
}
.slip table.brutto th {
  font-weight: 400;
  font-size: var(--caption-size);
  text-align: left;
  border-bottom: 1px solid var(--slip-rule);
  padding: 0.5mm 1.2mm;
  color: #333;
}
.slip table.brutto td {
  padding: 0.4mm 1.2mm;
  vertical-align: top;
}
.slip table.brutto td.num {
  font-family: var(--mono);
  text-align: right;
}
.slip table.brutto tr.hinweis td {
  font-style: italic;
  color: #333;
  padding-left: 22mm;
}

.slip .brutto-footer {
  display: grid;
  grid-template-columns: 1fr auto;
  margin-top: 3mm;
}
.slip .brutto-footer .gesamt-cell {
  border: 1px solid var(--slip-rule-strong);
  padding: 1mm 2mm;
  min-width: 38mm;
  text-align: right;
}
.slip .brutto-footer .gesamt-cell .label {
  font-size: var(--caption-size);
  display: block;
  text-align: left;
}
.slip .brutto-footer .gesamt-cell .value {
  font-family: var(--mono);
  font-size: 10pt;
  font-weight: 700;
}
```

- [ ] **Step 2: Add markup beneath the address block**

```html
<div class="section-heading">Brutto-Bezüge</div>
<table class="brutto" id="bruttoTable">
  <thead>
    <tr>
      <th>Lohnart</th>
      <th>Bezeichnung</th>
      <th>Einheit²</th>
      <th class="num">Menge³</th>
      <th class="num">Faktor³</th>
      <th class="num">Prozentsatz</th>
      <th>St⁴</th>
      <th>SV⁴</th>
      <th>GB⁵</th>
      <th class="num">Betrag</th>
    </tr>
  </thead>
  <tbody id="bruttoBody"></tbody>
</table>

<div class="brutto-footer">
  <div></div>
  <div class="gesamt-cell">
    <span class="label">Gesamt-Brutto</span>
    <span class="value" id="gesamtBruttoCell">0,00</span>
  </div>
</div>
```

- [ ] **Step 3: Add `renderBrutto()` and call from `render()`**

```js
function renderBrutto() {
  const body = document.getElementById("bruttoBody");
  body.innerHTML = "";
  for (const r of state.brutto) {
    const tr = document.createElement("tr");
    if (r.hinweis) {
      tr.className = "hinweis";
      tr.innerHTML = `<td colspan="10">${r.text || ""}</td>`;
    } else {
      const betrag = computeRowBetrag(r);
      tr.innerHTML = `
        <td>${r.lohnart ?? ""}</td>
        <td>${r.bezeichnung ?? ""}</td>
        <td>${r.einheit ?? ""}</td>
        <td class="num">${r.menge ?? ""}</td>
        <td class="num">${r.faktor ?? ""}</td>
        <td class="num">${r.prozent ?? ""}</td>
        <td>${r.st ?? ""}</td>
        <td>${r.sv ?? ""}</td>
        <td>${r.gb ?? ""}</td>
        <td class="num">${formatDE(betrag)}</td>
      `;
    }
    body.appendChild(tr);
  }
  const totals = computeTotals(state);
  document.getElementById("gesamtBruttoCell").textContent = formatDE(
    totals.gesamtBrutto,
  );
}
```

Update `render()`:

```js
function render() {
  renderMeta();
  renderEmployerAndAddress();
  renderBrutto();
}
```

- [ ] **Step 4: Visual verification**

- [ ] Header row shows: Lohnart, Bezeichnung, Einheit², Menge³, Faktor³, Prozentsatz, St⁴, SV⁴, GB⁵, Betrag
- [ ] Three data rows present: `1000 Stundenlohn Std 79,75 20,00 … L L J 1.595,00`, `1012 Feiertagslohn Std 8 20,00 … L L J 160,00`, `1000 Stundenlohn Std 90,50 20,00 … L L J 1.810,00`
- [ ] Italic hinweis row between them: `Nachberechnung 09/2023: - Midijob nicht angewandt -`
- [ ] Gesamt-Brutto cell on the right shows `3.565,00`
- [ ] Numbers right-aligned and monospace

- [ ] **Step 5: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat(slip): render Brutto-Bezüge table with Gesamt-Brutto cell"
```

---

## Task 11: Slip layout — Steuer and SV blocks

**Files:**

- Modify: `gehaltsabrechnung.html`

- [ ] **Step 1: Add CSS**

```css
.slip .ssv-block {
  margin-top: 4mm;
}
.slip table.ssv {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--value-size);
}
.slip table.ssv th {
  font-weight: 400;
  font-size: var(--caption-size);
  text-align: left;
  border-bottom: 1px solid var(--slip-rule);
  padding: 0.5mm 1.2mm;
  color: #333;
}
.slip table.ssv td {
  padding: 0.4mm 1.2mm;
  vertical-align: top;
}
.slip table.ssv td.num {
  font-family: var(--mono);
  text-align: right;
}
.slip table.ssv td.tag {
  font-family: var(--mono);
  font-weight: 700;
}

.slip .ssv-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4mm;
  align-items: stretch;
}
.slip .ssv-total {
  border: 1px solid var(--slip-rule-strong);
  padding: 1mm 2mm;
  min-width: 38mm;
  text-align: right;
  align-self: end;
}
.slip .ssv-total .label {
  font-size: var(--caption-size);
  display: block;
  text-align: left;
}
.slip .ssv-total .value {
  font-family: var(--mono);
  font-size: 10pt;
  font-weight: 700;
}
```

- [ ] **Step 2: Markup**

After the brutto-footer div, append:

```html
<div class="ssv-block">
  <div class="ssv-row">
    <table class="ssv">
      <thead>
        <tr>
          <th>St⁴</th>
          <th class="num">Steuer-Brutto</th>
          <th class="num">Lohnsteuer</th>
          <th class="num">Kirchensteuer</th>
          <th class="num">Solidaritätszuschlag</th>
        </tr>
      </thead>
      <tbody id="steuerBody"></tbody>
    </table>
    <div class="ssv-total">
      <span class="label">Steuerrechtliche Abzüge</span>
      <span class="value" id="steuerTotal">0,00</span>
    </div>
  </div>

  <div class="ssv-row" style="margin-top: 3mm;">
    <table class="ssv">
      <thead>
        <tr>
          <th>SV⁴</th>
          <th class="num">KV-Brutto</th>
          <th class="num">RV-Brutto</th>
          <th class="num">AV-Brutto</th>
          <th class="num">PV-Brutto</th>
          <th class="num">KV-Beitrag</th>
          <th class="num">RV-Beitrag</th>
          <th class="num">AV-Beitrag</th>
          <th class="num">PV-Beitrag⁶</th>
        </tr>
      </thead>
      <tbody id="svBody"></tbody>
    </table>
    <div class="ssv-total">
      <span class="label">SV-rechtliche Abzüge</span>
      <span class="value" id="svTotal">0,00</span>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Renderer**

```js
function renderSteuerUndSV() {
  const sbody = document.getElementById("steuerBody");
  sbody.innerHTML = "";
  for (const r of state.steuer) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="tag">${r.tag}</td>
      <td class="num">${r.steuerBrutto ?? ""}</td>
      <td class="num">${r.lohnsteuer ?? ""}</td>
      <td class="num">${r.kirchensteuer ?? ""}</td>
      <td class="num">${r.soli ?? ""}</td>
    `;
    sbody.appendChild(tr);
  }
  const vbody = document.getElementById("svBody");
  vbody.innerHTML = "";
  for (const r of state.sv) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="tag">${r.tag}</td>
      <td class="num">${r.kvBrutto ?? ""}</td>
      <td class="num">${r.rvBrutto ?? ""}</td>
      <td class="num">${r.avBrutto ?? ""}</td>
      <td class="num">${r.pvBrutto ?? ""}</td>
      <td class="num">${r.kvBeitrag ?? ""}</td>
      <td class="num">${r.rvBeitrag ?? ""}</td>
      <td class="num">${r.avBeitrag ?? ""}</td>
      <td class="num">${r.pvBeitrag ?? ""}</td>
    `;
    vbody.appendChild(tr);
  }
  const t = computeTotals(state);
  document.getElementById("steuerTotal").textContent = formatDE(
    t.steuerAbzuege,
  );
  document.getElementById("svTotal").textContent = formatDE(t.svAbzuege);
}
```

Update `render()`:

```js
function render() {
  renderMeta();
  renderEmployerAndAddress();
  renderBrutto();
  renderSteuerUndSV();
}
```

- [ ] **Step 4: Visual verification**

- [ ] Steuer header: `St⁴ | Steuer-Brutto | Lohnsteuer | Kirchensteuer | Solidaritätszuschlag`
- [ ] Two rows: `L 1.755,00 79,25` and `N 1.810,00 441,75`
- [ ] Right cell: `Steuerrechtliche Abzüge` over `521,00`
- [ ] SV header has 9 columns ending with `PV-Beitrag⁶`
- [ ] Rows: `L 1.668,92 … 155,21 … Z …` and `N 1.854,34 … 181,73 … Z …`
- [ ] Right cell: `SV-rechtliche Abzüge` over `336,94`

- [ ] **Step 5: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat(slip): render Steuer and SV tables with deduction totals"
```

---

## Task 12: Slip layout — Verdienstbescheinigung + Netto-Bezüge + Netto-Verdienst

**Files:**

- Modify: `gehaltsabrechnung.html`

- [ ] **Step 1: Add CSS**

```css
.slip .verdienst-block {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 4mm;
  margin-top: 5mm;
}
.slip .verdienst {
  font-size: var(--value-size);
}
.slip .verdienst .heading {
  font-size: 8pt;
  font-weight: 700;
  margin-bottom: 1.5mm;
}
.slip .verdienst .heading .suffix {
  font-weight: 400;
  margin-left: 1.5mm;
}
.slip .verdienst .col-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2mm;
}
.slip .verdienst .kv {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2mm;
  padding: 0.3mm 0;
}
.slip .verdienst .kv .k {
  font-size: 7.5pt;
  color: #222;
}
.slip .verdienst .kv .v {
  font-family: var(--mono);
  font-size: var(--value-size);
}

.slip table.netto {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--value-size);
}
.slip table.netto th {
  font-weight: 400;
  font-size: var(--caption-size);
  text-align: left;
  border-bottom: 1px solid var(--slip-rule);
  padding: 0.5mm 1.2mm;
}
.slip table.netto td {
  padding: 0.4mm 1.2mm;
}
.slip table.netto td.num {
  font-family: var(--mono);
  text-align: right;
}

.slip .netto-total {
  border: 1px solid var(--slip-rule-strong);
  padding: 1mm 2mm;
  min-width: 38mm;
  text-align: right;
  align-self: end;
}
.slip .netto-total .label {
  font-size: var(--caption-size);
  display: block;
  text-align: left;
}
.slip .netto-total .value {
  font-family: var(--mono);
  font-size: 10pt;
  font-weight: 700;
}
```

- [ ] **Step 2: Markup**

```html
<div class="verdienst-block">
  <div class="verdienst">
    <div class="heading">
      Verdienstbescheinigung<span class="suffix" id="verdienstSuffix"></span>
    </div>
    <div class="col-pair">
      <div>
        <div class="kv">
          <span class="k">Gesamt-Brutto</span
          ><span class="v" id="vGesamtBrutto"></span>
        </div>
        <div class="kv">
          <span class="k">Steuer-Brutto</span
          ><span class="v" id="vSteuerBrutto"></span>
        </div>
        <div class="kv">
          <span class="k">Lohnsteuer</span
          ><span class="v" id="vLohnsteuer"></span>
        </div>
        <div class="kv">
          <span class="k">Kirchensteuer</span
          ><span class="v" id="vKirchensteuer"></span>
        </div>
        <div class="kv">
          <span class="k">Solidaritätszuschlag</span
          ><span class="v" id="vSoli"></span>
        </div>
        <div class="kv">
          <span class="k">Steuerfreie Bezüge</span
          ><span class="v" id="vSteuerfrei"></span>
        </div>
        <div class="kv">
          <span class="k">P. verst. Zuk.sich.</span
          ><span class="v" id="vPverstZukSich"></span>
        </div>
        <div class="kv">
          <span class="k">Pfändung Rest</span
          ><span class="v" id="vPfaendungRest"></span>
        </div>
        <div class="kv">
          <span class="k">Darlehen Rest</span
          ><span class="v" id="vDarlehenRest"></span>
        </div>
      </div>
      <div>
        <div class="kv">
          <span class="k">SV-Brutto</span><span class="v" id="vSvBrutto"></span>
        </div>
        <div class="kv">
          <span class="k">KV-Beitrag</span
          ><span class="v" id="vKvBeitrag"></span>
        </div>
        <div class="kv">
          <span class="k">RV-Beitrag</span
          ><span class="v" id="vRvBeitrag"></span>
        </div>
        <div class="kv">
          <span class="k">AV-Beitrag</span
          ><span class="v" id="vAvBeitrag"></span>
        </div>
        <div class="kv">
          <span class="k">PV-Beitrag</span
          ><span class="v" id="vPvBeitrag"></span>
        </div>
        <div class="kv">
          <span class="k">VWL gesamt</span><span class="v" id="vVwl"></span>
        </div>
        <div class="kv">
          <span class="k">Kug-Auszahlung</span><span class="v" id="vKug"></span>
        </div>
      </div>
    </div>
  </div>

  <div>
    <div class="heading">Netto-Bezüge/Netto-Abzüge</div>
    <table class="netto">
      <thead>
        <tr>
          <th>Lohnart</th>
          <th>Bezeichnung</th>
          <th class="num">Betrag</th>
        </tr>
      </thead>
      <tbody id="nettoBody"></tbody>
    </table>
  </div>

  <div class="netto-total">
    <span class="label">Netto-Verdienst</span>
    <span class="value" id="nettoVerdienstCell">0,00</span>
  </div>
</div>
```

- [ ] **Step 3: Renderer**

```js
function renderVerdienst() {
  const v = state.verdienst;
  document.getElementById("verdienstSuffix").textContent =
    v.nachberechnungVorjahr ? "mit Nachberechnung Vorjahr" : "";
  const map = {
    vGesamtBrutto: v.gesamtBrutto,
    vSteuerBrutto: v.steuerBrutto,
    vLohnsteuer: v.lohnsteuer,
    vKirchensteuer: v.kirchensteuer,
    vSoli: v.soli,
    vSteuerfrei: v.steuerfreieBezuege,
    vPverstZukSich: v.pVerstZukSich,
    vPfaendungRest: v.pfaendungRest,
    vDarlehenRest: v.darlehenRest,
    vSvBrutto: v.svBrutto,
    vKvBeitrag: v.kvBeitrag,
    vRvBeitrag: v.rvBeitrag,
    vAvBeitrag: v.avBeitrag,
    vPvBeitrag: v.pvBeitrag,
    vVwl: v.vwlGesamt,
    vKug: v.kugAuszahlung,
  };
  for (const [id, val] of Object.entries(map)) {
    document.getElementById(id).textContent = val ?? "";
  }

  const body = document.getElementById("nettoBody");
  body.innerHTML = "";
  for (const r of state.nettoBezuege) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.lohnart ?? ""}</td>
      <td>${r.bezeichnung ?? ""}</td>
      <td class="num">${formatDE(parseDE(r.betrag))}</td>
    `;
    body.appendChild(tr);
  }
  const t = computeTotals(state);
  document.getElementById("nettoVerdienstCell").textContent = formatDE(
    t.nettoVerdienst,
  );
}
```

Update `render()`:

```js
function render() {
  renderMeta();
  renderEmployerAndAddress();
  renderBrutto();
  renderSteuerUndSV();
  renderVerdienst();
}
```

- [ ] **Step 4: Visual verification**

- [ ] Heading reads `Verdienstbescheinigung mit Nachberechnung Vorjahr`
- [ ] Left column shows Gesamt-Brutto `19.251,00`, Steuer-Brutto `19.251,00`, Lohnsteuer `1.397,48`
- [ ] Right column shows SV-Brutto `18.843,26`, KV-Beitrag `1.668,11`
- [ ] Netto-Bezüge table renders (empty body in v1)
- [ ] Netto-Verdienst cell on the right shows `2.707,06`

- [ ] **Step 5: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat(slip): render Verdienstbescheinigung + Netto-Bezüge + Netto-Verdienst"
```

---

## Task 13: Slip layout — Footer (Bank, Auszahlungsbetrag, footnotes)

**Files:**

- Modify: `gehaltsabrechnung.html`

- [ ] **Step 1: Add CSS**

```css
.slip .footer-row {
  display: grid;
  grid-template-columns: 1.4fr 0.6fr 0.8fr 0.8fr 0.8fr auto;
  gap: 3mm;
  align-items: end;
  margin-top: 5mm;
  border-top: 1px solid var(--slip-rule);
  padding-top: 2mm;
}
.slip .footer-row .cell .label {
  font-size: var(--caption-size);
  display: block;
}
.slip .footer-row .cell .value {
  font-family: var(--mono);
  font-size: var(--value-size);
}
.slip .footer-row .auszahlung {
  border: 1px solid var(--slip-rule-strong);
  padding: 1mm 2mm;
  min-width: 40mm;
  text-align: right;
}
.slip .footer-row .auszahlung .label {
  font-size: var(--caption-size);
  display: block;
  text-align: left;
}
.slip .footer-row .auszahlung .value {
  font-family: var(--mono);
  font-size: 11pt;
  font-weight: 700;
}

.slip .footnotes {
  margin-top: 4mm;
  font-size: 6.5pt;
  line-height: 1.35;
  color: #333;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 2mm 6mm;
}
.slip .legal-line {
  margin-top: 2mm;
  font-size: 6.5pt;
  color: #333;
}
.slip .datev-spot {
  margin-top: 1mm;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2mm;
}
.slip .datev-spot .placeholder {
  width: 20mm;
  height: 10mm;
  border: 1px dashed #bbb;
}
```

- [ ] **Step 2: Markup**

```html
<div class="footer-row">
  <div class="cell">
    <span class="label">Bank</span>
    <span class="value" id="fBank"></span>
    <div style="margin-top: 1mm;">
      <span class="label">Konto</span>
      <span class="value" id="fIban"></span>
    </div>
  </div>
  <div class="cell">
    <span class="label">&nbsp;</span>
    <span class="value" id="fCode"></span>
  </div>
  <div class="cell">
    <span class="label">SV-AG-Anteil</span>
    <span class="value" id="fSvAg"></span>
  </div>
  <div class="cell">
    <span class="label">Zus. AG-Kosten</span>
    <span class="value" id="fZusAg"></span>
  </div>
  <div class="cell">
    <span class="label">Gesamtkosten</span>
    <span class="value" id="fGesamt"></span>
  </div>
  <div class="auszahlung">
    <span class="label">Auszahlungsbetrag</span>
    <span class="value" id="fAuszahlung">0,00</span>
  </div>
</div>

<div class="footnotes">
  <div>¹ H = Hinzurechnungsbetrag</div>
  <div>
    ² Std = Stunden, T = Tage, Km = Kilometer, St = Stück; EUR = Euro, Tsd =
    Tausend Euro, Mio = Million Euro
  </div>
  <div>³ Gegebenenfalls Netto-Lohn/Netto-Stundenlohn</div>
  <div>
    ⁴ L = Laufender Bezug, S = Sonstiger Bezug, F = Frei, E = Einmalbezug, P =
    Pauschalierung, A = Abfindung, M = mehrjährige Versteuerung, N =
    Nachberechnung, V = Vorjahr, W = Entgeltguthaben
  </div>
  <div>⁵ J = Bestandteil des Gesamt-Brutto</div>
  <div>⁶ Z = Einschl. Beitragszuschlag zur PV für Kinderlose</div>
  <div>⁷ MFB = Mehrfachbeschäftigung</div>
  <div>⁸ Maßgeblicher Beitragssatz zur KV inkl. Zusatzbeitrag</div>
</div>

<div class="legal-line">
  - Dies ist eine Entgeltbescheinigung nach § 108 Abs. 3 Satz 1 der
  Gewerbeordnung -
</div>

<div class="datev-spot">
  <div style="font-size: 6.5pt; color: #444;">AFP Form.-Nr. LNGN14</div>
  <div class="placeholder" aria-label="Logo-Platzhalter"></div>
</div>
```

- [ ] **Step 3: Renderer**

```js
function renderFooter() {
  const b = state.bank;
  document.getElementById("fBank").textContent = b.name;
  document.getElementById("fIban").textContent = b.iban;
  document.getElementById("fCode").textContent = b.code;
  document.getElementById("fSvAg").textContent = b.svAgAnteil;
  document.getElementById("fZusAg").textContent = b.zusAgKosten;
  document.getElementById("fGesamt").textContent = b.gesamtkosten;
  const t = computeTotals(state);
  document.getElementById("fAuszahlung").textContent = formatDE(
    t.auszahlungsbetrag,
  );
}
```

Update `render()`:

```js
function render() {
  renderMeta();
  renderEmployerAndAddress();
  renderBrutto();
  renderSteuerUndSV();
  renderVerdienst();
  renderFooter();
}
```

- [ ] **Step 4: Visual verification**

- [ ] Bank `Deutsche Bank` / Konto IBAN `DE97 1007 0124 0303 6XXX XX`
- [ ] Code `32946` visible
- [ ] SV-AG-Anteil, Zus. AG-Kosten, Gesamtkosten labels render (blank values OK)
- [ ] Auszahlungsbetrag cell on the right shows `2.707,06`, bold
- [ ] Eight footnote lines (¹ – ⁸) present
- [ ] Legal line `- Dies ist eine Entgeltbescheinigung …` present
- [ ] Bottom right shows a dashed-outline placeholder rectangle (logo spot) and `AFP Form.-Nr. LNGN14`

- [ ] **Step 5: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat(slip): render footer with Auszahlungsbetrag, footnotes, legal line"
```

---

## Task 14: Form panel — inputs bound to state with live update

**Files:**

- Modify: `gehaltsabrechnung.html`

This is the largest task by line count. It's still bite-sized in pattern: every input wires to the same `bind()` helper, then triggers `render()`.

- [ ] **Step 1: Add form CSS**

```css
.form-panel h2 {
  font-size: 14px;
  margin: 12px 0 6px 0;
  border-bottom: 1px solid #ddd;
  padding-bottom: 4px;
}
.form-panel .grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 10px;
  margin-bottom: 10px;
}
.form-panel label {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: #333;
}
.form-panel input,
.form-panel select,
.form-panel textarea {
  font: inherit;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
}
.form-panel textarea {
  min-height: 50px;
  resize: vertical;
}
.form-panel .toolbar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.form-panel button {
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  background: #2a6df4;
  color: #fff;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}
.form-panel button.secondary {
  background: #6c757d;
}
.form-panel button.danger {
  background: #c82333;
}
.form-panel .row-editor {
  display: grid;
  grid-template-columns: repeat(10, 1fr) auto;
  gap: 4px;
  margin-bottom: 4px;
  align-items: end;
}
.form-panel .row-editor input {
  font-size: 11px;
  padding: 3px 5px;
}
.form-panel .hint-editor {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px;
  margin-bottom: 4px;
}
```

- [ ] **Step 2: Inject the form skeleton**

Replace the empty `<section class="form-panel">…</section>` with:

```html
<section class="form-panel" aria-label="Eingabe">
  <div class="toolbar">
    <button id="btnPrint">Drucken / PDF</button>
    <button class="secondary" id="btnSave">Speichern als JSON</button>
    <button class="secondary" id="btnLoad">Laden aus JSON</button>
    <input type="file" id="loadFile" accept="application/json" hidden />
  </div>

  <h2>Abrechnungs-Zeitraum</h2>
  <div class="grid">
    <label>Monat<input data-bind="zeitraum.monat" /></label>
    <label>Jahr<input data-bind="zeitraum.jahr" /></label>
    <label>Druckdatum<input data-bind="meta.druckdatum" /></label>
    <label>Blatt<input data-bind="meta.blatt" /></label>
  </div>

  <h2>Kopfdaten</h2>
  <div class="grid">
    <label>Personal-Nr.<input data-bind="meta.persNr" /></label>
    <label>Geburtsdatum<input data-bind="meta.geburtsdatum" /></label>
    <label>StKl<input data-bind="meta.stKl" /></label>
    <label>Faktor<input data-bind="meta.faktor" /></label>
    <label>Ki.Frbtr<input data-bind="meta.kiFrbtr" /></label>
    <label>Konfession<input data-bind="meta.konfession" /></label>
    <label>Freibetrag jährl.<input data-bind="meta.freibetragJ" /></label>
    <label>Freibetrag mtl.<input data-bind="meta.freibetragM" /></label>
    <label>DBA<input data-bind="meta.dba" /></label>
    <label>Midijob<input data-bind="meta.midijob" /></label>
    <label>St-Tg<input data-bind="meta.stTg" /></label>
    <label>SV-Nummer<input data-bind="meta.svNummer" /></label>
    <label>Krankenkasse<input data-bind="meta.krankenkasse" /></label>
    <label>KK %<input data-bind="meta.kkProzent" /></label>
    <label>PGRS<input data-bind="meta.pgrs" /></label>
    <label>BGRS<input data-bind="meta.bgrs" /></label>
    <label>Um.SV-Tg<input data-bind="meta.umSvTg" /></label>
    <label>Eintritt<input data-bind="meta.eintritt" /></label>
    <label>Austritt<input data-bind="meta.austritt" /></label>
    <label>Steuer-ID<input data-bind="meta.steuerId" /></label>
    <label>MFB<input data-bind="meta.mfb" /></label>
    <label>Mandant-Code (oben)<input data-bind="meta.mandant" /></label>
    <label>R0C-Code<input data-bind="meta.rocCode" /></label>
    <label>Pers.-Nr. (Box)<input data-bind="meta.persNrBox" /></label>
    <label>Abt.-Nr.<input data-bind="meta.abtNr" /></label>
    <label>Mandant-Code (Box)<input data-bind="meta.mandantBox" /></label>
    <label>B/N<input data-bind="meta.bn" /></label>
  </div>

  <h2>Firma</h2>
  <label
    >Eine Zeile, mit * als Trenner<textarea data-bind="firma"></textarea>
  </label>

  <h2>Mitarbeiter</h2>
  <div class="grid">
    <label>Name<input data-bind="mitarbeiter.name" /></label>
    <label>Straße<input data-bind="mitarbeiter.strasse" /></label>
    <label>PLZ + Ort<input data-bind="mitarbeiter.plzOrt" /></label>
  </div>

  <h2>Hinweise zur Abrechnung</h2>
  <textarea data-bind="hinweiseZurAbrechnung"></textarea>

  <h2>Brutto-Bezüge</h2>
  <div id="bruttoEditor"></div>
  <div class="toolbar">
    <button id="btnAddBrutto">+ Zeile hinzufügen</button>
    <button class="secondary" id="btnAddHinweis">+ Hinweis hinzufügen</button>
  </div>

  <h2>Steuer (manuelle Eingabe)</h2>
  <div id="steuerEditor"></div>

  <h2>Sozialversicherung (manuelle Eingabe)</h2>
  <div id="svEditor"></div>

  <h2>Verdienstbescheinigung (Jahres-Werte)</h2>
  <div class="grid">
    <label
      ><input
        type="checkbox"
        data-bind-check="verdienst.nachberechnungVorjahr"
      />
      mit Nachberechnung Vorjahr</label
    >
    <span></span>
    <label>Gesamt-Brutto<input data-bind="verdienst.gesamtBrutto" /></label>
    <label>SV-Brutto<input data-bind="verdienst.svBrutto" /></label>
    <label>Steuer-Brutto<input data-bind="verdienst.steuerBrutto" /></label>
    <label>KV-Beitrag<input data-bind="verdienst.kvBeitrag" /></label>
    <label>Lohnsteuer<input data-bind="verdienst.lohnsteuer" /></label>
    <label>RV-Beitrag<input data-bind="verdienst.rvBeitrag" /></label>
    <label>Kirchensteuer<input data-bind="verdienst.kirchensteuer" /></label>
    <label>AV-Beitrag<input data-bind="verdienst.avBeitrag" /></label>
    <label>Solidaritätszuschlag<input data-bind="verdienst.soli" /></label>
    <label>PV-Beitrag<input data-bind="verdienst.pvBeitrag" /></label>
    <label
      >Steuerfreie Bezüge<input data-bind="verdienst.steuerfreieBezuege"
    /></label>
    <label>VWL gesamt<input data-bind="verdienst.vwlGesamt" /></label>
    <label
      >P. verst. Zuk.sich.<input data-bind="verdienst.pVerstZukSich"
    /></label>
    <label>Kug-Auszahlung<input data-bind="verdienst.kugAuszahlung" /></label>
    <label>Pfändung Rest<input data-bind="verdienst.pfaendungRest" /></label>
    <label>Darlehen Rest<input data-bind="verdienst.darlehenRest" /></label>
  </div>

  <h2>Netto-Bezüge / Netto-Abzüge</h2>
  <div id="nettoEditor"></div>
  <div class="toolbar">
    <button id="btnAddNetto">+ Zeile hinzufügen</button>
  </div>

  <h2>Bank / Auszahlung</h2>
  <div class="grid">
    <label>Bank<input data-bind="bank.name" /></label>
    <label>IBAN / Konto<input data-bind="bank.iban" /></label>
    <label>Code (kleines Feld)<input data-bind="bank.code" /></label>
    <label>SV-AG-Anteil<input data-bind="bank.svAgAnteil" /></label>
    <label>Zus. AG-Kosten<input data-bind="bank.zusAgKosten" /></label>
    <label>Gesamtkosten<input data-bind="bank.gesamtkosten" /></label>
  </div>
</section>
```

- [ ] **Step 3: Add binding helpers and editors**

Append in `<script>`:

```js
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

function bindInputs() {
  for (const el of document.querySelectorAll("[data-bind]")) {
    const path = el.dataset.bind;
    el.value = getPath(state, path) ?? "";
    el.addEventListener("input", () => {
      setPath(state, path, el.value);
      render();
    });
  }
  for (const el of document.querySelectorAll("[data-bind-check]")) {
    const path = el.dataset.bindCheck;
    el.checked = !!getPath(state, path);
    el.addEventListener("change", () => {
      setPath(state, path, el.checked);
      render();
    });
  }
}

function renderBruttoEditor() {
  const root = document.getElementById("bruttoEditor");
  root.innerHTML = "";
  state.brutto.forEach((r, i) => {
    const wrap = document.createElement("div");
    if (r.hinweis) {
      wrap.className = "hint-editor";
      wrap.innerHTML = `
        <input value="${r.text ?? ""}" placeholder="Hinweis-Text">
        <button class="danger" data-action="del" data-i="${i}">×</button>
      `;
      wrap.querySelector("input").addEventListener("input", (e) => {
        r.text = e.target.value;
        render();
      });
    } else {
      wrap.className = "row-editor";
      const fields = [
        "lohnart",
        "bezeichnung",
        "einheit",
        "menge",
        "faktor",
        "prozent",
        "st",
        "sv",
        "gb",
      ];
      const placeholders = [
        "Lohnart",
        "Bezeichnung",
        "Einheit",
        "Menge",
        "Faktor",
        "%",
        "St",
        "SV",
        "GB",
      ];
      let html = "";
      fields.forEach((f, idx) => {
        html += `<input value="${r[f] ?? ""}" placeholder="${placeholders[idx]}" data-f="${f}">`;
      });
      html += `<input value="${formatDE(computeRowBetrag(r))}" placeholder="Betrag" data-f="betrag">`;
      html += `<button class="danger" data-action="del" data-i="${i}">×</button>`;
      wrap.innerHTML = html;
      wrap.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("input", (e) => {
          r[e.target.dataset.f] = e.target.value;
          render();
        });
      });
    }
    wrap.querySelector('[data-action="del"]').addEventListener("click", () => {
      state.brutto.splice(i, 1);
      render();
    });
    root.appendChild(wrap);
  });
}

function renderRowsEditor(rootId, list, fields, placeholders) {
  const root = document.getElementById(rootId);
  root.innerHTML = "";
  list.forEach((r, i) => {
    const wrap = document.createElement("div");
    wrap.className = "row-editor";
    let html = "";
    fields.forEach((f, idx) => {
      html += `<input value="${r[f] ?? ""}" placeholder="${placeholders[idx]}" data-f="${f}">`;
    });
    html += `<button class="danger" data-action="del" data-i="${i}">×</button>`;
    wrap.innerHTML = html;
    wrap.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        r[e.target.dataset.f] = e.target.value;
        render();
      });
    });
    wrap.querySelector('[data-action="del"]').addEventListener("click", () => {
      list.splice(i, 1);
      render();
    });
    root.appendChild(wrap);
  });
}

function renderEditors() {
  renderBruttoEditor();
  renderRowsEditor(
    "steuerEditor",
    state.steuer,
    ["tag", "steuerBrutto", "lohnsteuer", "kirchensteuer", "soli"],
    ["Tag (L/N)", "Steuer-Brutto", "Lohnsteuer", "Kirchensteuer", "Soli"],
  );
  renderRowsEditor(
    "svEditor",
    state.sv,
    [
      "tag",
      "kvBrutto",
      "rvBrutto",
      "avBrutto",
      "pvBrutto",
      "kvBeitrag",
      "rvBeitrag",
      "avBeitrag",
      "pvBeitrag",
    ],
    [
      "Tag",
      "KV-Bru",
      "RV-Bru",
      "AV-Bru",
      "PV-Bru",
      "KV-Bei",
      "RV-Bei",
      "AV-Bei",
      "PV-Bei",
    ],
  );
  renderRowsEditor(
    "nettoEditor",
    state.nettoBezuege,
    ["lohnart", "bezeichnung", "betrag"],
    ["Lohnart", "Bezeichnung", "Betrag"],
  );
}
```

- [ ] **Step 4: Wire toolbar buttons and update `render()`**

```js
function wireToolbar() {
  document.getElementById("btnAddBrutto").addEventListener("click", () => {
    state.brutto.push({
      lohnart: "",
      bezeichnung: "",
      einheit: "Std",
      menge: "",
      faktor: "",
      prozent: "",
      st: "L",
      sv: "L",
      gb: "J",
    });
    render();
  });
  document.getElementById("btnAddHinweis").addEventListener("click", () => {
    state.brutto.push({ hinweis: true, text: "" });
    render();
  });
  document.getElementById("btnAddNetto").addEventListener("click", () => {
    state.nettoBezuege.push({ lohnart: "", bezeichnung: "", betrag: "" });
    render();
  });
  document
    .getElementById("btnPrint")
    .addEventListener("click", () => window.print());
  document.getElementById("btnSave").addEventListener("click", saveJson);
  document
    .getElementById("btnLoad")
    .addEventListener("click", () =>
      document.getElementById("loadFile").click(),
    );
  document.getElementById("loadFile").addEventListener("change", loadJson);
}

function saveJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gehaltsabrechnung-${state.zeitraum.jahr}-${state.zeitraum.monat}-${state.meta.persNr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, data);
  // Rebuild inputs to reflect new state
  bindInputs();
  render();
  e.target.value = "";
}

function render() {
  renderMeta();
  renderEmployerAndAddress();
  renderBrutto();
  renderSteuerUndSV();
  renderVerdienst();
  renderFooter();
  renderEditors();
}

document.addEventListener("DOMContentLoaded", () => {
  bindInputs();
  wireToolbar();
  render();
});
```

(Remove the older `document.addEventListener('DOMContentLoaded', render);` line.)

- [ ] **Step 5: Verification**

Open the file. Try each:

- [ ] Type a new name in `Mitarbeiter → Name` → slip address updates live
- [ ] Change `Menge` of the first Brutto row to `10` → Betrag column updates, Gesamt-Brutto updates
- [ ] Click `+ Zeile hinzufügen` → new row appears in both editor and slip
- [ ] Click `×` on a row → row removed from both
- [ ] Click `+ Hinweis hinzufügen`, type a note → italic line appears
- [ ] Click `Speichern als JSON` → file downloads
- [ ] Click `Laden aus JSON` → pick the saved file → state restored

- [ ] **Step 6: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat: form panel with live two-way binding, dynamic rows, JSON save/load"
```

---

## Task 15: Print stylesheet + inline-mirror verification

**Files:**

- Modify: `gehaltsabrechnung.html`

- [ ] **Step 1: Add print rules**

Append to `<style>`:

```css
@page {
  size: A4 portrait;
  margin: 10mm;
}

@media print {
  html,
  body {
    background: #fff;
  }
  .app {
    display: block;
    padding: 0;
    gap: 0;
  }
  .form-panel {
    display: none !important;
  }
  .slip {
    width: auto;
    min-height: auto;
    box-shadow: none;
    padding: 0;
  }
  /* Avoid splitting the slip across pages if it fits on one */
  .slip,
  .slip .meta-grid,
  .slip table.brutto,
  .slip table.ssv,
  .slip .verdienst-block,
  .slip .footer-row,
  .slip .footnotes {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
```

- [ ] **Step 2: Verify the print preview**

Open the file, press `Ctrl+P` (or `Cmd+P`).

- [ ] The form panel is gone from the preview
- [ ] The slip fills one A4 page
- [ ] Compare side-by-side with the reference PDF — title, metadata grid, employer line, address, Brutto table, Steuer/SV tables, Verdienstbescheinigung, footer, footnotes are all positioned similarly
- [ ] Save the preview as PDF → re-open it → looks like a DATEV slip

- [ ] **Step 3: Verify the inlined calc mirrors `tests/calc.mjs`**

Run a content comparison (you should be able to map each exported function from `tests/calc.mjs` to its equivalent inlined plain function in `gehaltsabrechnung.html`). Read both:

```bash
# Compare manually — the inline copy has `export` stripped and otherwise
# identical bodies.
```

Walk both files and confirm `parseDE`, `formatDE`, `computeRowBetrag`, `sumBrutto`, `_sumFields`, `sumSteuerAbzuege`, `sumSVAbzuege`, `_sumBetrag`, `computeTotals` have identical bodies.

If anything drifted, copy the canonical version from `tests/calc.mjs` into the inline `<script>`, strip the `export` keywords, then re-run `node --test tests/` to confirm tests still pass.

- [ ] **Step 4: Commit**

```bash
git add gehaltsabrechnung.html
git commit -m "feat: print stylesheet for single A4 page output"
```

---

## Task 16: End-to-end verification against the reference PDF

**Files:**

- (verification only — no code changes unless issues found)

- [ ] **Step 1: Reset state to the reference seed**

Hard-reload the file (Ctrl+Shift+R). The default `state` matches the reference PDF.

- [ ] **Step 2: Read computed totals from the screen**

Confirm:

- [ ] Gesamt-Brutto cell: `3.565,00`
- [ ] Steuerrechtliche Abzüge cell: `521,00`
- [ ] SV-rechtliche Abzüge cell: `336,94`
- [ ] Netto-Verdienst cell: `2.707,06`
- [ ] Auszahlungsbetrag cell: `2.707,06`

If any number is off, return to Task 7's render functions and Task 4–6 calcs; tests cover all five totals so a mismatch means an inlining bug.

- [ ] **Step 3: Print to PDF and overlay-check against reference**

Print → Save as PDF. Open both the new PDF and `Gehaltsabrechnung 10_2023_260121_171407.pdf` in two windows.

Tick the following one by one — if any item fails, file an inline fix:

- [ ] Title `Abrechnung der Brutto/Netto-Bezüge  für Oktober 2023` in the same place
- [ ] R0C / Mandant / date / Blatt on the top-right
- [ ] All metadata-grid cells with the correct labels (Personal-Nr., Geburtsdatum, StKl, etc.)
- [ ] Employer line with the asterisks intact
- [ ] Pers.-Nr. and Abt.-Nr. boxes next to the employer line
- [ ] Address block in the left half below the metadata grid
- [ ] "Hinweise zur Abrechnung" heading on the right
- [ ] Brutto-Bezüge table — three rows + italic hinweis row, all amounts right-aligned monospace
- [ ] Gesamt-Brutto box on the right of the Brutto table
- [ ] Steuer block: header row + L/N rows + Steuerrechtliche Abzüge box
- [ ] SV block: 9-column header + L/N rows + SV-rechtliche Abzüge box
- [ ] Verdienstbescheinigung heading with `mit Nachberechnung Vorjahr` suffix
- [ ] Verdienstbescheinigung values in two sub-columns
- [ ] Netto-Bezüge/Netto-Abzüge table on the right
- [ ] Netto-Verdienst box on the far right
- [ ] Footer with Bank, Konto, code, SV-AG-Anteil/Zus. AG-Kosten/Gesamtkosten, Auszahlungsbetrag
- [ ] 8 numbered footnote lines
- [ ] Legal line about § 108 GewO
- [ ] AFP Form.-Nr. LNGN14 + dashed logo placeholder bottom-right
- [ ] One page total

- [ ] **Step 4: Fix anything that didn't match (likely small CSS tweaks)**

Iterate on CSS until the visual comparison passes. Re-run `node --test tests/` if you touched any calc code.

- [ ] **Step 5: Final commit**

```bash
git add gehaltsabrechnung.html
git commit -m "fix(slip): final layout polish to match DATEV reference"
```

- [ ] **Step 6: Tag**

```bash
git tag -a v1.0 -m "v1.0 — Gehaltsabrechnung HTML tool, reference parity"
```

---

## Out-of-scope reminders

- No tax engine. The manager enters L/N tax/SV values. Confirmed in spec.
- No multi-page slips. If the Brutto-Bezüge list ever overflows, v2 work.
- No employee database. JSON save/load is the lightweight "memory".
- DATEV logo intentionally left as a neutral placeholder.

## Self-review notes (author)

- Every spec section maps to a task:
  - Architecture & file structure → Tasks 1, 2, 15
  - Form sections (Kopfdaten/Firma/Mitarbeiter/Zeitraum/Brutto/Steuer/SV/Verdienst/Netto/Bank) → Task 14
  - Auto-calculations → Tasks 3-6 (tested) + Tasks 10-13 (rendered)
  - Layout / pixel fidelity → Tasks 8-13 each with a visual checklist
  - State persistence → Task 14 (Save/Load JSON)
  - Validation → Task 3 (parseDE normalizes), Task 14 (free-text inputs accept any text; the parser ignores non-numeric)
  - Print stylesheet → Task 15
  - Acceptance criteria → Task 16
- Function names used across tasks: `parseDE`, `formatDE`, `computeRowBetrag`, `sumBrutto`, `sumSteuerAbzuege`, `sumSVAbzuege`, `computeTotals` — defined in Task 3-6, used consistently in Tasks 10-13.
- Renderer names consistent: `renderMeta`, `renderEmployerAndAddress`, `renderBrutto`, `renderSteuerUndSV`, `renderVerdienst`, `renderFooter`, `renderEditors`, `render`.
- No "TODO"/"TBD" placeholders. All code blocks contain the actual content.
