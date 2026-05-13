import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSV, pvAnRate, midijobRedBmg, SV_RATES_2024 } from './sv.mjs';

// PV AN rate cases
test('pvAnRate: childless ≥23 = 2.3%', () => {
  assert.equal(pvAnRate({ kinder: 0, age: 30 }), 0.023);
});

test('pvAnRate: 1 child = 1.7%', () => {
  assert.equal(pvAnRate({ kinder: 1, age: 30 }), 0.017);
});

test('pvAnRate: 2 children = 1.45% (-0.25%)', () => {
  assert.equal(pvAnRate({ kinder: 2, age: 30 }), 0.0145);
});

test('pvAnRate: 3 children = 1.2%', () => {
  assert.equal(pvAnRate({ kinder: 3, age: 30 }), 0.012);
});

test('pvAnRate: 5 children = 0.7% (-0.25% × 4)', () => {
  assert.equal(pvAnRate({ kinder: 5, age: 30 }), 0.007);
});

test('pvAnRate: 6 children = 0.7% (capped at 4 deductions)', () => {
  assert.equal(pvAnRate({ kinder: 6, age: 30 }), 0.007);
});

test('pvAnRate: childless under 23 = 1.7% (no Zuschlag)', () => {
  assert.equal(pvAnRate({ kinder: 0, age: 20 }), 0.017);
});

test('pvAnRate: Sachsen childless ≥23 = 2.8% (+0.5%)', () => {
  assert.equal(pvAnRate({ kinder: 0, age: 30, bundesland: 'SN' }), 0.028);
});

// Midijob reduced base
test('midijobRedBmg: below range = full brutto', () => {
  assert.equal(midijobRedBmg(500), 500);
});

test('midijobRedBmg: above range = full brutto', () => {
  assert.equal(midijobRedBmg(2500), 2500);
});

test('midijobRedBmg: at exact Untergrenze ≈ F × U', () => {
  const rd = midijobRedBmg(SV_RATES_2024.midijob_untergrenze);
  assert.ok(Math.abs(rd - SV_RATES_2024.midijob_F * SV_RATES_2024.midijob_untergrenze) < 0.01);
});

test('midijobRedBmg: at Obergrenze ≈ Obergrenze', () => {
  const rd = midijobRedBmg(SV_RATES_2024.midijob_obergrenze);
  assert.ok(Math.abs(rd - SV_RATES_2024.midijob_obergrenze) < 0.01);
});

test('midijobRedBmg: monotonic in range', () => {
  const a = midijobRedBmg(1000);
  const b = midijobRedBmg(1500);
  assert.ok(a < b);
  assert.ok(a > 538); // and above the floor
});

// calculateSV — standard case
test('calculateSV: standard, 3000 Brutto, StKl irrelevant, no Midijob, childless', () => {
  const r = calculateSV({
    brutto: 3000,
    kinder: 0,
    age: 30,
    kkZusatzbeitrag: 0.017, // 1.7%
  });
  // AN rates:
  //   KV: 7.3% + 0.85% = 8.15% → 3000 * 8.15% = 244.50
  //   RV: 9.3% → 279.00
  //   AV: 1.3% → 39.00
  //   PV: 2.3% (childless) → 69.00
  assert.equal(r.kvBeitrag, 244.50);
  assert.equal(r.rvBeitrag, 279.00);
  assert.equal(r.avBeitrag, 39.00);
  assert.equal(r.pvBeitrag, 69.00);
});

test('calculateSV: with 2 children → lower PV', () => {
  const r = calculateSV({ brutto: 3000, kinder: 2, age: 30, kkZusatzbeitrag: 0.017 });
  // PV: 1.45% → 43.50
  assert.equal(r.pvBeitrag, 43.50);
});

test('calculateSV: above KV-BBG caps the KV-Brutto', () => {
  const r = calculateSV({ brutto: 10000, kinder: 0, kkZusatzbeitrag: 0.017 });
  assert.equal(r.kvBrutto, SV_RATES_2024.bbg_kv_pv_month);
  // KV-Beitrag = 5175 * 8.15% = 421.76 (rounded)
  assert.equal(r.kvBeitrag, Math.round(SV_RATES_2024.bbg_kv_pv_month * 0.0815 * 100) / 100);
});

test('calculateSV: above RV-BBG caps the RV-Brutto', () => {
  const r = calculateSV({ brutto: 10000, kinder: 0, kkZusatzbeitrag: 0.017 });
  assert.equal(r.rvBrutto, SV_RATES_2024.bbg_rv_av_west_month);
});

test('calculateSV: Ost RV-BBG is lower than West', () => {
  const rW = calculateSV({ brutto: 8000, kinder: 0, kkZusatzbeitrag: 0.017, westOst: 'W' });
  const rO = calculateSV({ brutto: 8000, kinder: 0, kkZusatzbeitrag: 0.017, westOst: 'O' });
  assert.equal(rW.rvBrutto, SV_RATES_2024.bbg_rv_av_west_month);
  assert.equal(rO.rvBrutto, SV_RATES_2024.bbg_rv_av_ost_month);
  assert.ok(rO.rvBeitrag < rW.rvBeitrag);
});

test('calculateSV: Midijob reduces AN contributions but reports full Brutto', () => {
  const reg = calculateSV({ brutto: 1500, kinder: 1, age: 30, kkZusatzbeitrag: 0.017 });
  const mij = calculateSV({ brutto: 1500, kinder: 1, age: 30, kkZusatzbeitrag: 0.017, midijob: true });
  // Brutto reported should be 1500 in both cases (full, capped at BBG)
  assert.equal(mij.kvBrutto, 1500);
  // But Beiträge should be lower with Midijob
  assert.ok(mij.kvBeitrag < reg.kvBeitrag);
  assert.ok(mij.rvBeitrag < reg.rvBeitrag);
});
