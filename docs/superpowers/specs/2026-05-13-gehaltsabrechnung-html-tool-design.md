# Gehaltsabrechnung HTML Tool — Design

**Date:** 2026-05-13
**Status:** Approved
**Owner:** Manager (end user) / Developer (author)

## Goal

Build a single self-contained HTML file that the manager opens with a double-click to produce a DATEV-style German payroll slip (Gehaltsabrechnung) matching the reference PDF `Gehaltsabrechnung 10_2023_260121_171407.pdf`. The manager enters all data (including tax and social-insurance amounts). The tool computes only sums and the final payout, then prints to PDF via the browser.

Top priorities, in order:

1. **No errors in the layout** — the printed slip must look like the DATEV reference, not "close enough".
2. **Correct sums** — Gesamt-Brutto, Steuerrechtliche Abzüge, SV-rechtliche Abzüge, Netto-Verdienst, Auszahlungsbetrag.
3. **No friction** — open file, fill form, print PDF. No install, no server, no internet.

## Non-goals

- No real German tax engine (no Lohnsteuer / Soli / SV formulas). The manager enters those amounts from his existing source.
- No employee database, no login, no server.
- No DATEV logo image. The footer spot is left neutral.
- No email sending, no automatic archive, no PDF library (browser print → "Save as PDF" is enough).

## Architecture

One file: `gehaltsabrechnung.html`. Contains inline CSS, inline vanilla JS, no CDNs, no build step. Works offline.

Two visual zones in normal screen mode (side-by-side, responsive to stack on narrow screens):

- **Left panel — Eingabe (form):** all input fields, grouped by section.
- **Right panel — Vorschau (preview):** live-updating DATEV-style slip, A4 portrait, exact layout.

Print mode (`@media print` + `@page A4`): hides the form panel, shows only the slip, sized to one A4 page.

State lives in a single JavaScript object `state` mirrored to the DOM via plain event listeners. No framework. State can be saved to / loaded from a local JSON file.

## Form sections

All labels in German (the manager is the end user).

### Kopfdaten (header metadata)

Fields, matching the small grid at the top of the DATEV slip:

- Personalnummer
- Geburtsdatum
- Steuerklasse (StKl)
- Faktor
- Ki.Frbtr
- Konfession
- Freibetrag jährlich
- Freibetrag monatlich
- DBA
- Midijob (Ja / Nein / leer)
- St-Tg
- VJ Url. üb., Url. Anspr., Url.Tg.gen., Resturlaub
- Anw.Tage, Urlaub Tage, Krankh.Tg, Fehlz.Tg
- Anw.Std, Urlaub Std, Krankh.Std, Fehlz.Std
- Zeitlohn Std, Überstd, Bez.Std
- SV-Nummer
- Krankenkasse (Name + KK-Nr like `25021097A060`)
- KK % (Krankenkassen-Zusatzbeitragssatz, with footnote 8)
- PGRS, BGRS, Um.SV-Tg
- Eintritt, Austritt
- Steuer-ID
- MFB (footnote 7 — Mehrfachbeschäftigung flag)

### Firma (employer)

One free-text line — the manager pastes it as-is, including the `*` separators used on the slip (e.g. `ILS Integrated Lab Solutions GmbH*Barbara-McClintock-Straße 11*12489 Berlin`). Rendered verbatim.

Additional small fields:

- Pers.-Nr. (repeated in the small box on the slip)
- Abt.-Nr.
- B/N marker
- R0C / Mandant / Blatt / Druckdatum (top-right block: `R0C 133267/30605/00107`, `23.10.2023`, `Blatt 1`)

### Mitarbeiter (employee address)

- Name
- Straße + Hausnummer
- PLZ + Ort

Rendered as a three-line address block.

### Abrechnungs-Zeitraum

- Monat (dropdown Januar–Dezember)
- Jahr (number)
- Headline auto-generated: `für Oktober 2023`.

### Brutto-Bezüge (dynamic list)

Each row has:

