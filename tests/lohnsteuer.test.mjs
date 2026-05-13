import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  einkommensteuer, jahresLohnsteuer, jahresSoli,
  kirchensteuerRate, calculateLohnsteuer, TAX_CONSTANTS_2024,
} from './lohnsteuer.mjs';

// §32a tariff
test('einkommensteuer: 0 at Grundfreibetrag', () => {
  assert.equal(einkommensteuer(11604), 0);
});

test('einkommensteuer: 0 below Grundfreibetrag', () => {
  assert.equal(einkommensteuer(8000), 0);
});

test('einkommensteuer: progressive zone 1 entry point', () => {
  // Just above Grundfreibetrag: tiny tax
  const t = einkommensteuer(12000);
  assert.ok(t > 0 && t < 200);
});

test('einkommensteuer: at 50,000 zvE — known reference', () => {
  // 50,000 zvE in 2024: roughly 11,200 EUR (German tax tables)
  const t = einkommensteuer(50000);
  assert.ok(t > 10000 && t < 12500, `unexpected: ${t}`);
});

test('einkommensteuer: at 100,000 zvE — known reference', () => {
  const t = einkommensteuer(100000);
  assert.ok(t > 31000 && t < 33000, `unexpected: ${t}`);
});

test('einkommensteuer: monotonic increasing', () => {
  const a = einkommensteuer(30000);
  const b = einkommensteuer(40000);
  const c = einkommensteuer(50000);
  assert.ok(a < b && b < c);
});

// Soli
test('jahresSoli: 0 below Freigrenze', () => {
  assert.equal(jahresSoli({ jahresLst: 10000, steuerklasse: 1 }), 0);
});

test('jahresSoli: 0 at Freigrenze', () => {
  assert.equal(jahresSoli({ jahresLst: TAX_CONSTANTS_2024.soli_freigrenze_normal, steuerklasse: 1 }), 0);
});

test('jahresSoli: kicks in above Freigrenze with Milderungszone', () => {
  const s = jahresSoli({ jahresLst: 20000, steuerklasse: 1 });
  assert.ok(s > 0 && s < 1100, `unexpected: ${s}`);
});

test('jahresSoli: StKl 3 Freigrenze is doubled', () => {
  const a = jahresSoli({ jahresLst: 25000, steuerklasse: 1 });
  const b = jahresSoli({ jahresLst: 25000, steuerklasse: 3 });
  assert.ok(a > 0);
  assert.equal(b, 0);
});

test('jahresSoli: high income full 5.5%', () => {
  const s = jahresSoli({ jahresLst: 100000, steuerklasse: 1 });
  assert.equal(Math.round(s), Math.round(100000 * 0.055));
});

// Kirchensteuer rate
test('kirchensteuerRate: 8% in Bayern', () => {
  assert.equal(kirchensteuerRate({ bundesland: 'BY', konfession: 'rk' }), 0.08);
});

test('kirchensteuerRate: 8% in Baden-Württemberg', () => {
  assert.equal(kirchensteuerRate({ bundesland: 'BW', konfession: 'ev' }), 0.08);
});

test('kirchensteuerRate: 9% in NRW', () => {
  assert.equal(kirchensteuerRate({ bundesland: 'NW', konfession: 'rk' }), 0.09);
});

test('kirchensteuerRate: 0% if konfession empty', () => {
  assert.equal(kirchensteuerRate({ bundesland: 'BY', konfession: '' }), 0);
});

test('kirchensteuerRate: 0% if konfession = "--"', () => {
  assert.equal(kirchensteuerRate({ bundesland: 'BY', konfession: '--' }), 0);
});

// calculateLohnsteuer — known reference cases
// Caveat: my approximation may differ from BMF by a few EUR due to Vorsorgepauschale simplifications.
test('calculateLohnsteuer: StKl 1, Brutto 3000, no Konfession — Lohnsteuer in expected range', () => {
  const r = calculateLohnsteuer({ brutto: 3000, steuerklasse: 1, bundesland: 'BE' });
  // Roughly: annual 36k Brutto, ~28k zvE, ~4500 annual LSt → ~370/month
  assert.ok(r.lohnsteuer > 300 && r.lohnsteuer < 450, `unexpected lohnsteuer ${r.lohnsteuer}`);
  assert.equal(r.kirchensteuer, 0);
});

test('calculateLohnsteuer: StKl 3, Brutto 3000 — much lower tax due to splitting', () => {
  const r1 = calculateLohnsteuer({ brutto: 3000, steuerklasse: 1 });
  const r3 = calculateLohnsteuer({ brutto: 3000, steuerklasse: 3 });
  assert.ok(r3.lohnsteuer < r1.lohnsteuer);
  assert.ok(r3.lohnsteuer < 200, `StKl 3 should be low; got ${r3.lohnsteuer}`);
});

test('calculateLohnsteuer: StKl 5 yields a note', () => {
  const r = calculateLohnsteuer({ brutto: 2000, steuerklasse: 5 });
  assert.ok(r.note.includes('Approximation'));
});

test('calculateLohnsteuer: Kirchensteuer adds when Konfession set', () => {
  const r = calculateLohnsteuer({ brutto: 3000, steuerklasse: 1, konfession: 'rk', bundesland: 'NW' });
  // 9% of Lohnsteuer
  assert.ok(Math.abs(r.kirchensteuer - r.lohnsteuer * 0.09) < 0.5);
});

test('calculateLohnsteuer: monthly Freibetrag reduces tax', () => {
  const without = calculateLohnsteuer({ brutto: 3000, steuerklasse: 1 });
  const withFb = calculateLohnsteuer({ brutto: 3000, steuerklasse: 1, freibetragMonatlich: 200 });
  assert.ok(withFb.lohnsteuer < without.lohnsteuer);
});

test('calculateLohnsteuer: zero Brutto → zero tax', () => {
  const r = calculateLohnsteuer({ brutto: 0, steuerklasse: 1 });
  assert.equal(r.lohnsteuer, 0);
  assert.equal(r.soli, 0);
  assert.equal(r.kirchensteuer, 0);
});

test('calculateLohnsteuer: very low Brutto (Minijob-Größe) → zero tax', () => {
  const r = calculateLohnsteuer({ brutto: 500, steuerklasse: 1 });
  assert.equal(r.lohnsteuer, 0);
});
