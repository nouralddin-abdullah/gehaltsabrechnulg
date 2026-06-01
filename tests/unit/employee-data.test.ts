import { describe, it, expect } from "vitest";
import { buildEmployeeData, filterEmployees } from "@/lib/employee-data";
import type { Employee } from "@/lib/db/types";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("buildEmployeeData", () => {
  it("nests dotted field names and coerces checkbox + number fields", () => {
    const data = buildEmployeeData(
      form({
        "mitarbeiter.name": "Max",
        "meta.persNr": "1001",
        "automatik.enabled": "on",
        "automatik.steuerklasse": "1",
        "automatik.kinder": "2",
        "automatik.age": "30",
      }),
    );
    expect(data.mitarbeiter.name).toBe("Max");
    expect(data.meta.persNr).toBe("1001");
    expect(data.automatik.enabled).toBe(true);
    expect(data.automatik.steuerklasse).toBe(1);
    expect(data.automatik.kinder).toBe(2);
    expect(data.automatik.midijob).toBe(false); // unchecked checkbox absent
  });

  it("captures employee bank name and IBAN", () => {
    const data = buildEmployeeData(
      form({ "bank.name": "Deutsche Bank", "bank.iban": "DE97 1007" }),
    );
    expect(data.bank?.name).toBe("Deutsche Bank");
    expect(data.bank?.iban).toBe("DE97 1007");
  });
});

describe("buildEmployeeData date conversion", () => {
  it("converts ISO date inputs to the stored ddmmyy format", () => {
    const data = buildEmployeeData(
      form({
        "mitarbeiter.name": "Max",
        "meta.geburtsdatum": "1989-07-25",
        "meta.eintritt": "2026-03-02",
      }),
    );
    expect(data.meta.geburtsdatum).toBe("250789");
    expect(data.meta.eintritt).toBe("020326");
  });

  it("leaves non-date meta fields untouched", () => {
    expect(
      buildEmployeeData(form({ "meta.steuerId": "69814453022" })).meta.steuerId,
    ).toBe("69814453022");
  });
});

describe("filterEmployees", () => {
  const list = [
    { id: "1", name: "Max Mustermann" },
    { id: "2", name: "Erika Beispiel" },
  ] as Employee[];

  it("returns all when query is empty", () => {
    expect(filterEmployees(list, "")).toHaveLength(2);
  });
  it("matches case-insensitively by name", () => {
    expect(filterEmployees(list, "erika").map((e) => e.id)).toEqual(["2"]);
  });
});