- Lohnart (e.g. `1000`, `1012`)
- Bezeichnung (e.g. `Stundenlohn`, `Feiertagslohn`)
- Einheit (`Std`, `Tag`, `Pauschal`, free text)
- Menge (number, e.g. `79,75`)
- Faktor (number, e.g. `20,00`)
- Prozentsatz (optional)
- St (Steuerschlüssel — `L`, `N`, leer)
- SV (SV-Schlüssel — `L`, `N`, leer)
- GB (Gesamtbrutto-Flag — `J`, `N`)
- Betrag — auto-calculated `Menge × Faktor` for unit rows; overridable for `Pauschal`. Sign honored (negative allowed for Nachberechnung corrections).

Plus: a **Hinweis-Zeile** row variant — a single italic note line spanning the table width (e.g. `Nachberechnung 09/2023: - Midijob nicht angewandt -`). Does not contribute to sums.

Controls: `+ Zeile hinzufügen`, `+ Hinweis hinzufügen`, drag handle to reorder, X to delete.

`Gesamt-Brutto` cell at the bottom right is the sum of all `GB=J` rows' Betrag.

### Steuer (manual entry)

Two rows: `L` (Laufender Bezug) and `N` (Nachberechnung). Each row has:

- Steuer-Brutto
- Lohnsteuer
- Kirchensteuer
- Solidaritätszuschlag

The cell `Steuerrechtliche Abzüge` on the right = sum of (Lohnsteuer + Kirchensteuer + Solidaritätszuschlag) across both rows.

### Sozialversicherung (manual entry)

Two rows: `L` and `N`. Each row has:

- KV-Brutto
- RV-Brutto
- AV-Brutto
- PV-Brutto
- KV-Beitrag
- RV-Beitrag
- AV-Beitrag (text — original shows blank / `Z` marker; allow free entry)
- PV-Beitrag (text — original shows `Z` markers; allow free entry, with footnote 6)

The cell `SV-rechtliche Abzüge` on the right = sum of (KV + RV + AV + PV Beiträge) across both rows.

### Verdienstbescheinigung (manual entry, year-to-date)

Headline supports an optional suffix `mit Nachberechnung Vorjahr` (toggle).

Two columns mirroring the slip:

Left column:

- Gesamt-Brutto
- Steuer-Brutto
- Lohnsteuer
- Kirchensteuer
- Solidaritätszuschlag
- Steuerfreie Bezüge
- P. verst. Zuk.sich.
- Pfändung Rest
- Darlehen Rest

Right column:

- SV-Brutto
- KV-Beitrag
- RV-Beitrag
- AV-Beitrag
- PV-Beitrag
- VWL gesamt
- Kug-Auszahlung

### Netto-Bezüge / Netto-Abzüge (right side under SV)

Dynamic list of rows — Lohnart, Bezeichnung, Betrag (signed). Used for extra net additions/deductions. Sum feeds into the Auszahlungsbetrag.

### Bank / Auszahlung (footer)

- Bank (text)
- Konto / IBAN (free text, mask supported — e.g. `DE97 1007 0124 0303 6XXX XX`)
- SV-AG-Anteil
- Zus. AG-Kosten
- Gesamtkosten
- Auszahlungsbetrag (auto-calculated, bottom right, bold)
- Small numeric code box (the `32946` field on the reference)

## Auto-calculations

All currency rendered in German locale (`1.595,00`).

```
Gesamt-Brutto = Σ Brutto-Bezüge rows where GB = J

Steuerrechtliche Abzüge =
    Σ across L,N rows of (Lohnsteuer + Kirchensteuer + Solidaritätszuschlag)

SV-rechtliche Abzüge =
    Σ across L,N rows of (numeric values among KV-Beitrag, RV-Beitrag, AV-Beitrag, PV-Beitrag)
    (non-numeric markers like "Z" are ignored in the sum but still printed)

Netto-Verdienst = Gesamt-Brutto − Steuerrechtliche Abzüge − SV-rechtliche Abzüge

Netto-Saldo = Σ (Netto-Bezüge / Netto-Abzüge rows, signed)

Auszahlungsbetrag = Netto-Verdienst + Netto-Saldo
```

Row-level `Betrag` for unit Brutto rows = `Menge × Faktor`, rounded to 2 decimals, German formatting. Editable to allow Pauschal entries and corrections.

