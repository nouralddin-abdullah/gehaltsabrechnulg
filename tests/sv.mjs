// SV (Sozialversicherung) calculation engine for the Gehaltsabrechnung tool.
// Source of truth; inlined into gehaltsabrechnung.html.
//
// All rates and ceilings are for Kalenderjahr 2024. Update yearly.
// Sources:
//   - GKV-Spitzenverband (KV-Beitragssatz + Zusatzbeitrag-Liste)
//   - Deutsche Rentenversicherung (RV-Beitragssatz)
//   - Bundesagentur für Arbeit (AV-Beitragssatz)
//   - Bundesgesetz (PV + Beitragsbemessungsgrenzen)
//
// LIMITATIONS:
//   - Pflichtversicherung in der gesetzlichen KV assumed (no Privatversicherung).
//   - Insolvenzgeldumlage, U1, U2 not modeled (employer-only, doesn't affect AN net).
//   - Studenten-/Werkstudenten-Beitragsermäßigung not modeled.
//   - Multi-job complications (StKl 6 with prior contributions) not modeled.

export const SV_RATES_2024 = {
  // General rates (each split 50/50 between AG and AN unless noted)
  kv_general: 0.146,            // 14.6%
  rv:         0.186,            // 18.6%
  av:         0.026,            // 2.6%
  pv_base:    0.034,            // 3.4% (AN share is 1.7%, AG share is 1.7%)

  // PV adjustments (AN side only)
  pv_zuschlag_kinderlos: 0.006, // +0.6% AN if childless and ≥23
  pv_abschlag_per_kind:  0.0025,// -0.25% AN per child from #2 to #5 if any child under 25
  pv_abschlag_max_kids:  4,     // cap on the deduction (#2..#5)

  // Sachsen exception: AN pays 0.5% extra of PV, AG pays 0.5% less
  sachsen_pv_an_shift: 0.005,

  // Ceilings (Beitragsbemessungsgrenze) per month
  bbg_kv_pv_month:      5175.00, // = 62,100 / 12, West and Ost
  bbg_rv_av_west_month: 7550.00, // = 90,600 / 12
  bbg_rv_av_ost_month:  7450.00, // = 89,400 / 12 (Ost merges with West in 2025)

  // Midijob (Übergangsbereich) 2024
  midijob_untergrenze: 538.01,  // Brutto/month, just above the Minijob top
  midijob_obergrenze:  2000.00, // Brutto/month
  // F factor: for 2024 ≈ 0.6700 (recalculated yearly by BMAS)
  midijob_F: 0.6700,
};

function _capMonthly(brutto, bbg) {
  return Math.min(brutto, bbg);
}

/**
 * Compute the AN share of PV for one employee.
 * @param {object} p
 * @param {number} p.kinder      Number of children under 25 (alive). 0 = childless.
 * @param {number} [p.age]       Employee age (years). Defaults to 30 (>= 23).
 * @param {string} [p.bundesland] DE state code (e.g. 'BY', 'SN'). 'SN' = Sachsen.
 * @returns {number} AN share rate (e.g. 0.017, 0.023, 0.0145)
 */
export function pvAnRate({ kinder, age = 30, bundesland = '' } = {}) {
  const R = SV_RATES_2024;
  let rate = R.pv_base / 2; // 1.7% base AN share
  if (age >= 23 && (kinder || 0) === 0) {
    rate += R.pv_zuschlag_kinderlos; // +0.6%
  } else if (kinder >= 2) {
    const deductions = Math.min(kinder - 1, R.pv_abschlag_max_kids);
    rate -= R.pv_abschlag_per_kind * deductions;
  }
  if (bundesland === 'SN') {
    rate += R.sachsen_pv_an_shift; // Sachsen AN pays an extra 0.5%
  }
  return Math.round(rate * 1e6) / 1e6;
}

/**
 * Compute the AN-Bemessungsgrundlage for a Midijob.
 * Returns the regular Brutto if outside Midijob range.
 */
