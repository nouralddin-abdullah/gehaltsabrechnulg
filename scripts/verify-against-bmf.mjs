// Compare our embedded Lohnsteuer engine against:
//   1) Published Lohnsteuertabelle 2024 (monthly, StKl 1, no Konfession).
//      These are hand-typed reference values from the public BMF tables.
//   2) (Optional) The BMF web service at bmf-steuerrechner.de.
//
// Usage:
//   node scripts/verify-against-bmf.mjs            # local table check only
//   node scripts/verify-against-bmf.mjs --bmf      # also call BMF web service
//
// CORS does not apply here — Node is the HTTP client, not the browser.
//
// If --bmf is enabled and the BMF endpoint format has changed, edit `bmfUrl()`
// below. The published interface description is at:
//   https://www.bmf-steuerrechner.de/interface/

import { calculateLohnsteuer } from '../tests/lohnsteuer.mjs';

// Reference values: 2024 Lohnsteuertabelle, Monatslohn, StKl 1, no Konfession,
// no Freibetrag, allgemeine KV with Zusatzbeitrag 1.7%, no Midijob, kein Kind.
// These are typical published values. Tolerance: ±15 EUR (our model uses a
// simplified Vorsorgepauschale).
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

// BMF web service caller. Tries a GET interface; adjust if BMF changes format.
//
// Known interface (2024Version1):
//   GET https://www.bmf-steuerrechner.de/interface/2024Version1.xhtml
//        ?code=ext2024Version1
//        &LZZ=<1=Jahr|2=Monat|3=Woche|4=Tag>
//        &RE4=<jahres-Brutto in EUR-Cent>
//        &STKL=<1..6>
//        &KVZ=<KV-Zusatzbeitrag in tenths-of-percent, e.g. 17 for 1.7%>
//        &KRV=<0|1|2>
//        &PVZ=<0|1>      // Pflegevers.-Zuschlag (childless)
//        &PVS=<0|1>      // Sachsen
//        &R=<0..1>       // Konfession Religionszugehörigkeit
//        &ZKF=<Kinderfreibetrag, halbe Anzahl>
//
function bmfUrl({ brutto, steuerklasse, year = 2024 }) {
  // We pass annual income (RE4) for clarity, LZZ=1.
  const re4Cent = Math.round(brutto * 12 * 100); // annual EUR -> cents
  const params = new URLSearchParams({
    code: `ext${year}Version1`,
    LZZ: '1',                                        // Lohnzahlungszeitraum: Jahr
    RE4: String(re4Cent),                            // Jahres-Brutto in Cent
    STKL: String(steuerklasse),
    KVZ: '17',                                       // 1.7% Zusatzbeitrag
    KRV: '0',
    PVZ: '1',                                        // Kinderlos
    PVS: '0',                                        // Nicht Sachsen
    R: '0',                                          // Keine Konfession
    ZKF: '0',                                        // Kinder
    af: '0',                                         // kein Faktor
    f: '1.0',
    AJAHR: String(year),
  });
  return `https://www.bmf-steuerrechner.de/interface/${year}Version1.xhtml?${params}`;
}

async function callBMF(c) {
  const url = bmfUrl(c);
  const res = await fetch(url, { headers: { Accept: 'application/xml' } });
  const xml = await res.text();
  // Service returns XML like <ausgaben><ausgabe name="LSTLZZ" value="..." .../></ausgaben>
  // Values are in EUR-Cent for monetary outputs.
  const m = xml.match(/name="LSTLZZ"[^>]*value="(\d+)"/);
  if (!m) throw new Error(`BMF XML missing LSTLZZ: ${xml.slice(0, 200)}`);
  const annualLstCent = +m[1];
  return annualLstCent / 100 / 12; // back to monthly EUR
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
