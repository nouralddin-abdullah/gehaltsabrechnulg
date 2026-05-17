import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDE, formatDE,
  computeRowBetrag, sumBrutto,
  sumSteuerBrutto, sumSVBrutto,
  sumSteuerAbzuege, sumSVAbzuege,
  computeTotals,
  monthFromGerman, monthsWorkedInYear, computeYearTotals,
} from './calc.mjs';

test('test harness works', () => {
  assert.equal(1 + 1, 2);
});

test('parseDE: "1.595,00" -> 1595', () => {
  assert.equal(parseDE('1.595,00'), 1595);
});

test('parseDE: "20,00" -> 20', () => {
  assert.equal(parseDE('20,00'), 20);
});

test('parseDE: "" -> null', () => {
  assert.equal(parseDE(''), null);
});

test('parseDE: "  " -> null', () => {
  assert.equal(parseDE('  '), null);
});

test('parseDE: "Z" -> null (non-numeric marker)', () => {
  assert.equal(parseDE('Z'), null);
});

test('parseDE: "-12,34" -> -12.34', () => {
  assert.equal(parseDE('-12,34'), -12.34);
});

test('parseDE: number passes through', () => {
  assert.equal(parseDE(42.5), 42.5);
});

test('formatDE: 1595 -> "1.595,00"', () => {
  assert.equal(formatDE(1595), '1.595,00');
});

test('formatDE: 0 -> "0,00"', () => {
  assert.equal(formatDE(0), '0,00');
});

test('formatDE: null -> ""', () => {
  assert.equal(formatDE(null), '');
});

test('formatDE: -12.34 -> "-12,34"', () => {
  assert.equal(formatDE(-12.34), '-12,34');
});

test('formatDE: rounding 2.705 -> 2,70 or 2,71', () => {
  const r = formatDE(2.705);
  assert.ok(r === '2,71' || r === '2,70', `unexpected: ${r}`);
});

test('computeRowBetrag: 79,75 x 20,00 = 1595', () => {
  assert.equal(computeRowBetrag({ menge: '79,75', faktor: '20,00' }), 1595);
});

test('computeRowBetrag: explicit betrag overrides product', () => {
  assert.equal(
    computeRowBetrag({ menge: '5', faktor: '10', betrag: '99,99' }),
    99.99,
  );
});

test('computeRowBetrag: missing menge -> null', () => {
  assert.equal(computeRowBetrag({ menge: '', faktor: '20,00' }), null);
});

test('computeRowBetrag: missing both menge and betrag -> null', () => {
  assert.equal(computeRowBetrag({ menge: '', faktor: '' }), null);
});

test('computeRowBetrag: pauschal-style (betrag only) returns the betrag', () => {
  assert.equal(
    computeRowBetrag({ einheit: 'Pauschal', betrag: '500,00' }),
    500,
  );
});

test('sumBrutto: only GB=J rows are summed', () => {
  const rows = [
    { gb: 'J', menge: '79,75', faktor: '20,00' },
    { gb: 'J', menge: '8',     faktor: '20,00' },
    { gb: 'J', menge: '90,50', faktor: '20,00' },
    { gb: 'N', menge: '100',   faktor: '1,00' },
    { hinweis: true, text: 'Nachberechnung 09/2023' },
  ];
  assert.equal(sumBrutto(rows), 3565);
});

test('sumBrutto: empty list -> 0', () => {
  assert.equal(sumBrutto([]), 0);
});

test('sumSteuerBrutto / sumSVBrutto: zvoove 03/2026 reference rows', () => {
  const rows = [
    { menge: '119,00', faktor: '16,69', st: 'L', sv: 'L', gb: 'J' },
    { menge: '8,00',   faktor: '3,31',  st: 'L', sv: 'L', gb: 'J' },
    { menge: '102,08', faktor: '3,31',  st: 'L', sv: 'L', gb: 'J' },
    { menge: '1,08',   faktor: '0,00',  st: 'F', sv: 'F', gb: 'J' },
    { menge: '15,00',  faktor: '2,50',  st: 'F', sv: 'F', gb: 'J' },
    { menge: '7,00',   faktor: '0,00',  st: 'F', sv: 'F', gb: 'J' },
    { menge: '28,00',  faktor: '16,69', st: 'L', sv: 'L', gb: 'J' },
  ];
  assert.equal(sumBrutto(rows),        2855.29);
  assert.equal(sumSteuerBrutto(rows),  2817.79);
  assert.equal(sumSVBrutto(rows),      2817.79);
});