export function midijobRedBmg(brutto, year = 2024) {
  const R = SV_RATES_2024;
  const U = R.midijob_untergrenze;
  const O = R.midijob_obergrenze;
  const F = R.midijob_F;
  if (brutto < U || brutto > O) return brutto;
  // rdBmg = F*U + ((O - F*U) / (O - U)) * (G - U)
  const rd = F * U + ((O - F * U) / (O - U)) * (brutto - U);
  return Math.round(rd * 100) / 100;
}

/**
 * Compute all four SV-Beiträge for a single month.
 *
 * @param {object} p
 * @param {number} p.brutto      Monthly Brutto in EUR.
 * @param {number} p.kinder      Number of children under 25.
 * @param {number} [p.age]       Age in years.
 * @param {string} [p.bundesland] DE state code (e.g. 'BY', 'SN').
 * @param {boolean} [p.midijob]  If true and brutto is in Midijob range, apply Gleitzone.
 * @param {number} [p.kkZusatzbeitrag] Krankenkasse-specific Zusatzbeitrag, e.g. 0.017 for 1.7%.
 *                                     Total full rate; 50/50 split applied below.
 * @param {boolean} [p.westOst]  'W' (default) or 'O' for old/new Bundesländer (affects RV/AV BBG).
 * @returns {{
 *   kvBrutto:number, rvBrutto:number, avBrutto:number, pvBrutto:number,
 *   kvBeitrag:number, rvBeitrag:number, avBeitrag:number, pvBeitrag:number,
 *   kinderlosenZuschlag:boolean,
 * }}
 */
export function calculateSV(p) {
  const R = SV_RATES_2024;
  const brutto = +p.brutto;
  const kinder = +p.kinder || 0;
  const kkZusatz = p.kkZusatzbeitrag != null ? +p.kkZusatzbeitrag : 0.017;
  const isOst = p.westOst === 'O';

  const bbgKvPv = R.bbg_kv_pv_month;
  const bbgRvAv = isOst ? R.bbg_rv_av_ost_month : R.bbg_rv_av_west_month;

  // Caps the "Brutto" reported per branch.
  const kvBrutto = _capMonthly(brutto, bbgKvPv);
  const pvBrutto = _capMonthly(brutto, bbgKvPv);
  const rvBrutto = _capMonthly(brutto, bbgRvAv);
  const avBrutto = _capMonthly(brutto, bbgRvAv);

  // AN-Bemessung for Midijob
  const useMidijob = !!p.midijob &&
    brutto >= R.midijob_untergrenze && brutto <= R.midijob_obergrenze;
  const anKvBase = useMidijob ? midijobRedBmg(kvBrutto) : kvBrutto;
  const anPvBase = useMidijob ? midijobRedBmg(pvBrutto) : pvBrutto;
  const anRvBase = useMidijob ? midijobRedBmg(rvBrutto) : rvBrutto;
  const anAvBase = useMidijob ? midijobRedBmg(avBrutto) : avBrutto;

  // AN rates
  const anKvRate = R.kv_general / 2 + kkZusatz / 2; // 7.3% + half of Zusatzbeitrag
  const anRvRate = R.rv / 2;                         // 9.3%
  const anAvRate = R.av / 2;                         // 1.3%
  const anPvRate = pvAnRate({ kinder, age: p.age, bundesland: p.bundesland });

  const kvBeitrag = Math.round(anKvBase * anKvRate * 100) / 100;
  const rvBeitrag = Math.round(anRvBase * anRvRate * 100) / 100;
  const avBeitrag = Math.round(anAvBase * anAvRate * 100) / 100;
  const pvBeitrag = Math.round(anPvBase * anPvRate * 100) / 100;

  const kinderlosenZuschlag = (p.age == null || p.age >= 23) && kinder === 0;

  return {
    kvBrutto, rvBrutto, avBrutto, pvBrutto,
    kvBeitrag, rvBeitrag, avBeitrag, pvBeitrag,
    kinderlosenZuschlag,
  };
}
