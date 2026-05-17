

export const SV_RATES_2026 = {
  kv_general: 0.146,
  rv:         0.186,
  av:         0.026,
  pv_base:    0.036,

  pv_zuschlag_kinderlos: 0.006,
  pv_abschlag_per_kind:  0.0025,
  pv_abschlag_max_kids:  4,

  sachsen_pv_an_shift: 0.005,

  bbg_kv_pv_month:      5812.50,
  bbg_rv_av_west_month: 8450.00,
  bbg_rv_av_ost_month:  8450.00,

  midijob_untergrenze: 603.01,
  midijob_obergrenze:  2000.00,

  midijob_F: 0.6700,

  kkZusatzbeitragDurchschnitt: 0.029,
};

function _capMonthly(brutto, bbg) {
  return Math.min(brutto, bbg);
}

export function pvAnRate({ kinder, age = 30, bundesland = '' } = {}) {
  const R = SV_RATES_2026;
  let rate = R.pv_base / 2;
  if (age >= 23 && (kinder || 0) === 0) {
    rate += R.pv_zuschlag_kinderlos;
  } else if (kinder >= 2) {
    const deductions = Math.min(kinder - 1, R.pv_abschlag_max_kids);
    rate -= R.pv_abschlag_per_kind * deductions;
  }
  if (bundesland === 'SN') {
    rate += R.sachsen_pv_an_shift;
  }
  return Math.round(rate * 1e6) / 1e6;
}

export function midijobRedBmg(brutto, year = 2026) {
  const R = SV_RATES_2026;
  const U = R.midijob_untergrenze;
  const O = R.midijob_obergrenze;
  const F = R.midijob_F;
  if (brutto < U || brutto > O) return brutto;

  const rd = F * U + ((O - F * U) / (O - U)) * (brutto - U);
  return Math.round(rd * 100) / 100;
}

export function calculateSV(p) {
  const R = SV_RATES_2026;
  const brutto = +p.brutto;
  const kinder = +p.kinder || 0;
  const kkZusatz = p.kkZusatzbeitrag != null ? +p.kkZusatzbeitrag : R.kkZusatzbeitragDurchschnitt;
  const isOst = p.westOst === 'O';

  const bbgKvPv = R.bbg_kv_pv_month;
  const bbgRvAv = isOst ? R.bbg_rv_av_ost_month : R.bbg_rv_av_west_month;

  const kvBrutto = _capMonthly(brutto, bbgKvPv);
  const pvBrutto = _capMonthly(brutto, bbgKvPv);
  const rvBrutto = _capMonthly(brutto, bbgRvAv);
  const avBrutto = _capMonthly(brutto, bbgRvAv);

  const useMidijob = !!p.midijob &&
    brutto >= R.midijob_untergrenze && brutto <= R.midijob_obergrenze;
  const anKvBase = useMidijob ? midijobRedBmg(kvBrutto) : kvBrutto;
  const anPvBase = useMidijob ? midijobRedBmg(pvBrutto) : pvBrutto;
  const anRvBase = useMidijob ? midijobRedBmg(rvBrutto) : rvBrutto;
  const anAvBase = useMidijob ? midijobRedBmg(avBrutto) : avBrutto;

  const anKvRate = R.kv_general / 2 + kkZusatz / 2;
  const anRvRate = R.rv / 2;
  const anAvRate = R.av / 2;
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
