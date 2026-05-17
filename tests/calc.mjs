

const _fmt = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseDE(input) {
  if (typeof input === 'number') return input;
  if (input == null) return null;
  const s = String(input).trim();
  if (s === '') return null;

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

function _sumBruttoBy(rows, predicate) {
  let total = 0;
  for (const r of rows) {
    if (r.hinweis) continue;
    if (!predicate(r)) continue;
    const b = computeRowBetrag(r);
    if (b != null) total += b;
  }
  return Math.round(total * 100) / 100;
}

export function sumBrutto(rows) {
  return _sumBruttoBy(rows, r => (r.gb || '').toUpperCase() === 'J');
}

export function sumSteuerBrutto(rows) {
  return _sumBruttoBy(rows, r => /^[LE]$/i.test(r.st || ''));
}

export function sumSVBrutto(rows) {
  return _sumBruttoBy(rows, r => /^[LE]$/i.test(r.sv || ''));
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

function _sumBetrag(rows) {
  let total = 0;
  for (const r of rows) {
    const v = parseDE(r.betrag);
    if (v != null) total += v;
  }
  return Math.round(total * 100) / 100;
}

const GERMAN_MONTHS = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

export function monthFromGerman(name) {
  if (!name) return null;
  return GERMAN_MONTHS[String(name).trim().toLowerCase()] || null;
}

function _parseDdmmyy(s) {
  if (!s) return null;
  const m = /^(\d{2})(\d{2})(\d{2,4})$/.exec(String(s).trim());
  if (!m) return null;
  const dd = +m[1], mm = +m[2];
  let yy = +m[3];
  if (yy < 100) yy = yy < 70 ? 2000 + yy : 1900 + yy;
  return { day: dd, month: mm, year: yy };
}

export function monthsWorkedInYear(eintritt, currentYear, currentMonth) {
  if (!currentMonth || !currentYear) return 0;
  const e = _parseDdmmyy(eintritt);
  if (!e) return currentMonth;
  if (e.year > currentYear) return 0;
  if (e.year < currentYear) return currentMonth;
  return Math.max(0, currentMonth - e.month + 1);
}

export function computeYearTotals(state) {
  const monthly = computeTotals(state);
  const steuerBrutto = sumSteuerBrutto(state.brutto || []);
  const svBrutto = sumSVBrutto(state.brutto || []);
  const steuer = state.steuer && state.steuer[0] ? state.steuer[0] : {};
  const sv = state.sv && state.sv[0] ? state.sv[0] : {};
  const monatszahl = monthsWorkedInYear(
    state.meta && state.meta.eintritt,
    +(state.zeitraum && state.zeitraum.jahr),
    monthFromGerman(state.zeitraum && state.zeitraum.monat),
  );
  const x = (val) => {
    const n = parseDE(val);
    if (n == null) return null;
    return Math.round(n * monatszahl * 100) / 100;
  };
  return {
    monatszahl,
    gesamtBrutto:  Math.round(monthly.gesamtBrutto * monatszahl * 100) / 100,
    steuerBrutto:  Math.round(steuerBrutto * monatszahl * 100) / 100,
    svBrutto:      Math.round(svBrutto * monatszahl * 100) / 100,
    lohnsteuer:    x(steuer.lohnsteuer) ?? 0,
    kirchensteuer: x(steuer.kirchensteuer) ?? 0,
    soli:          x(steuer.soli) ?? 0,
    kvBeitrag:     x(sv.kvBeitrag) ?? 0,
    rvBeitrag:     x(sv.rvBeitrag) ?? 0,
    avBeitrag:     x(sv.avBeitrag) ?? 0,
    pvBeitrag:     x(sv.pvBeitrag) ?? 0,
    auszahlung:    Math.round(monthly.auszahlungsbetrag * monatszahl * 100) / 100,
  };
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
  return { gesamtBrutto, steuerAbzuege, svAbzuege, nettoVerdienst, auszahlungsbetrag };
}
