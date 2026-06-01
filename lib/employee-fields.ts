import type { DateFmt } from "@/lib/date-format";

export type EmployeeField = {
  path: string;
  label: string;
  type?: "text" | "checkbox";
  description?: string;
  example?: string;
  date?: DateFmt;
};
export type EmployeeFieldGroup = { title: string; fields: EmployeeField[] };

export const EMPLOYEE_FIELD_GROUPS: EmployeeFieldGroup[] = [
  {
    title: "Mitarbeiter",
    fields: [
      { path: "mitarbeiter.name", label: "Name", description: "Employee full name.", example: "Max Mustermann" },
      { path: "mitarbeiter.strasse", label: "Straße + Nr.", description: "Street and house number.", example: "Hauptstr. 12" },
      { path: "mitarbeiter.plzOrt", label: "PLZ + Ort", description: "Postal code and city.", example: "10115 Berlin" },
    ],
  },
  {
    title: "Kopfdaten",
    fields: [
      { path: "meta.persNr", label: "Personal-Nr.", description: "Internal personnel number; also shown in the slip's number box.", example: "1122672" },
      { path: "meta.geburtsdatum", label: "Geburtsdatum", description: "Date of birth. The age used by the calculation is derived from this automatically.", example: "25.07.1989", date: "ddmmyy" },
      { path: "meta.stKl", label: "Steuerklasse", description: "German income-tax class, 1–6. Used both on the slip and to drive the automatic tax calculation.", example: "1" },
      { path: "meta.konfession", label: "Konfession", description: "Religious denomination for church tax (blank = none). Drives the church-tax calculation.", example: "rk" },
      { path: "meta.svNummer", label: "SV-Nummer", description: "Social-insurance number.", example: "65250789E018" },
      { path: "meta.krankenkasse", label: "Krankenkasse", description: "Health-insurance fund name.", example: "Techniker Krankenkasse" },
      { path: "meta.kkProzent", label: "KK % (gesamt)", description: "TOTAL health-insurance rate printed on the slip (≈ 14,6 % + your fund's surcharge). Display only — not the calculation input.", example: "17,29" },
      { path: "meta.pgrs", label: "PGRS", description: "Personengruppenschlüssel — person-group key.", example: "1111" },
      { path: "meta.bgrs", label: "BGRS", description: "Beitragsgruppenschlüssel — contribution-group key.", example: "2" },
      { path: "meta.eintritt", label: "Eintritt", description: "Employment start date.", example: "02.03.2026", date: "ddmmyy" },
      { path: "meta.austritt", label: "Austritt", description: "Employment end date (blank if ongoing).", example: "02.04.2026", date: "ddmmyy" },
      { path: "meta.steuerId", label: "Steuer-ID", description: "Tax identification number (IdNr).", example: "69814453022" },
      { path: "meta.abtNr", label: "Abt.-Nr.", description: "Department number.", example: "1" },
      { path: "meta.stTg", label: "St.-Tg", description: "Tax days in the period (usually 30 for a full month). Printed on the slip; defaults to 30.", example: "30" },
      { path: "meta.umSvTg", label: "Um.-SV-Tg", description: "Social-insurance days in the period (usually 30). Printed on the slip; defaults to 30.", example: "30" },
    ],
  },
  {
    title: "Automatik (Steuer/SV-Berechnung)",
    fields: [
      { path: "automatik.enabled", label: "Automatik aktiv", type: "checkbox", description: "When on, the slip auto-computes Lohnsteuer + SV from the values below (plus Steuerklasse, Geburtsdatum and Konfession above)." },
      { path: "automatik.bundesland", label: "Bundesland (z.B. BE)", description: "Federal state code (affects church tax / Sachsen PV).", example: "BE" },
      { path: "automatik.kkZusatzbeitrag", label: "KK-Zusatzbeitrag %", description: "Your health fund's ADDITIONAL surcharge on top of the standard 14,6 % — this is the calculation input (not the total KK % above).", example: "2,69" },
      { path: "automatik.kinder", label: "Kinder", description: "Number of children (affects PV rate).", example: "0" },
      { path: "automatik.midijob", label: "Midijob", type: "checkbox", description: "Apply the Midijob reduced contribution base (for low monthly earnings)." },
      { path: "automatik.westOst", label: "West/Ost (W/O)", description: "Region for the RV/AV ceiling.", example: "W" },
      { path: "automatik.freibetragMonatlich", label: "Freibetrag mtl.", description: "Monthly tax allowance.", example: "0" },
    ],
  },
];

// flat list of every field path the form renders
export const EMPLOYEE_FIELD_PATHS = EMPLOYEE_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.path),
);

// path -> stored format, for fields rendered as date pickers
export const EMPLOYEE_DATE_PATHS: Record<string, DateFmt> = Object.fromEntries(
  EMPLOYEE_FIELD_GROUPS.flatMap((g) =>
    g.fields.filter((f) => f.date).map((f) => [f.path, f.date as DateFmt]),
  ),
);
