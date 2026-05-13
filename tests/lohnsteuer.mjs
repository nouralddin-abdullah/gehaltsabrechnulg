// Lohnsteuer (income tax) calculation engine.
// Approximates the BMF Programmablaufplan (PAP) for Kalenderjahr 2024.
// Source of truth: https://www.bmf-steuerrechner.de/ — verify yearly.
//
// Inputs: monthly Brutto + Steuerklasse + Konfession + Bundesland.
// Output: monthly Lohnsteuer + Solidaritätszuschlag + Kirchensteuer.
//
// LIMITATIONS — verify any payslip against an official source before filing:
//   - Faithfully implements Steuerklassen 1, 2, 3, 4 (no Faktor), 4 with Faktor.
//   - Steuerklassen 5 and 6 use a simplified approximation and should be verified
//     against bmf-steuerrechner.de for the specific case.
//   - Sonstige Bezüge (Einmalzahlungen, Abfindungen), Pauschalierung,
//     mehrjährige Versteuerung, Nachberechnung are NOT modeled — leave the slip
//     in manual mode for those cases.
//   - Vorsorgepauschale uses simplified flat rates (typical case). Exact value
//     depends on whether the employee is PKV/GKV and on the actual KV-Zusatzbeitrag.

export const TAX_CONSTANTS_2024 = {
  grundfreibetrag: 11604,
  werbungskostenpauschbetrag: 1230,
  sonderausgabenpauschbetrag: 36,
  entlastungsbetrag_alleinerziehende: 4260, // StKl 2

  // §32a EStG 2024 tariff breakpoints
  tarif_eckwerte: [11604, 17005, 66760, 277825],
  tarif_progressiv_1_a: 922.98,
  tarif_progressiv_1_b: 1400,
  tarif_progressiv_2_a: 181.19,
  tarif_progressiv_2_b: 2397,
  tarif_progressiv_2_c: 1025.38,
  tarif_linear_1_rate: 0.42,
  tarif_linear_1_subtract: 10602.13,
  tarif_linear_2_rate: 0.45,
  tarif_linear_2_subtract: 18936.88,

  // Soli 2024
  soli_rate: 0.055,
  soli_freigrenze_normal: 18130,  // Jahres-Lohnsteuer threshold (StKl 1/2/4/5/6)
  soli_freigrenze_stkl3:  36260,  // doubled for StKl 3
  soli_milderungs_rate: 0.119,    // marginal rate in Milderungszone

  // SV rates used for Vorsorgepauschale calculation (annual percentages)
  vorsorge_rv_an_rate: 0.093,     // 9.3%
  vorsorge_kv_avg_rate: 0.0815,   // 7.3% + half of 1.7% Zusatzbeitrag (assumed avg)
  vorsorge_pv_rate: 0.017,        // 1.7%

  // Beitragsbemessungsgrenzen (annual)
  bbg_kv_pv_year: 62100,
  bbg_rv_av_west_year: 90600,
  bbg_rv_av_ost_year: 89400,
};

// §32a EStG: Einkommensteuer auf das zu versteuernde Einkommen (annual)
export function einkommensteuer(zvE) {
  const T = TAX_CONSTANTS_2024;
  if (zvE <= T.tarif_eckwerte[0]) return 0;
  if (zvE <= T.tarif_eckwerte[1]) {
    const y = (zvE - T.tarif_eckwerte[0]) / 10000;
    return Math.floor((T.tarif_progressiv_1_a * y + T.tarif_progressiv_1_b) * y);
  }
  if (zvE <= T.tarif_eckwerte[2]) {
    const z = (zvE - T.tarif_eckwerte[1]) / 10000;
    return Math.floor((T.tarif_progressiv_2_a * z + T.tarif_progressiv_2_b) * z + T.tarif_progressiv_2_c);
  }
  if (zvE <= T.tarif_eckwerte[3]) {
    return Math.floor(T.tarif_linear_1_rate * zvE - T.tarif_linear_1_subtract);
  }
  return Math.floor(T.tarif_linear_2_rate * zvE - T.tarif_linear_2_subtract);
}

function _vorsorgepauschale(annualBrutto) {
  const T = TAX_CONSTANTS_2024;
  const rvBase = Math.min(annualBrutto, T.bbg_rv_av_west_year);
  const kvBase = Math.min(annualBrutto, T.bbg_kv_pv_year);
  const teilRV = rvBase * T.vorsorge_rv_an_rate;
  const teilKV = kvBase * T.vorsorge_kv_avg_rate;
  const teilPV = kvBase * T.vorsorge_pv_rate;
  return teilRV + teilKV + teilPV;
}

function _zvE({ annualBrutto, steuerklasse, jahresfreibetrag = 0 }) {
  const T = TAX_CONSTANTS_2024;
  let zvE = annualBrutto;
  zvE -= T.werbungskostenpauschbetrag;
  zvE -= T.sonderausgabenpauschbetrag;
  zvE -= _vorsorgepauschale(annualBrutto);
  if (steuerklasse === 2) {
    zvE -= T.entlastungsbetrag_alleinerziehende;
  }
  zvE -= jahresfreibetrag;
  return Math.max(0, Math.floor(zvE));
}

/**
 * Compute Jahres-Lohnsteuer for given annual Brutto and Steuerklasse.
 * Returns 0 for StKl with no withholding obligation when zvE is below threshold.
 */
