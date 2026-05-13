import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDE, formatDE,
  computeRowBetrag, sumBrutto,
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
