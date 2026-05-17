import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSV, pvAnRate, midijobRedBmg, SV_RATES_2026 } from './sv.mjs';

test('pvAnRate: childless ≥23 = 2.4%', () => {
  assert.equal(pvAnRate({ kinder: 0, age: 30 }), 0.024);
});

test('pvAnRate: 1 child = 1.8%', () => {
  assert.equal(pvAnRate({ kinder: 1, age: 30 }), 0.018);
});

test('pvAnRate: 2 children = 1.55% (-0.25%)', () => {
  assert.equal(pvAnRate({ kinder: 2, age: 30 }), 0.0155);
});

test('pvAnRate: 3 children = 1.30%', () => {
  assert.equal(pvAnRate({ kinder: 3, age: 30 }), 0.013);
});

test('pvAnRate: 5 children = 0.80% (-0.25% × 4)', () => {
  assert.equal(pvAnRate({ kinder: 5, age: 30 }), 0.008);
});

test('pvAnRate: 6 children = 0.80% (capped at 4 deductions)', () => {
  assert.equal(pvAnRate({ kinder: 6, age: 30 }), 0.008);
});

test('pvAnRate: childless under 23 = 1.8% (no Zuschlag)', () => {
  assert.equal(pvAnRate({ kinder: 0, age: 20 }), 0.018);
});

test('pvAnRate: Sachsen childless ≥23 = 2.9% (+0.5%)', () => {
  assert.equal(pvAnRate({ kinder: 0, age: 30, bundesland: 'SN' }), 0.029);
});

test('midijobRedBmg: below range = full brutto', () => {
  assert.equal(midijobRedBmg(500), 500);
});

test('midijobRedBmg: above range = full brutto', () => {
  assert.equal(midijobRedBmg(2500), 2500);
});

test('midijobRedBmg: at exact Untergrenze ≈ F × U', () => {
  const rd = midijobRedBmg(SV_RATES_2026.midijob_untergrenze);
  assert.ok(Math.abs(rd - SV_RATES_2026.midijob_F * SV_RATES_2026.midijob_untergrenze) < 0.01);
});

test('midijobRedBmg: at Obergrenze ≈ Obergrenze', () => {
  const rd = midijobRedBmg(SV_RATES_2026.midijob_obergrenze);
  assert.ok(Math.abs(rd - SV_RATES_2026.midijob_obergrenze) < 0.01);
});

test('midijobRedBmg: monotonic in range', () => {
  const a = midijobRedBmg(1000);
  const b = midijobRedBmg(1500);
  assert.ok(a < b);
  assert.ok(a > 603);
});

test('calculateSV: standard, 3000 Brutto, childless, kkZusatz 1.7%', () => {
  const r = calculateSV({
    brutto: 3000,
    kinder: 0,
    age: 30,
    kkZusatzbeitrag: 0.017,
  });
  assert.equal(r.kvBeitrag, 244.50);
  assert.equal(r.rvBeitrag, 279.00);
  assert.equal(r.avBeitrag, 39.00);
  assert.equal(r.pvBeitrag, 72.00);
});

test('calculateSV: with 2 children → lower PV', () => {
  const r = calculateSV({ brutto: 3000, kinder: 2, age: 30, kkZusatzbeitrag: 0.017 });
  assert.equal(r.pvBeitrag, 46.50);
});

test('calculateSV: matches denn\'s Biomarkt 03/2026 (Hussain) payslip', () => {
  const r = calculateSV({
    brutto: 2810.12,
    kinder: 0,
    age: 27,
    kkZusatzbeitrag: 0.032,
  });
  assert.equal(r.kvBeitrag, 250.10);
  assert.equal(r.rvBeitrag, 261.34);
  assert.equal(r.avBeitrag, 36.53);
  assert.equal(r.pvBeitrag, 67.44);
});

test('calculateSV: matches zvoove 03/2026 reference payslip', () => {
  const r = calculateSV({
    brutto: 2817.79,
    kinder: 0,
    age: 36,
    kkZusatzbeitrag: 0.0269,
  });
  assert.equal(r.kvBeitrag, 243.60);
  assert.equal(r.rvBeitrag, 262.05);
  assert.equal(r.avBeitrag, 36.63);
  assert.equal(r.pvBeitrag, 67.63);
});

test('calculateSV: above KV-BBG caps the KV-Brutto', () => {
  const r = calculateSV({ brutto: 10000, kinder: 0, kkZusatzbeitrag: 0.017 });
  assert.equal(r.kvBrutto, SV_RATES_2026.bbg_kv_pv_month);
  assert.equal(r.kvBeitrag, Math.round(SV_RATES_2026.bbg_kv_pv_month * 0.0815 * 100) / 100);
});

test('calculateSV: above RV-BBG caps the RV-Brutto', () => {
  const r = calculateSV({ brutto: 10000, kinder: 0, kkZusatzbeitrag: 0.017 });
  assert.equal(r.rvBrutto, SV_RATES_2026.bbg_rv_av_west_month);
});

test('calculateSV: Midijob reduces AN contributions but reports full Brutto', () => {
  const reg = calculateSV({ brutto: 1500, kinder: 1, age: 30, kkZusatzbeitrag: 0.017 });
  const mij = calculateSV({ brutto: 1500, kinder: 1, age: 30, kkZusatzbeitrag: 0.017, midijob: true });
  assert.equal(mij.kvBrutto, 1500);
  assert.ok(mij.kvBeitrag < reg.kvBeitrag);
  assert.ok(mij.rvBeitrag < reg.rvBeitrag);
});