The tool never invents a tax number, SV rate, or KK %.

## Layout / pixel fidelity

Reproduce the DATEV reference exactly:

- **Header grid** (top of page):
  - Title row: left `Abrechnung der Brutto/Netto-Bezüge` + period (`für Oktober 2023`); right `R0C  133267/30605/00107` over `23.10.2023  Blatt 1`.
  - First metadata row (10 columns): `Personal-Nr | Geburtsdatum | StKl | Faktor | Ki.Frbtr | Konfession | Freibetrag jährl.¹ | Freibetrag mtl.¹ | DBA | Midijob | St-Tg`. Right block: `VJ Url. üb. | Url. Anspr. | Url.Tg.gen. | Resturlaub`.
  - Second metadata row: `SV-Nummer | Krankenkasse | KK % ⁸ | PGRS | BGRS | Um.SV-Tg`. Right: `Anw. Tage | Urlaub Tage | Krankh. Tg | Fehlz. Tage`.
  - Third row (numbers under Krankenkasse): the SV-Nummer numeric value and KK code (e.g. `106 0100 2 30`).
  - Fourth row: `Eintritt | Austritt`. Right: `Anw. Std | Urlaub Std | Krankh. Std | Fehlz. Std`.
  - Fifth row: `Steuer-ID | MFB ⁷`. Right: `Zeitlohn Std | Überstd. | Bez. Std`.
  - All headers in small caption font; values directly below in a slightly larger value font.
  - Cell borders match: thin gray rules, no heavy outlines.
- **Employer line:** italic-ish, the asterisk separators kept literal.
- **Pers.-Nr. / Abt.-Nr. / B/N / R0C / Mandant box:** small two-column block aligned right of the employer line.
- **Employee address block:** three lines, indented from the left margin.
- **Hinweise zur Abrechnung:** small header above the right column area; body intentionally empty unless we add a field for it later.
- **Brutto-Bezüge table:**
  - Header row: `Lohnart | Bezeichnung | Einheit ² | Menge ³ | Faktor ³ | Prozentsatz | St⁴ | SV⁴ | GB⁵ | Betrag`.
  - Data rows: monospace digits, right-aligned numeric columns.
  - Below the last data row, on the right edge, the label `Gesamt-Brutto` (small) sits above the value (`3.565,00`) in its own outlined cell.
- **Steuer / Sozialversicherung table:**
  - Steuer block header: `St⁴ | Steuer-Brutto | Lohnsteuer | Kirchensteuer | Solidaritätszuschlag`. Right edge cell: `Steuerrechtliche Abzüge`.
  - Rows: `L`, `N`.
  - SV block header: `SV⁴ | KV-Brutto | RV-Brutto | AV-Brutto | PV-Brutto | KV-Beitrag | RV-Beitrag | AV-Beitrag | PV-Beitrag⁶`. Right edge: `SV-rechtliche Abzüge`.
  - Rows: `L`, `N`.
- **Verdienstbescheinigung + Netto-Bezüge area:**
  - Left half: heading `Verdienstbescheinigung` with optional appended `mit Nachberechnung Vorjahr` in lighter weight, then two sub-columns of label/value pairs as listed above.
  - Right half: heading `Netto-Bezüge/Netto-Abzüge` over a small table with `Lohnart | Bezeichnung | Betrag`.
  - Right-edge cell: `Netto-Verdienst` over the computed value.
- **Footer row:**
  - `Bank | Konto`  on the left.
  - Small numeric code box (e.g. `32946`).
  - `SV-AG-Anteil | Zus. AG-Kosten | Gesamtkosten` headers.
  - Right edge: `Auszahlungsbetrag` over computed value, bold.
