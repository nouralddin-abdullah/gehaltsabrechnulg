export type EmployeeField = {
  path: string;
  label: string;
  type?: "text" | "checkbox";
};
export type EmployeeFieldGroup = { title: string; fields: EmployeeField[] };

export const EMPLOYEE_FIELD_GROUPS: EmployeeFieldGroup[] = [
  {
    title: "Mitarbeiter",
    fields: [
      { path: "mitarbeiter.name", label: "Name" },
      { path: "mitarbeiter.strasse", label: "Straße + Nr." },
      { path: "mitarbeiter.plzOrt", label: "PLZ + Ort" },
    ],
  },
  {
    title: "Kopfdaten",
    fields: [
      { path: "meta.persNr", label: "Personal-Nr." },
      { path: "meta.geburtsdatum", label: "Geburtsdatum" },
      { path: "meta.stKl", label: "Steuerklasse" },
      { path: "meta.konfession", label: "Konfession" },
      { path: "meta.svNummer", label: "SV-Nummer" },
      { path: "meta.krankenkasse", label: "Krankenkasse" },
      { path: "meta.kkProzent", label: "KK %" },
      { path: "meta.pgrs", label: "PGRS" },
      { path: "meta.bgrs", label: "BGRS" },
      { path: "meta.eintritt", label: "Eintritt" },
      { path: "meta.austritt", label: "Austritt" },
      { path: "meta.steuerId", label: "Steuer-ID" },
      { path: "meta.persNrBox", label: "Pers.-Nr. (Box)" },
      { path: "meta.abtNr", label: "Abt.-Nr." },
    ],
  },
  {
    title: "Automatik (Steuer/SV-Berechnung)",
    fields: [
      { path: "automatik.enabled", label: "Automatik aktiv", type: "checkbox" },
      { path: "automatik.steuerklasse", label: "Steuerklasse (1-6)" },
      { path: "automatik.bundesland", label: "Bundesland (z.B. BE)" },
      { path: "automatik.kkZusatzbeitrag", label: "KK-Zusatzbeitrag %" },
      { path: "automatik.kinder", label: "Kinder" },
      { path: "automatik.age", label: "Alter" },
      { path: "automatik.midijob", label: "Midijob", type: "checkbox" },
      { path: "automatik.westOst", label: "West/Ost (W/O)" },
      { path: "automatik.freibetragMonatlich", label: "Freibetrag mtl." },
    ],
  },
];

// flat list of every field path the form renders
export const EMPLOYEE_FIELD_PATHS = EMPLOYEE_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.path),
);