export function jahresLohnsteuer({ annualBrutto, steuerklasse, faktor, jahresfreibetrag = 0 }) {
  const T = TAX_CONSTANTS_2024;
  const sk = +steuerklasse || 1;

  if (sk === 3) {
    // Splittingverfahren: tariff applied to half the income, then doubled.
    const zvE = _zvE({ annualBrutto, steuerklasse: 1, jahresfreibetrag });
    return 2 * einkommensteuer(Math.floor(zvE / 2));
  }

  if (sk === 5) {
    // Approximation: zvE without Grundfreibetrag.
    // PAP-konform wäre: VFRB1=tariff(1.25*zvE) - tariff(0.75*zvE); we use a
    // simpler shift that overestimates slightly for low incomes.
    const zvE = _zvE({ annualBrutto, steuerklasse: 1, jahresfreibetrag });
    const shifted = zvE + T.grundfreibetrag;
    // StKl 5 owes approximately the tariff differential of the household income;
    // here we use 2x of the marginal tariff at 1.25*zvE — this is rough.
    const a = einkommensteuer(Math.floor(zvE * 1.25));
    const b = einkommensteuer(Math.floor(zvE * 0.75));
    return Math.max(0, a - b);
  }

  if (sk === 6) {
    // No Grundfreibetrag — effectively shifts the tariff up.
    const zvE = _zvE({ annualBrutto, steuerklasse: 1, jahresfreibetrag });
    return einkommensteuer(zvE + T.grundfreibetrag);
  }

  // StKl 1, 2, 4
  const zvE = _zvE({ annualBrutto, steuerklasse: sk, jahresfreibetrag });
  let tax = einkommensteuer(zvE);

  // StKl 4 mit Faktor: Faktor < 1 reduces the tax (≈ Splittingvorteil).
  if (sk === 4 && faktor && faktor > 0 && faktor < 1) {
    tax = Math.floor(tax * faktor);
  }
  return tax;
}

/**
 * Compute Solidaritätszuschlag for a given annual Lohnsteuer and Steuerklasse.
 * Honors the Freigrenze (18.130 EUR / 36.260 EUR) and the Milderungszone.
 */
export function jahresSoli({ jahresLst, steuerklasse }) {
  const T = TAX_CONSTANTS_2024;
  const sk = +steuerklasse || 1;
  const freigrenze = sk === 3 ? T.soli_freigrenze_stkl3 : T.soli_freigrenze_normal;
  if (jahresLst <= freigrenze) return 0;
  const full = jahresLst * T.soli_rate;
  // Milderungszone: marginal rate of 11.9% (≈ soli_milderungs_rate) above the
  // Freigrenze; capped at the full 5.5%.
  const milderung = (jahresLst - freigrenze) * T.soli_milderungs_rate;
  return Math.min(full, milderung);
}

/**
 * Compute Kirchensteuer rate based on Bundesland and Konfession.
 * 8% in Bayern (BY) and Baden-Württemberg (BW); 9% elsewhere.
 * Returns 0 if Konfession is empty / "--" / "ka".
 */
export function kirchensteuerRate({ bundesland, konfession }) {
  if (!konfession || konfession === '--' || konfession === 'ka') return 0;
  return (bundesland === 'BY' || bundesland === 'BW') ? 0.08 : 0.09;
}

/**
 * Compute one month's Lohnsteuer + Soli + Kirchensteuer.
 *
 * @param {object} p
 * @param {number} p.brutto         Monthly Brutto in EUR.
 * @param {number|string} p.steuerklasse  1..6 (number or string).
 * @param {number} [p.faktor]       StKl 4 Faktor (0..1).
 * @param {number} [p.freibetragMonatlich] EUR/month, e.g. ELStAM Freibetrag.
 * @param {string} [p.konfession]   'ev' | 'rk' | 'ak' | '' | ...
 * @param {string} [p.bundesland]   'BY' | 'BW' | 'NW' | ... (DE state code)
 * @returns {{
 *   lohnsteuer:number, soli:number, kirchensteuer:number,
 *   steuerBrutto:number,
 *   jahresLohnsteuer:number,
 *   zvE:number,
 *   note:string,
 * }}
 */
export function calculateLohnsteuer(p) {
  const brutto = +p.brutto;
  const steuerklasse = +p.steuerklasse || 1;
  const freibetragMonatlich = +p.freibetragMonatlich || 0;
  const jahresfreibetrag = freibetragMonatlich * 12;
  const annualBrutto = brutto * 12;

  const jahresLst = jahresLohnsteuer({
    annualBrutto,
    steuerklasse,
    faktor: p.faktor,
    jahresfreibetrag,
  });

  const jSoli = jahresSoli({ jahresLst, steuerklasse });

  const kStRate = kirchensteuerRate({
    bundesland: p.bundesland,
    konfession: p.konfession,
  });
  const jKst = jahresLst * kStRate;

  const lohnsteuer = Math.round((jahresLst / 12) * 100) / 100;
  const soli = Math.round((jSoli / 12) * 100) / 100;
  const kirchensteuer = Math.round((jKst / 12) * 100) / 100;

  const zvE = _zvE({ annualBrutto, steuerklasse, jahresfreibetrag });

  const note = (steuerklasse === 5 || steuerklasse === 6)
    ? `Approximation für Steuerklasse ${steuerklasse} — bitte mit DATEV/BMF verifizieren.`
    : '';

  return {
    lohnsteuer, soli, kirchensteuer,
    steuerBrutto: brutto,
    jahresLohnsteuer: jahresLst,
    zvE,
    note,
  };
}
