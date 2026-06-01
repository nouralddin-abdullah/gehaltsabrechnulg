import { describe, it, expect } from "vitest";
import { sumComputedTotals } from "@/lib/cumulative";
import type { ComputedTotals } from "@/lib/db/types";

// Month 1 is the real DATEV slip "Gehaltsabrechnung 10_2023" (Oktober 2023):
//   Gesamt-Brutto 3.565,00 · Lohnsteuer 79,25+441,75=521,00 · RV 155,21+181,73=336,94
//   Auszahlung 2.707,06.
// Months 2 and 3 are fabricated to exercise the cumulative total.
const oktober: ComputedTotals = {
  gesamtBrutto: 3565, steuerBrutto: 3565, svBrutto: 3523.26,
  lohnsteuer: 521, kirchensteuer: 0, soli: 0,
  kvBeitrag: 0, rvBeitrag: 336.94, avBeitrag: 0, pvBeitrag: 0,
  auszahlung: 2707.06,
};
const november: ComputedTotals = {
  gesamtBrutto: 3000, steuerBrutto: 3000, svBrutto: 3000,
  lohnsteuer: 450, kirchensteuer: 0, soli: 0,
  kvBeitrag: 0, rvBeitrag: 279, avBeitrag: 0, pvBeitrag: 0,
  auszahlung: 2300,
};
const dezember: ComputedTotals = {
  gesamtBrutto: 4000, steuerBrutto: 4000, svBrutto: 4000,
  lohnsteuer: 600, kirchensteuer: 0, soli: 0,
  kvBeitrag: 0, rvBeitrag: 372, avBeitrag: 0, pvBeitrag: 0,
  auszahlung: 3000,
};

describe("payslip totals — real October slip", () => {
  it("the real month is internally consistent (brutto − tax − sv = payout)", () => {
    const net =
      oktober.gesamtBrutto -
      oktober.lohnsteuer -
      (oktober.kvBeitrag + oktober.rvBeitrag + oktober.avBeitrag + oktober.pvBeitrag);
    expect(net).toBeCloseTo(oktober.auszahlung, 2); // 3565 − 521 − 336,94 = 2707,06
  });

  it("the cumulative is the true sum across the three months", () => {
    const total = sumComputedTotals([oktober, november, dezember]);
    expect(total.monatszahl).toBe(3);
    expect(total.gesamtBrutto).toBeCloseTo(10565, 2);
    expect(total.lohnsteuer).toBeCloseTo(1571, 2);
    expect(total.rvBeitrag).toBeCloseTo(987.94, 2);
    expect(total.auszahlung).toBeCloseTo(8007.06, 2);
  });
});