test('sumSteuerBrutto: st="F" rows are excluded even if gb="J"', () => {
  const rows = [
    { menge: '100', faktor: '1,00', st: 'L', sv: 'L', gb: 'J' },
    { menge: '50',  faktor: '1,00', st: 'F', sv: 'L', gb: 'J' },
  ];
  assert.equal(sumSteuerBrutto(rows), 100);
  assert.equal(sumSVBrutto(rows), 150);
});

test('sumSteuerAbzuege: reference PDF L+N rows = 521', () => {
  const rows = [
    { tag: 'L', lohnsteuer: '79,25',  kirchensteuer: '', soli: '' },
    { tag: 'N', lohnsteuer: '441,75', kirchensteuer: '', soli: '' },
  ];
  assert.equal(sumSteuerAbzuege(rows), 521);
});

test('sumSteuerAbzuege: includes all three columns', () => {
  const rows = [
    { tag: 'L', lohnsteuer: '100,00', kirchensteuer: '8,00', soli: '5,50' },
  ];
  assert.equal(sumSteuerAbzuege(rows), 113.5);
});

test('sumSteuerAbzuege: blanks treated as 0', () => {
  const rows = [{ tag: 'L', lohnsteuer: '', kirchensteuer: '', soli: '' }];
  assert.equal(sumSteuerAbzuege(rows), 0);
});

test('sumSVAbzuege: reference PDF L+N rows = 336.94', () => {
  const rows = [
    { tag: 'L', kvBeitrag: '155,21', rvBeitrag: '', avBeitrag: 'Z', pvBeitrag: '' },
    { tag: 'N', kvBeitrag: '181,73', rvBeitrag: '', avBeitrag: 'Z', pvBeitrag: '' },
  ];
  assert.equal(sumSVAbzuege(rows), 336.94);
});

test('sumSVAbzuege: ignores non-numeric markers like "Z"', () => {
  const rows = [
    { tag: 'L', kvBeitrag: '100,00', rvBeitrag: 'Z', avBeitrag: '50,00', pvBeitrag: '' },
  ];
  assert.equal(sumSVAbzuege(rows), 150);
});

