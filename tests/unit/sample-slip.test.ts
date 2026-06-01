import { describe, it, expect } from "vitest";
import { sampleSlip } from "@/lib/fixtures/sample-slip";

describe("sample slip fixture", () => {
  it("has the employer and employee", () => {
    expect(sampleSlip.firma).toContain("ALLPOWER");
    expect(sampleSlip.mitarbeiter.name).toBe("Mohammed El-Korazatti");
  });

  it("has brutto rows flagged into Gesamt-Brutto", () => {
    expect(sampleSlip.brutto.length).toBeGreaterThan(0);
    expect(sampleSlip.brutto.some((r) => r.gb === "J")).toBe(true);
  });

  it("has the auto-tax engine enabled", () => {
    expect(sampleSlip.automatik.enabled).toBe(true);
  });
});
