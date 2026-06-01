export type Company = {
  id: string;
  owner_id: string;
  name: string;
  firma: string;
  mandant: string;
  roc_code: string;
  default_template: string;
  created_at: string;
};

export type EmployeeData = {
  mitarbeiter: { name: string; strasse: string; plzOrt: string };
  // person-stable slip meta fields (excludes mandant/rocCode -> company,
  // and druckdatum/blatt -> payslip)
  meta: Record<string, string>;
  automatik: {
    enabled: boolean;
    steuerklasse: number;
    faktor: string;
    konfession: string;
    bundesland: string;
    freibetragMonatlich: string;
    kkZusatzbeitrag: string;
    kinder: number;
    age: number;
    midijob: boolean;
    westOst: string;
  };
};

export type Employee = {
  id: string;
  owner_id: string;
  company_id: string | null;
  name: string;
  data: EmployeeData;
  created_at: string;
};
