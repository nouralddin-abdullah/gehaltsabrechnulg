// Replace the old hand-rolled Lohnsteuer block in gehaltsabrechnung.html with
// the PAP interpreter + embedded XML.
//
// Run: node scripts/embed-pap-in-html.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const HTML = 'gehaltsabrechnung.html';
const html = fs.readFileSync(HTML, 'utf8');

const startMarker = '    // ===== Inlined from tests/lohnsteuer.mjs — keep in sync =====';
const endMarker = '    // ===== End of inlined lohnsteuer.mjs =====';

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);
if (startIdx < 0 || endIdx < 0) {
  console.error('Markers not found in HTML');
  process.exit(1);
}
const before = html.slice(0, startIdx);
const after = html.slice(endIdx + endMarker.length);

// Generate the inline PAP snippet
const inline = execSync('node scripts/inline-pap.mjs').toString('utf8');

// Wrap the inline content with the existing markers and adapter shim that
// gives the rest of the HTML a `calculateLohnsteuer(p)` function.
const adapter = `
    const BUNDESLAND_KSTRATE = {
      BW: 0.08, BY: 0.08,
      BE: 0.09, BB: 0.09, HB: 0.09, HH: 0.09, HE: 0.09,
      MV: 0.09, NI: 0.09, NW: 0.09, RP: 0.09, SL: 0.09,
      SN: 0.09, ST: 0.09, SH: 0.09, TH: 0.09,
    };
    function calculateLohnsteuer(p) {
      const kkZusatzPct = (p.kkZusatzbeitrag != null ? p.kkZusatzbeitrag : 0.017) * 100;
      const inputs = {
        LZZ: 2, RE4: Math.round((+p.brutto) * 100), STKL: +p.steuerklasse || 1,
        KVZ: kkZusatzPct, KRV: 0,
        PVZ: p.kinderlos ? 1 : 0,
        PVA: +p.pvKinderAbschlag || 0,
        PVS: p.sachsen ? 1 : 0,
        R: p.konfession ? 1 : 0,
        ZKF: 0,
        af: p.faktor && +p.faktor > 0 && +p.faktor < 1 ? 1 : 0,
        f: p.faktor && +p.faktor > 0 && +p.faktor < 1 ? +p.faktor : 1.0,
        AJAHR: 0, PKV: 0, ALV: 0, PKPV: 0, PKPVAGZ: 0,
        JFREIB: 0, JHINZU: 0,
        LZZFREIB: Math.round(((+p.freibetragMonatlich) || 0) * 100),
        LZZHINZU: 0, MBV: 0, SONSTB: 0, STERBE: 0,
        VBEZ: 0, VBEZM: 0, VBEZS: 0, VBS: 0, VKAPA: 0, VMT: 0,
        LZZJFREIB: 0, LZZJHINZU: 0, JRE4: 0, JRE4ENT: 0, JVBEZ: 0,
        ZMVB: 0, VJAHR: 0,
      };
      const out = PAP_2026.run(inputs);
      const lohnsteuer = Math.round(out.LSTLZZ || 0) / 100;
      const soli = Math.round(out.SOLZLZZ || 0) / 100;
      const bk = Math.round(out.BK || 0) / 100;
      const kStRate = p.konfession ? (BUNDESLAND_KSTRATE[p.bundesland] || 0) : 0;
      const kirchensteuer = Math.round(bk * kStRate * 100) / 100;
      return { lohnsteuer, soli, kirchensteuer, steuerBrutto: +p.brutto };
    }`;

// Indent the inline snippet by 4 spaces to match HTML indentation
const indented = inline.split('\n').map(l => l ? '    ' + l : l).join('\n');

const newBlock = startMarker + '\n' + indented + adapter + '\n' + endMarker;
const newHtml = before + newBlock + after;

fs.writeFileSync(HTML, newHtml);
console.log('Embedded. Old block:', endIdx + endMarker.length - startIdx, 'bytes ->',
  newBlock.length, 'bytes');