test('computeTotals: matches reference PDF', () => {
  const state = {
    brutto: [
      { gb: 'J', menge: '79,75', faktor: '20,00' },
      { gb: 'J', menge: '8',     faktor: '20,00' },
      { gb: 'J', menge: '90,50', faktor: '20,00' },
    ],
    steuer: [
      { tag: 'L', lohnsteuer: '79,25',  kirchensteuer: '', soli: '' },
      { tag: 'N', lohnsteuer: '441,75', kirchensteuer: '', soli: '' },
    ],
    sv: [
      { tag: 'L', kvBeitrag: '155,21', rvBeitrag: '', avBeitrag: 'Z', pvBeitrag: '' },
      { tag: 'N', kvBeitrag: '181,73', rvBeitrag: '', avBeitrag: 'Z', pvBeitrag: '' },
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

test('monthFromGerman: case-insensitive', () => {
  assert.equal(monthFromGerman('März'), 3);
  assert.equal(monthFromGerman('MÄRZ'), 3);
  assert.equal(monthFromGerman('oktober'), 10);
  assert.equal(monthFromGerman('Dezember'), 12);
  assert.equal(monthFromGerman('Unsinn'), null);
});

test('monthsWorkedInYear: zvoove 03/2026 = 1 month (Eintritt same month)', () => {
  assert.equal(monthsWorkedInYear('020326', 2026, 3), 1);
});

test('monthsWorkedInYear: Abdelrahman Oktober 2025, Eintritt 01.06.2025 = 5 months', () => {
  assert.equal(monthsWorkedInYear('010625', 2025, 10), 5);
});

test('monthsWorkedInYear: Eintritt prior year = full year-to-current-month', () => {
  assert.equal(monthsWorkedInYear('010623', 2025, 4), 4);
});

test('computeYearTotals: Mohammed 03/2026 — 1 month, matches monthly', () => {
  const state = {
    meta: { eintritt: '020326' },
    zeitraum: { monat: 'März', jahr: '2026' },
    brutto: [
      { menge: '119,00', faktor: '16,69', st: 'L', sv: 'L', gb: 'J' },
      { menge: '8,00',   faktor: '3,31',  st: 'L', sv: 'L', gb: 'J' },
      { menge: '102,08', faktor: '3,31',  st: 'L', sv: 'L', gb: 'J' },
      { menge: '1,08',   faktor: '0,00',  st: 'F', sv: 'F', gb: 'J' },
      { menge: '15,00',  faktor: '2,50',  st: 'F', sv: 'F', gb: 'J' },
      { menge: '7,00',   faktor: '0,00',  st: 'F', sv: 'F', gb: 'J' },
      { menge: '28,00',  faktor: '16,69', st: 'L', sv: 'L', gb: 'J' },
    ],
    steuer: [{ tag: 'L', lohnsteuer: '254,58' }],
    sv: [{ tag: 'L', kvBeitrag: '243,60', rvBeitrag: '262,05', avBeitrag: '36,63', pvBeitrag: '67,63' }],
    nettoBezuege: [],
  };
  const y = computeYearTotals(state);
  assert.equal(y.monatszahl, 1);
  assert.equal(y.gesamtBrutto, 2855.29);
  assert.equal(y.steuerBrutto, 2817.79);
  assert.equal(y.svBrutto, 2817.79);
  assert.equal(y.lohnsteuer, 254.58);
  assert.equal(y.kvBeitrag, 243.60);
  assert.equal(y.rvBeitrag, 262.05);
  assert.equal(y.avBeitrag, 36.63);
  assert.equal(y.pvBeitrag, 67.63);
  assert.equal(y.auszahlung, 1990.80);
});

test('computeYearTotals: Abdelrahman Oktober 2025 — 5 months, matches PDF', () => {
  const state = {
    meta: { eintritt: '010625' },
    zeitraum: { monat: 'Oktober', jahr: '2025' },
    brutto: [
      { lohnart: '2', bezeichnung: 'Gehalt', betrag: '576,90', st: 'L', sv: 'L', gb: 'J' },
    ],
    steuer: [{ tag: 'L', lohnsteuer: '0,00', kirchensteuer: '0,00', soli: '0,00' }],
    sv: [{ tag: 'L', kvBeitrag: '2,62', rvBeitrag: '2,69', avBeitrag: '0,38', pvBeitrag: '0,52' }],
    nettoBezuege: [],
  };
  const y = computeYearTotals(state);
  assert.equal(y.monatszahl, 5);
  assert.equal(y.gesamtBrutto, 2884.50);
  assert.equal(y.lohnsteuer, 0);
  assert.equal(y.kvBeitrag, 13.10);
  assert.equal(y.rvBeitrag, 13.45);
  assert.equal(y.avBeitrag, 1.90);
  assert.equal(y.pvBeitrag, 2.60);
});

test('computeTotals: netto rows shift the Auszahlungsbetrag', () => {
  const state = {
    brutto: [{ gb: 'J', menge: '100', faktor: '1,00' }],
    steuer: [],
    sv: [],
    nettoBezuege: [
      { betrag: '50,00' },
      { betrag: '-10,00' },
    ],
  };
  const t = computeTotals(state);
  assert.equal(t.gesamtBrutto, 100);
  assert.equal(t.nettoVerdienst, 100);
  assert.equal(t.auszahlungsbetrag, 140);
});
