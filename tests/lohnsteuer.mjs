

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePap } from './pap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  BE: 0.09, BB: 0.09, HB: 0.09, HH: 0.09, HE: 0.09,
  MV: 0.09, NI: 0.09, NW: 0.09, RP: 0.09, SL: 0.09,
  SN: 0.09, ST: 0.09, SH: 0.09, TH: 0.09,
};

export function calculateLohnsteuer(p) {
  const year = p.year || 2026;
  const pap = getPap(year);
  const kkZusatzPct = (p.kkZusatzbeitrag != null ? p.kkZusatzbeitrag : 0.017) * 100;

  const inputs = {

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

export { getPap };
