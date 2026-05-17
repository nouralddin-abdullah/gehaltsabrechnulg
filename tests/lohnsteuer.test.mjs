import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLohnsteuer } from './lohnsteuer.mjs';

test('Lohnsteuer: 0 below Grundfreibetrag (Brutto 500)', () => {
  const r = calculateLohnsteuer({ brutto: 500, steuerklasse: 1, kkZusatzbeitrag: 0.017 });
  assert.equal(r.lohnsteuer, 0);
  assert.equal(r.soli, 0);
  assert.equal(r.kirchensteuer, 0);
});

test('Lohnsteuer: StKl 1 Brutto 3000 in plausible range', () => {
  const r = calculateLohnsteuer({ brutto: 3000, steuerklasse: 1, kkZusatzbeitrag: 0.017 });
  assert.ok(r.lohnsteuer >= 200 && r.lohnsteuer <= 400, `unexpected ${r.lohnsteuer}`);
});

test('Lohnsteuer: StKl 3 much lower than StKl 1 for same Brutto', () => {
  const r1 = calculateLohnsteuer({ brutto: 3000, steuerklasse: 1 });
  const r3 = calculateLohnsteuer({ brutto: 3000, steuerklasse: 3 });
  assert.ok(r3.lohnsteuer < r1.lohnsteuer * 0.5);
});

test('Lohnsteuer: monotonic in Brutto', () => {
  const v = [2000, 3000, 4000, 5000, 6000]
    .map(b => calculateLohnsteuer({ brutto: b, steuerklasse: 1 }).lohnsteuer);
  for (let i = 1; i < v.length; i++) assert.ok(v[i] > v[i - 1], `non-monotonic: ${v}`);
});

test('Lohnsteuer: Konfession + Bundesland produces Kirchensteuer', () => {
  const a = calculateLohnsteuer({ brutto: 4000, steuerklasse: 1 });
  const b = calculateLohnsteuer({ brutto: 4000, steuerklasse: 1, konfession: 'rk', bundesland: 'NW' });
  const c = calculateLohnsteuer({ brutto: 4000, steuerklasse: 1, konfession: 'rk', bundesland: 'BY' });
  assert.equal(a.kirchensteuer, 0);
  assert.ok(b.kirchensteuer > 0);
  assert.ok(c.kirchensteuer > 0);
  assert.ok(c.kirchensteuer < b.kirchensteuer, '8% < 9%');
});

test('Lohnsteuer: monthly Freibetrag reduces tax', () => {
  const a = calculateLohnsteuer({ brutto: 4000, steuerklasse: 1 });
  const b = calculateLohnsteuer({ brutto: 4000, steuerklasse: 1, freibetragMonatlich: 200 });
  assert.ok(b.lohnsteuer < a.lohnsteuer);
});

test('Lohnsteuer: Soli kicks in only above Freigrenze', () => {
  const low = calculateLohnsteuer({ brutto: 2000, steuerklasse: 1 });
  const high = calculateLohnsteuer({ brutto: 10000, steuerklasse: 1 });
  assert.equal(low.soli, 0);
  assert.ok(high.soli > 0);
});

test('Lohnsteuer: faktor reduces tax in StKl 4', () => {
  const a = calculateLohnsteuer({ brutto: 4000, steuerklasse: 4 });
  const b = calculateLohnsteuer({ brutto: 4000, steuerklasse: 4, faktor: 0.7 });
  assert.ok(b.lohnsteuer < a.lohnsteuer);
});