- **Legal footnotes block (bottom):** literal text from DATEV slip:
  - `1 H = Hinzurechnungsbetrag`
  - `2 Std = Stunden, T = Tage, Km = Kilometer, St = Stück; EUR = Euro, Tsd = Tausend Euro, Mio = Million Euro`
  - `3 Gegebenenfalls Netto-Lohn/Netto-Stundenlohn`
  - `4 L = Laufender Bezug, S = Sonstiger Bezug, F = Frei, E = Einmalbezug, P = Pauschalierung, A = Abfindung, M = mehrjährige Versteuerung, N = Nachberechnung, V = Vorjahr, W = Entgeltguthaben`
  - `5 J = Bestandteil des Gesamt-Brutto`
  - `6 Z = Einschl. Beitragszuschlag zur PV für Kinderlose`
  - `7 MFB = Mehrfachbeschäftigung`
  - `8 Maßgeblicher Beitragssatz zur KV inkl. Zusatzbeitrag`
  - `- Dies ist eine Entgeltbescheinigung nach § 108 Abs. 3 Satz 1 der Gewerbeordnung -`
  - `AFP Form.-Nr. LNGN14`
- **DATEV logo spot:** bottom-right corner stays blank/neutral (a thin placeholder rectangle is acceptable). Not filled with the DATEV mark for copyright reasons.

Fonts: numeric columns and form-field values use a monospace fallback stack (`Consolas, "Liberation Mono", "Courier New", monospace`) sized to match the DATEV look; labels and headings use a clean sans-serif (`Arial, Helvetica, sans-serif`). All caption labels small (~7pt), values normal (~9-10pt).

Number formatting: `Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Currency symbol is omitted on this slip — values are bare numbers, matching DATEV.

Print stylesheet:

- `@page { size: A4; margin: 10mm; }`
- Hide `.form-panel` and global controls.
- Force `.slip` to A4 width, fixed layout.
- Avoid page breaks inside the slip — slip fits one page; if Brutto-Bezüge overflow with many rows, allow continuation onto a second page with the header repeated (Blatt 2). Not required for v1 if the manager confirms slips fit on one page in practice; for v1 we target one page and document the limit.

## State persistence

Two buttons on the form panel:

- **Speichern als JSON** — serializes `state` and triggers a download named `gehaltsabrechnung-<jahr>-<monat>-<persnr>.json`.
- **Laden aus JSON** — file input that reads JSON and hydrates `state`.

This is the manager's "memory" without a backend.

## Validation

- Money fields: accept digits, comma, optional minus. On blur, normalize to `1.234,56`.
- Required fields: Name, Monat, Jahr. Soft-warn only — never block printing.
- Date fields: `YYYY-MM-DD` input; rendered as `DD.MM.YYYY` on the slip.

## File structure

```
gehaltsabrechnung.html         # the whole tool — HTML + inline CSS + inline JS
docs/superpowers/specs/
    2026-05-13-gehaltsabrechnung-html-tool-design.md  # this file
Gehaltsabrechnung 10_2023_260121_171407.pdf            # reference (kept for layout comparison)
```

Estimated size: ~800-1200 lines of HTML/CSS/JS, all in one file.

## Risks / open questions

- **Pixel-exact match to DATEV** is the highest-friction work item. Strategy: build the layout against the reference PDF side-by-side, iterate until print output overlays cleanly.
- **Multi-page slips:** v1 assumes one page per slip. If the manager produces longer slips (many Brutto-Bezüge rows), we add page break + repeated header in v2.
- **DATEV logo:** confirmed left blank for v1. If the manager later wants the company's own logo there, we add a file-upload field that drops an image into that corner.
- **Browser compatibility:** target Chrome / Edge (Chromium). Firefox print fidelity differs slightly. Document this for the manager.

## Acceptance criteria

1. Manager opens `gehaltsabrechnung.html`, enters the data from the reference PDF, and the printed PDF visually matches the reference within a normal "looks the same" eye check — all labels in the right place, all values aligned in the right columns, totals correct.
2. Gesamt-Brutto, Steuerrechtliche Abzüge, SV-rechtliche Abzüge, Netto-Verdienst, and Auszahlungsbetrag are computed correctly from the entered data. Verified against the reference PDF: Gesamt-Brutto `3.565,00`; Steuerrechtliche Abzüge `521,00` (79,25 + 441,75); SV-rechtliche Abzüge `336,94` (155,21 + 181,73); Auszahlungsbetrag `2.707,06`.
3. Save and reload of the JSON state round-trips without data loss.
4. Print stylesheet hides the form panel and produces a one-page A4 slip with no scrollbars or stray UI chrome.
5. Works offline — no network requests at any point.
