import { describe, it, expect } from "vitest";
import { sumComputedTotals } from "@/lib/cumulative";
import type { ComputedTotals } from "@/lib/db/types";

const m = (over: Partial<ComputedTotals>): ComputedTotals => ({
  gesamtBrutto: 0, steuerBrutto: 0, svBrutto: 0, lohnsteuer: 0,
  kirchensteuer: 0, soli: 0, kvBeitrag: 0, rvBeitrag: 0, avBeitrag: 0,
  pvBeitrag: 0, auszahlung: 0, ...over,
});

describe("sumComputedTotals", () => {
  it("sums each field and counts months", () => {
    const r = sumComputedTotals([
      m({ gesamtBrutto: 2855.29, lohnsteuer: 254.58, auszahlung: 2000.01 }),
      m({ gesamtBrutto: 3000.0, lohnsteuer: 300.0, auszahlung: 2100.0 }),
      m({ gesamtBrutto: 1000.5, lohnsteuer: 50.5, auszahlung: 800.5 }),
    ]);
    expect(r.monatszahl).toBe(3);
    expect(r.gesamtBrutto).toBeCloseTo(6855.79, 2);
    expect(r.lohnsteuer).toBeCloseTo(605.08, 2);
    expect(r.auszahlung).toBeCloseTo(4900.51, 2);
  });

  it("returns a zeroed total with monatszahl 0 for an empty list", () => {
    const r = sumComputedTotals([]);
    expect(r.monatszahl).toBe(0);
    expect(r.gesamtBrutto).toBe(0);
  });
});
