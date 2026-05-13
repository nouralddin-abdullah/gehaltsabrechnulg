import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDE, formatDE,
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
