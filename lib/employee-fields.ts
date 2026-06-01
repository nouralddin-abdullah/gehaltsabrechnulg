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
      { path: "meta.geburtsdatum", label: "Geburtsdatum", description: "Date of birth.", example: "25.07.1989", date: "ddmmyy" },
      { path: "meta.stKl", label: "Steuerklasse", description: "German income-tax class, 1–6.", example: "1" },
      { path: "meta.konfession", label: "Konfession", description: "Religious denomination for church tax (blank = none).", example: "rk" },
      { path: "meta.svNummer", label: "SV-Nummer", description: "Social-insurance number.", example: "65250789E018" },
      { path: "meta.krankenkasse", label: "Krankenkasse", description: "Health-insurance fund name.", example: "Techniker Krankenkasse" },
      { path: "meta.kkProzent", label: "KK %", description: "Total health-insurance rate shown on the slip.", example: "17,29" },
      { path: "meta.pgrs", label: "PGRS", description: "Personengruppenschlüssel — person-group key.", example: "1111" },
      { path: "meta.bgrs", label: "BGRS", description: "Beitragsgruppenschlüssel — contribution-group key.", example: "2" },
      { path: "meta.eintritt", label: "Eintritt", description: "Employment start date.", example: "02.03.2026", date: "ddmmyy" },
      { path: "meta.austritt", label: "Austritt", description: "Employment end date (blank if ongoing).", example: "02.04.2026", date: "ddmmyy" },
      { path: "meta.steuerId", label: "Steuer-ID", description: "Tax identification number (IdNr).", example: "69814453022" },
      { path: "meta.abtNr", label: "Abt.-Nr.", description: "Department number.", example: "1" },
    ],
  },
  {
    title: "Automatik (Steuer/SV-Berechnung)",
    fields: [
      { path: "automatik.enabled", label: "Automatik aktiv", type: "checkbox", description: "When on, the slip auto-computes Lohnsteuer + SV from the values below." },
      { path: "automatik.steuerklasse", label: "Steuerklasse (1-6)", description: "Tax class used by the auto calculation.", example: "1" },
      { path: "automatik.bundesland", label: "Bundesland (z.B. BE)", description: "Federal state code (affects church tax / Sachsen PV).", example: "BE" },
      { path: "automatik.kkZusatzbeitrag", label: "KK-Zusatzbeitrag %", description: "Health-insurance additional contribution rate.", example: "2,69" },
      { path: "automatik.kinder", label: "Kinder", description: "Number of children (affects PV rate).", example: "0" },
      { path: "automatik.age", label: "Alter", description: "Age (affects childless PV surcharge ≥23).", example: "36" },
      { path: "automatik.midijob", label: "Midijob", type: "checkbox", description: "Apply the Midijob reduced contribution base." },
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
