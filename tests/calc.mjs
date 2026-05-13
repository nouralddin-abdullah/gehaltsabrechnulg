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
