// Pure helpers for the Gehaltsabrechnung tool.
// This file is the source of truth; its contents are inlined into
// gehaltsabrechnung.html's <script> block during Task 15.

const _fmt = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseDE(input) {
  if (typeof input === 'number') return input;
  if (input == null) return null;
  const s = String(input).trim();
  if (s === '') return null;
  // Accept "1.234,56", "1234,56", "1234.56", "-12,34".
  // Strip thousand separators (.), then convert decimal comma to dot.
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatDE(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return _fmt.format(n);
}

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
    if ((r.gb || '').toUpperCase() !== 'J') continue;
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

export function sumSteuerAbzuege(rows) {
  return _sumFields(rows, ['lohnsteuer', 'kirchensteuer', 'soli']);
}

export function sumSVAbzuege(rows) {
  return _sumFields(rows, ['kvBeitrag', 'rvBeitrag', 'avBeitrag', 'pvBeitrag']);
}
