import { describe, it, expect } from "vitest";
import { toDateInput, fromDateInput, ageFromDob } from "@/lib/date-format";

describe("ddmmyy <-> ISO", () => {
  it("stored ddmmyy to date-input ISO", () => {
    expect(toDateInput("250789", "ddmmyy")).toBe("1989-07-25");
    expect(toDateInput("020326", "ddmmyy")).toBe("2026-03-02");
    expect(toDateInput("", "ddmmyy")).toBe("");
  });
  it("date-input ISO to stored ddmmyy", () => {
    expect(fromDateInput("1989-07-25", "ddmmyy")).toBe("250789");
    expect(fromDateInput("2026-03-02", "ddmmyy")).toBe("020326");
    expect(fromDateInput("", "ddmmyy")).toBe("");
  });
});

describe("TT.MM.JJJJ <-> ISO", () => {
  it("stored dotted to ISO and back", () => {
    expect(toDateInput("31.03.2026", "dmy-dot")).toBe("2026-03-31");
    expect(fromDateInput("2026-03-31", "dmy-dot")).toBe("31.03.2026");
  });
  it("passes through unparseable values unchanged on read", () => {
    expect(toDateInput("garbage", "ddmmyy")).toBe("");
  });
});

describe("ageFromDob", () => {
  it("computes whole-years age as of the payslip period", () => {
    // born 02.10.1997
    expect(ageFromDob("021097", 2026, 3)).toBe(28); // March 2026: birthday not reached
    expect(ageFromDob("021097", 2026, 11)).toBe(29); // November 2026: birthday passed
    // born 25.07.1989
    expect(ageFromDob("250789", 2026, 3)).toBe(36);
  });
  it("returns 0 for empty/unparseable DOB", () => {
    expect(ageFromDob("", 2026, 3)).toBe(0);
    expect(ageFromDob("garbage", 2026, 3)).toBe(0);
  });
});
