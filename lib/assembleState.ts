import type { Company, Employee, Payslip } from "@/lib/db/types";
import type {
  SlipState, SlipMeta, BankBlock, VerdienstBlock, CumulativeTotals,
} from "@/lib/slip-state";
import { ageFromDob } from "@/lib/date-format";

const EMPTY_META: SlipMeta = {
  persNr: "", geburtsdatum: "", stKl: "", faktor: "",
  kiFrbtr: "", konfession: "", freibetragJ: "", freibetragM: "",
  dba: "", midijob: "", stTg: "",
  vjUrlUeb: "", urlAnspr: "", urlTgGen: "", resturlaub: "",
  anwTage: "", urlaubTage: "", krankhTg: "", fehlzTage: "",
  anwStd: "", urlaubStd: "", krankhStd: "", fehlzStd: "",
  zeitlohnStd: "", ueberstd: "", bezStd: "",
  svNummer: "", krankenkasse: "", kkProzent: "",
  pgrs: "", bgrs: "", umSvTg: "",
  eintritt: "", austritt: "", steuerId: "", mfb: "",
  rocCode: "", mandant: "", druckdatum: "", blatt: "",
  persNrBox: "", abtNr: "", bn: "", mandantBox: "",
};

const EMPTY_VERDIENST: VerdienstBlock = {
  nachberechnungVorjahr: false,
  gesamtBrutto: "", steuerBrutto: "", lohnsteuer: "", kirchensteuer: "",
  soli: "", steuerfreieBezuege: "", pVerstZukSich: "", pfaendungRest: "",
  darlehenRest: "", svBrutto: "", kvBeitrag: "", rvBeitrag: "",
  avBeitrag: "", pvBeitrag: "", vwlGesamt: "", kugAuszahlung: "",
};

const EMPTY_BANK: BankBlock = {
  name: "", iban: "", svAgAnteil: "", zusAgKosten: "", gesamtkosten: "", code: "",
};

export function assembleState(
  company: Company | null,
  employee: Employee,
  payslip: Payslip,
  opts: { serial?: number | null; cumulative?: CumulativeTotals | null } = {},
): SlipState {
  const d = payslip.data;
  const empMeta = employee.data.meta ?? {};

  // Person-stable meta from the employee, company codes, then per-month overrides.
  const meta: SlipMeta = {
    ...EMPTY_META,
    ...empMeta,
    rocCode: company?.roc_code ?? "",
    mandant: company?.mandant ?? "",
    mandantBox: company?.mandant_box ?? "",
    ...d.meta, // per-month overrides (druckdatum, blatt, ...)
  };
  // Pers-Nr is one value shown in two places.
  meta.persNr = empMeta.persNr ?? "";
  meta.persNrBox = empMeta.persNr ?? "";
  // Tax/SV days default to a full month (30) when not set.
  if (!meta.stTg) meta.stTg = "30";
  if (!meta.umSvTg) meta.umSvTg = "30";

  const serial = opts.serial ?? null;
  const bank: BankBlock = {
    ...EMPTY_BANK,
    ...d.bank,
    code: serial != null ? String(serial) : (d.bank?.code ?? ""),
  };

  const state: SlipState = {
    meta,
    firma: company?.firma ?? "",
    mitarbeiter: employee.data.mitarbeiter,
    zeitraum: d.zeitraum,
    brutto: d.brutto ?? [],
    steuer: d.steuer ?? [],
    sv: d.sv ?? [],
    verdienst: { ...EMPTY_VERDIENST, ...d.verdienst },
    nettoBezuege: d.nettoBezuege ?? [],
    bank,
    hinweiseZurAbrechnung: "",
    // Engine inputs are derived from the single employee fields (no duplicates):
    // Steuerklasse + Konfession come from the Kopfdaten, Age from the Geburtsdatum.
    automatik: {
      ...employee.data.automatik,
      steuerklasse:
        Number(empMeta.stKl) || employee.data.automatik.steuerklasse || 1,
      age: ageFromDob(empMeta.geburtsdatum ?? "", payslip.year, payslip.month),
      konfession: empMeta.konfession ?? "",
    },
  };
  if (opts.cumulative) state.cumulative = opts.cumulative;
  return state;
}
