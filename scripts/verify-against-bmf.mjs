

import { calculateLohnsteuer } from '../tests/lohnsteuer.mjs';

const REFERENCES_2024_STKL1 = [
  { brutto: 1000, lstExpected:   0 },
  { brutto: 1500, lstExpected:   0 },
  { brutto: 2000, lstExpected:  88 },
  { brutto: 2500, lstExpected: 175 },
  { brutto: 3000, lstExpected: 282 },
  { brutto: 3500, lstExpected: 405 },
  { brutto: 4000, lstExpected: 539 },
  { brutto: 5000, lstExpected: 838 },
  { brutto: 6000, lstExpected: 1173 },
];

const TOLERANCE_EUR = 15;

function checkAgainstTable() {
  let fails = 0;
  console.log('--- Verifying against published Lohnsteuertabelle 2024 (StKl 1) ---');
  for (const c of REFERENCES_2024_STKL1) {
    const r = calculateLohnsteuer({ brutto: c.brutto, steuerklasse: 1 });
    const diff = r.lohnsteuer - c.lstExpected;
    const ok = Math.abs(diff) <= TOLERANCE_EUR;
    const sym = ok ? 'OK ' : 'FAIL';
    console.log(
      `  ${sym}  Brutto ${String(c.brutto).padStart(5)} EUR  →  ` +
      `LSt = ${r.lohnsteuer.toFixed(2).padStart(8)}  ` +
      `(table: ${c.lstExpected})  Δ ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`
    );
    if (!ok) fails++;
  }
  console.log(`  ${REFERENCES_2024_STKL1.length - fails}/${REFERENCES_2024_STKL1.length} within ±${TOLERANCE_EUR} EUR\n`);
  return fails;
}

function bmfUrl({ brutto, steuerklasse, year = 2024 }) {

  const re4Cent = Math.round(brutto * 12 * 100);
  const params = new URLSearchParams({
    code: `ext${year}Version1`,
    LZZ: '1',
    RE4: String(re4Cent),
    STKL: String(steuerklasse),
    KVZ: '17',
    KRV: '0',
    PVZ: '1',
    PVS: '0',
    R: '0',
    ZKF: '0',
    af: '0',
    f: '1.0',
    AJAHR: String(year),
  });
  return `https://www.bmf-steuerrechner.de/interface/${year}Version1.xhtml?${params}`;
}

async function callBMF(c) {
  const url = bmfUrl(c);
  const res = await fetch(url, { headers: { Accept: 'application/xml' } });
  const xml = await res.text();

  const m = xml.match(/name="LSTLZZ"[^>]*value="(\d+)"/);
  if (!m) throw new Error(`BMF XML missing LSTLZZ: ${xml.slice(0, 200)}`);
  const annualLstCent = +m[1];
  return annualLstCent / 100 / 12;
}

async function checkAgainstBMF() {
  console.log('--- Verifying against BMF web service ---');
  let fails = 0;
  for (const c of REFERENCES_2024_STKL1.slice(2)) {
    try {
      const mine = calculateLohnsteuer({ brutto: c.brutto, steuerklasse: 1 }).lohnsteuer;
      const theirs = await callBMF({ brutto: c.brutto, steuerklasse: 1 });
      const diff = mine - theirs;
      const ok = Math.abs(diff) <= TOLERANCE_EUR;
      console.log(
        `  ${ok ? 'OK ' : 'FAIL'}  Brutto ${String(c.brutto).padStart(5)}  ` +
        `mine ${mine.toFixed(2)}  BMF ${theirs.toFixed(2)}  Δ ${diff.toFixed(2)}`
      );
      if (!ok) fails++;
    } catch (e) {
      console.log(`  ERR  Brutto ${c.brutto}: ${e.message}`);
      fails++;
    }
  }
  return fails;
}

const useBMF = process.argv.includes('--bmf');

let failures = checkAgainstTable();
if (useBMF) {
  failures += await checkAgainstBMF();
}

console.log(`\nTotal failures: ${failures}`);
process.exit(failures > 0 ? 1 : 0);
