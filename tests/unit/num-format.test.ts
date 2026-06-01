import { describe, it, expect } from "vitest";
import { parseDE, formatDE } from "@/lib/num-format";

describe("parseDE", () => {
  it("parses German-formatted numbers", () => {
    expect(parseDE("1.986,11")).toBeCloseTo(1986.11, 2);
    expect(parseDE("3.565,00")).toBeCloseTo(3565, 2);
    expect(parseDE("16,69")).toBeCloseTo(16.69, 2);
    expect(parseDE("")).toBe(0);
    expect(parseDE("abc")).toBe(0);
  });
});

describe("formatDE", () => {
  it("formats numbers in German style with two decimals", () => {
    expect(formatDE(1986.11)).toBe("1.986,11");
    expect(formatDE(3565)).toBe("3.565,00");
    expect(formatDE(0)).toBe("0,00");
    expect(formatDE(-12.5)).toBe("-12,50");
    expect(formatDE(1234567.5)).toBe("1.234.567,50");
  });
});
