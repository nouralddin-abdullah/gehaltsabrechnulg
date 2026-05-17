import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { convertExpr, compilePap } from './pap.mjs';

test('convertExpr: BigDecimal.valueOf', () => {
  assert.equal(convertExpr('BigDecimal.valueOf(11604)'), '(11604)');
});

test('convertExpr: simple add', () => {
  assert.equal(convertExpr('A.add(B)'), '(A + B)');
});

test('convertExpr: chained add+subtract', () => {
  assert.equal(convertExpr('A.add(B).subtract(C)'), '((A + B) - C)');
});

test('convertExpr: nested arg', () => {
  assert.equal(convertExpr('A.subtract(B.add(C))'), '(A - (B + C))');
});

test('convertExpr: setScale with mode', () => {
  assert.equal(
    convertExpr('A.setScale(2, BigDecimal.ROUND_DOWN)'),
    '_round(A, 2, ROUND_DOWN)',
  );
});

test('convertExpr: divide with scale and mode', () => {
  assert.equal(
    convertExpr('A.divide(B, 2, BigDecimal.ROUND_DOWN)'),
    '_div(A, B, 2, ROUND_DOWN)',
  );
});

test('convertExpr: KVSATZAN formula', () => {
  const r = convertExpr('(KVZ.divide(ZAHL2).divide(ZAHL100)).add(BigDecimal.valueOf(0.07))');

  assert.match(r, /\(0\.07\)/);
  assert.match(r, /KVZ/);
});

test('compilePap: parses 2026 XML without throwing', () => {
  const xml = fs.readFileSync('reference/Lohnsteuer2026.xml', 'utf8');
  const pap = compilePap(xml);
  assert.ok(pap.methods.MAIN);
  assert.ok(pap.methods.MRE4JL);
  assert.ok(pap.methods.MRE4);
  assert.ok(typeof pap.initialState === 'object');
});

test('compilePap: parses 2025 XML (handles new BigDecimal(N) form)', () => {
  const xml = fs.readFileSync('reference/Lohnsteuer2025.xml', 'utf8');
  const pap = compilePap(xml);
  assert.ok(pap.methods.MAIN);
});

function defaultInputs(overrides = {}) {
  return {
    LZZ: 2, RE4: 0, STKL: 1, KVZ: 1.7, KRV: 0, PVZ: 0, PVS: 0,
    R: 0, ZKF: 0, af: 0, f: 1.0, AJAHR: 0, PKV: 0, ALV: 0,
    PKPV: 0, PKPVAGZ: 0, PVA: 0, JFREIB: 0, JHINZU: 0,
    LZZFREIB: 0, LZZHINZU: 0, MBV: 0, SONSTB: 0, STERBE: 0,
    VBEZ: 0, VBEZM: 0, VBEZS: 0, VBS: 0, VKAPA: 0, VMT: 0,
    LZZJFREIB: 0, LZZJHINZU: 0, JRE4: 0, JRE4ENT: 0, JVBEZ: 0,
    ZMVB: 0, VJAHR: 0,
    ...overrides,
  };
}

const pap2026 = compilePap(fs.readFileSync('reference/Lohnsteuer2026.xml', 'utf8'));

function lstFor(bruttoMonth, stkl, extra = {}) {
  return pap2026.run(defaultInputs({
    LZZ: 2,
    RE4: Math.round(bruttoMonth * 100),
    STKL: stkl,
    PVZ: 1,
    ...extra,
  })).LSTLZZ / 100;
}

test('PAP 2026: Brutto 500 StKl 1 → 0 LSt (below Grundfreibetrag)', () => {
  assert.equal(lstFor(500, 1), 0);
});

test('PAP 2026: Brutto 3000 StKl 1 → in 200-400 EUR range', () => {
  const v = lstFor(3000, 1);
  assert.ok(v >= 200 && v <= 400, `got ${v}`);
});

test('PAP 2026: StKl 3 < StKl 1 < StKl 5 < StKl 6 for same Brutto', () => {
  const b = 3000;
  const v1 = lstFor(b, 1);
  const v3 = lstFor(b, 3);
  const v5 = lstFor(b, 5);
  const v6 = lstFor(b, 6);
  assert.ok(v3 < v1, `StKl3 ${v3} should be < StKl1 ${v1}`);
  assert.ok(v1 < v5, `StKl1 ${v1} should be < StKl5 ${v5}`);
  assert.ok(v5 <= v6, `StKl5 ${v5} should be <= StKl6 ${v6}`);
});

test('PAP 2026: LSt is monotonically increasing in Brutto', () => {
  const arr = [2000, 3000, 4000, 5000, 6000].map(b => lstFor(b, 1));
  for (let i = 1; i < arr.length; i++) {
    assert.ok(arr[i] > arr[i - 1], `non-monotonic: ${arr}`);
  }
});

test('PAP 2026: Konfession adds Kirchensteuer', () => {
  const noConf = pap2026.run(defaultInputs({ LZZ: 2, RE4: 300000, STKL: 1, PVZ: 1, R: 0 }));
  const withConf = pap2026.run(defaultInputs({ LZZ: 2, RE4: 300000, STKL: 1, PVZ: 1, R: 1 }));

  assert.equal(noConf.BK, 0);
  assert.ok(withConf.BK > 0, `Expected BK > 0 with Konfession, got ${withConf.BK}`);
});

test('PAP 2026: Soli only above Freigrenze', () => {
  const low = pap2026.run(defaultInputs({ LZZ: 2, RE4: 200000, STKL: 1, PVZ: 1 }));
  const high = pap2026.run(defaultInputs({ LZZ: 2, RE4: 1000000, STKL: 1, PVZ: 1 }));
  assert.equal(low.SOLZLZZ, 0);
  assert.ok(high.SOLZLZZ > 0);
});

test('PAP 2026: monthly Freibetrag (LZZFREIB) reduces tax', () => {
  const without = pap2026.run(defaultInputs({ LZZ: 2, RE4: 400000, STKL: 1, PVZ: 1 }));
  const withFb = pap2026.run(defaultInputs({ LZZ: 2, RE4: 400000, STKL: 1, PVZ: 1, LZZFREIB: 20000 }));
  assert.ok(withFb.LSTLZZ < without.LSTLZZ);
});
