// Lohnsteuer (income tax) calculation engine.
// Backed by the official BMF Programmablaufplan (PAP) XML, executed via the
// generic PAP interpreter in tests/pap.mjs.
//
// Source of truth: https://www.bmf-steuerrechner.de/interface/pseudocodes.xhtml
// XML files live under reference/Lohnsteuer<year>.xml and are inlined into
// gehaltsabrechnung.html for fully-offline use.
//
// Why a wrapper instead of a direct call: this module presents a stable,
// year-agnostic API to the rest of the codebase. Internally, the year and XML
// are loaded once at module init time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePap } from './pap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Map known years to their XML file. Add new entries each January.
const PAP_FILES = {
  2025: path.join(__dirname, '..', 'reference', 'Lohnsteuer2025.xml'),
  2026: path.join(__dirname, '..', 'reference', 'Lohnsteuer2026.xml'),
};

const _papCache = {};
function getPap(year) {
  if (!_papCache[year]) {
    const file = PAP_FILES[year];
    if (!file) throw new Error(`No PAP XML registered for year ${year}. Add it to PAP_FILES.`);
    _papCache[year] = compilePap(fs.readFileSync(file, 'utf8'));
  }
  return _papCache[year];
}

const BUNDESLAND_KSTRATE = {
  BW: 0.08, BY: 0.08,
  // 9% everywhere else
  BE: 0.09, BB: 0.09, HB: 0.09, HH: 0.09, HE: 0.09,
  MV: 0.09, NI: 0.09, NW: 0.09, RP: 0.09, SL: 0.09,
  SN: 0.09, ST: 0.09, SH: 0.09, TH: 0.09,
};

/**
 * Compute Lohnsteuer + Soli + Kirchensteuer for a month, using the official
 * BMF PAP for the given year.
 *
 * @param {object} p
 * @param {number} p.brutto              Monthly Brutto in EUR.
 * @param {number} p.steuerklasse        1..6.
 * @param {number} [p.year]              Default 2026.
 * @param {number} [p.kkZusatzbeitrag]   KK-Zusatzbeitrag as a fraction (e.g. 0.017 for 1.7%).
 *                                        We pass the full rate; the PAP halves it internally.
 * @param {boolean} [p.kinderlos]        true if employee is childless ≥23 (Pflegeversicherung-Zuschlag).
 * @param {number} [p.pvKinderAbschlag]  Number of Pflegeversicherung child deductions (0..4).
 * @param {boolean} [p.sachsen]          true if in Sachsen (Pflegeversicherung-Sonderregel).
 * @param {string} [p.konfession]        'ev' | 'rk' | '' to indicate church tax.
 * @param {string} [p.bundesland]        DE state code (affects Kirchensteuersatz).
 * @param {number} [p.faktor]            StKl 4 Faktor (0..1).
 * @param {number} [p.freibetragMonatlich] EUR/month tax-free allowance (LZZFREIB).
 */
export function calculateLohnsteuer(p) {
  const year = p.year || 2026;
  const pap = getPap(year);
  const kkZusatzPct = (p.kkZusatzbeitrag != null ? p.kkZusatzbeitrag : 0.017) * 100;

  const inputs = {
    // Default-zero inputs (any not set explicitly)
    LZZ: 2,
    RE4: Math.round((+p.brutto) * 100),
    STKL: +p.steuerklasse || 1,
    KVZ: kkZusatzPct,
    KRV: 0,
    PVZ: p.kinderlos ? 1 : 0,
    PVA: +p.pvKinderAbschlag || 0,
    PVS: p.sachsen ? 1 : 0,
    R: p.konfession ? 1 : 0,
    ZKF: 0,
    af: p.faktor && +p.faktor > 0 && +p.faktor < 1 ? 1 : 0,
    f: p.faktor && +p.faktor > 0 && +p.faktor < 1 ? +p.faktor : 1.0,
    AJAHR: 0,
    PKV: 0,
    ALV: 0,
    PKPV: 0,
    PKPVAGZ: 0,
    JFREIB: 0,
    JHINZU: 0,
    LZZFREIB: Math.round(((+p.freibetragMonatlich) || 0) * 100),
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
    VJAHR: 0,
  };

  const out = pap.run(inputs);

  const lohnsteuer = Math.round((out.LSTLZZ || 0)) / 100;
  const soli = Math.round((out.SOLZLZZ || 0)) / 100;
  const bk = Math.round((out.BK || 0)) / 100;
  const kStRate = p.konfession && BUNDESLAND_KSTRATE[p.bundesland] || 0;
  const kirchensteuer = Math.round(bk * kStRate * 100) / 100;

  return { lohnsteuer, soli, kirchensteuer, steuerBrutto: +p.brutto };
}

// Re-export the PAP-driven calculator as the public surface. Internal helpers
// used by tests:
export { getPap };
