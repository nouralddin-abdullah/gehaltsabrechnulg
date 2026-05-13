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
  // Expected: (_div(KVZ, ZAHL2) / ZAHL100) + 0.07
  // After folding chain:  ((_div(KVZ, ZAHL2)) / ZAHL100) + (0.07)
  // Our two-arg divide goes to _div without rounding => same as a/b
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

// Smoke test: monthly Brutto 3000, StKl 1, no Konfession, KV-Zusatz 1.7%, no Kinder, no Sachsen.
test('compilePap: 2026 PAP yields plausible Lohnsteuer for Brutto 3000 StKl 1', () => {
  const xml = fs.readFileSync('reference/Lohnsteuer2026.xml', 'utf8');
  const pap = compilePap(xml);
  const result = pap.run({
    LZZ: 2,                   // monthly
    RE4: 300000,              // 3000 EUR in Cent
    STKL: 1,
    KVZ: 1.7,                 // 1.7% Zusatzbeitrag
    KRV: 0,
    PVZ: 1,                   // childless
    PVS: 0,                   // not Sachsen
    R: 0,                     // no church
    ZKF: 0,
    af: 0,
    f: 1.0,
    AJAHR: 2026,
    PKV: 0,
    ALV: 0,
    PKPV: 0,
    PKPVAGZ: 0,
    PVA: 0,
    JFREIB: 0,
    JHINZU: 0,
    LZZFREIB: 0,
    LZZHINZU: 0,
    MBV: 0,
    SONSTB: 0,
    STERBE: 0,
    VBEZ: 0,
    VBEZM: 0,
    VBEZS: 0,
    VBS: 0,
    VKAPA: 0,
    VMT: 0,
    LZZJFREIB: 0,
    LZZJHINZU: 0,
    JRE4: 0,
    JRE4ENT: 0,
    JVBEZ: 0,
    ZMVB: 0,
  });
  // LSTLZZ is monthly Lohnsteuer in cents
  console.log('LSTLZZ:', result.LSTLZZ, 'EUR:', (result.LSTLZZ / 100).toFixed(2));
  assert.ok(result.LSTLZZ > 25000 && result.LSTLZZ < 40000,
    `Expected ~250-400 EUR monthly LSt for 3000 Brutto, got ${result.LSTLZZ / 100}`);
});
