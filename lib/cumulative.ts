import type { ComputedTotals } from "@/lib/db/types";
import type { CumulativeTotals } from "@/lib/slip-state";

const FIELDS: (keyof ComputedTotals)[] = [
  "gesamtBrutto", "steuerBrutto", "svBrutto", "lohnsteuer", "kirchensteuer",
  "soli", "kvBeitrag", "rvBeitrag", "avBeitrag", "pvBeitrag", "auszahlung",
];

const round2 = (n: number) => Math.round(n * 100) / 100;

// True sum of the actual saved months — not a single-month projection.
export function sumComputedTotals(list: ComputedTotals[]): CumulativeTotals {
  const acc: ComputedTotals = {
    gesamtBrutto: 0, steuerBrutto: 0, svBrutto: 0, lohnsteuer: 0,
    kirchensteuer: 0, soli: 0, kvBeitrag: 0, rvBeitrag: 0, avBeitrag: 0,
    pvBeitrag: 0, auszahlung: 0,
  };
  for (const t of list) {
    for (const f of FIELDS) acc[f] = round2(acc[f] + (t[f] || 0));
  }
  return { ...acc, monatszahl: list.length };
}
