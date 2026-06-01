import { describe, it, expect } from "vitest";
import { assembleState } from "@/lib/assembleState";
import type { Company, Employee, Payslip } from "@/lib/db/types";

const company: Company = {
  id: "c1", owner_id: "u1", name: "ACME",
  firma: "ACME GmbH*Str 1*10115 Berlin",
  mandant: "133267/30605/00107", mandant_box: "30605", roc_code: "R0C9",
  default_template: "datev-classic", created_at: "",
};

const employee: Employee = {
  id: "e1", owner_id: "u1", company_id: "c1", name: "Max Mustermann",
  created_at: "",
  data: {
    mitarbeiter: { name: "Max Mustermann", strasse: "Weg 2", plzOrt: "10115 Berlin" },
    meta: { persNr: "778899", steuerId: "12345678901", abtNr: "7" },
    automatik: {
      enabled: true, steuerklasse: 1, faktor: "", konfession: "",
      bundesland: "BE", freibetragMonatlich: "", kkZusatzbeitrag: "2,69",
      kinder: 0, age: 30, midijob: false, westOst: "W",
    },
  },
};

const payslip: Payslip = {
  id: "p1", owner_id: "u1", employee_id: "e1", year: 2026, month: 3,
  status: "draft", serial_number: null, issued_at: null,
  template_id: "datev-classic", computed_totals: null,
  created_at: "", updated_at: "",
  data: {
    zeitraum: { monat: "März", jahr: "2026" },
    brutto: [{ lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "119,00", faktor: "16,69", prozent: "", st: "L", sv: "L", gb: "J" }],
    steuer: [], sv: [], verdienst: {}, nettoBezuege: [], bank: {},
    meta: { druckdatum: "31.03.2026", blatt: "1" },
  },
};

describe("assembleState", () => {
  it("maps person, company codes, period and brutto rows", () => {
    const s = assembleState(company, employee, payslip);
    expect(s.firma).toBe("ACME GmbH*Str 1*10115 Berlin");
    expect(s.mitarbeiter.name).toBe("Max Mustermann");
    expect(s.zeitraum).toEqual({ monat: "März", jahr: "2026" });
    expect(s.brutto).toHaveLength(1);
    expect(s.meta.mandant).toBe("133267/30605/00107");
    expect(s.meta.mandantBox).toBe("30605");
    expect(s.meta.rocCode).toBe("R0C9");
    expect(s.meta.druckdatum).toBe("31.03.2026");
    expect(s.meta.blatt).toBe("1");
    expect(s.automatik.enabled).toBe(true);
  });

  it("unifies Pers-Nr: one stored value fills both persNr and the box", () => {
    const s = assembleState(company, employee, payslip);
    expect(s.meta.persNr).toBe("778899");
    expect(s.meta.persNrBox).toBe("778899");
  });

  it("injects the serial into bank.code only when provided", () => {
    expect(assembleState(company, employee, payslip).bank.code).toBe("");
    const issued = assembleState(company, employee, payslip, { serial: 80012 });
    expect(issued.bank.code).toBe("80012");
  });

  it("passes cumulative through when provided", () => {
    const cumulative = {
      monatszahl: 2, gesamtBrutto: 100, steuerBrutto: 90, svBrutto: 90,
      lohnsteuer: 10, kirchensteuer: 0, soli: 0, kvBeitrag: 5, rvBeitrag: 5,
      avBeitrag: 1, pvBeitrag: 1, auszahlung: 70,
    };
    const s = assembleState(company, employee, payslip, { cumulative });
    expect(s.cumulative).toEqual(cumulative);
  });

  it("tolerates a null company", () => {
    const s = assembleState(null, employee, payslip);
    expect(s.firma).toBe("");
    expect(s.meta.mandant).toBe("");
  });
});
