import { describe, it, expect } from "vitest";
import { buildPayslipData, monthNumber } from "@/lib/payslip-data";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("buildPayslipData", () => {
  it("parses period, print meta and brutto rows", () => {
    const data = buildPayslipData(
      fd({
        monat: "März",
        jahr: "2026",
        druckdatum: "31.03.2026",
        blatt: "1",
        brutto_json: JSON.stringify([
          { lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "119,00", faktor: "16,69", prozent: "", st: "L", sv: "L", gb: "J" },
        ]),
      }),
    );
    expect(data.zeitraum).toEqual({ monat: "März", jahr: "2026" });
    expect(data.meta.druckdatum).toBe("31.03.2026");
    expect(data.meta.blatt).toBe("1");
    expect(data.brutto).toHaveLength(1);
    expect(data.brutto[0].lohnart).toBe("100");
    expect(data.steuer).toEqual([]);
    expect(data.verdienst).toEqual({});
  });

  it("defaults to empty rows when brutto_json is absent or invalid", () => {
    expect(buildPayslipData(fd({ monat: "Mai", jahr: "2026" })).brutto).toEqual([]);
    expect(buildPayslipData(fd({ monat: "Mai", jahr: "2026", brutto_json: "oops" })).brutto).toEqual([]);
  });
});

describe("monthNumber", () => {
  it("maps German month names to 1-12", () => {
    expect(monthNumber("Januar")).toBe(1);
    expect(monthNumber("März")).toBe(3);
    expect(monthNumber("Dezember")).toBe(12);
    expect(monthNumber("nope")).toBe(0);
  });
});
