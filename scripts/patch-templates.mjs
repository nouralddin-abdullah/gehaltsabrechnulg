// Idempotent codemod: ports the original shell's autoVerdienst() into the 11
// cumulative templates and makes renderJahreswerte() prefer an injected
// state.cumulative. datev-highcopy is intentionally excluded (single-month).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "templates");
const FILES = [
  "datev-classic.html", "lexware-classic.html", "sage-classic.html",
  "viper-classic.html", "neon-classic.html", "atlas-classic.html",
  "aurora-classic.html", "ledger-classic.html", "slate-classic.html",
  "prism-classic.html", "quartz-classic.html",
];

const AUTO_VERDIENST = `      function autoVerdienst() {
        if (!state.automatik || !state.automatik.enabled) return;
        const t = computeTotals(state);
        const steuer = state.steuer && state.steuer[0] ? state.steuer[0] : {};
        const sv = state.sv && state.sv[0] ? state.sv[0] : {};
        const v = state.verdienst || (state.verdienst = {});
        v.gesamtBrutto = formatDE(t.gesamtBrutto);
        v.steuerBrutto = formatDE(sumSteuerBrutto(state.brutto || []));
        v.svBrutto = formatDE(sumSVBrutto(state.brutto || []));
        v.lohnsteuer = steuer.lohnsteuer || "";
        v.kirchensteuer = steuer.kirchensteuer || "";
        v.soli = steuer.soli || "";
        v.kvBeitrag = sv.kvBeitrag || "";
        v.rvBeitrag = sv.rvBeitrag || "";
        v.avBeitrag = sv.avBeitrag || "";
        v.pvBeitrag = sv.pvBeitrag || "";
        let stFrei = 0;
        for (const r of state.brutto || []) {
          if (/^F$/i.test(r.st || "")) stFrei += computeRowBetrag(r);
        }
        v.steuerfreieBezuege = stFrei > 0 ? formatDE(stFrei) : "";
      }

`;

const CUMULATIVE_BRANCH = `const c = state.cumulative;
        const y = c
          ? {
              monatszahl: c.monatszahl,
              gesamtBrutto: c.gesamtBrutto, steuerBrutto: c.steuerBrutto,
              svBrutto: c.svBrutto, lohnsteuer: c.lohnsteuer,
              kirchensteuer: c.kirchensteuer, soli: c.soli,
              kvBeitrag: c.kvBeitrag, rvBeitrag: c.rvBeitrag,
              avBeitrag: c.avBeitrag, pvBeitrag: c.pvBeitrag,
              auszahlung: c.auszahlung,
            }
          : computeYearTotals(state);`;

let patched = 0;
for (const file of FILES) {
  const path = join(DIR, file);
  let src = readFileSync(path, "utf8");

  if (src.includes("function autoVerdienst")) {
    console.log(`skip (already patched): ${file}`);
    continue;
  }

  // 1) insert autoVerdienst() definition before renderJahreswerte()
  if (!src.includes("function renderJahreswerte() {")) {
    throw new Error(`${file}: missing renderJahreswerte() anchor`);
  }
  src = src.replace(
    "      function renderJahreswerte() {",
    AUTO_VERDIENST + "      function renderJahreswerte() {",
  );

  // 2) cumulative branch in place of the single-month projection
  if (!src.includes("const y = computeYearTotals(state);")) {
    throw new Error(`${file}: missing computeYearTotals anchor`);
  }
  src = src.replace("const y = computeYearTotals(state);", CUMULATIVE_BRANCH);

  // 3) call autoVerdienst() between renderSteuerUndSV() and renderVerdienst()
  const callRe = /(renderSteuerUndSV\(\);)(\s*\n\s*)(renderVerdienst\(\);)/;
  if (!callRe.test(src)) {
    throw new Error(`${file}: missing render() call site`);
  }
  src = src.replace(callRe, `$1$2autoVerdienst();$2$3`);

  writeFileSync(path, src, "utf8");
  patched++;
  console.log(`patched: ${file}`);
}
console.log(`\nDone. Patched ${patched} file(s).`);
