import type {
  BruttoRow, SteuerRow, SvRow, NettoRow, VerdienstBlock, BankBlock,
} from "@/lib/slip-state";

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  firma: string;
  mandant: string;
  mandant_box: string;
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

// Snapshot of the template-computed figures for one month (numbers, not strings).
export type ComputedTotals = {
  gesamtBrutto: number; steuerBrutto: number; svBrutto: number;
  lohnsteuer: number; kirchensteuer: number; soli: number;
  kvBeitrag: number; rvBeitrag: number; avBeitrag: number; pvBeitrag: number;
  auszahlung: number;
};

// The month's variable inputs only (stable fields live on the employee/company).
export type PayslipData = {
  zeitraum: { monat: string; jahr: string };
  brutto: BruttoRow[];
  steuer: SteuerRow[];
  sv: SvRow[];
  verdienst: Partial<VerdienstBlock>;
  nettoBezuege: NettoRow[];
  bank: Partial<BankBlock>;
  meta: Record<string, string>; // per-month overrides, e.g. druckdatum, blatt
};

export type Payslip = {
  id: string;
  owner_id: string;
  employee_id: string;
  year: number;
  month: number;
  status: "draft" | "issued";
  serial_number: number | null;
  issued_at: string | null;
  template_id: string;
  data: PayslipData;
  computed_totals: ComputedTotals | null;
  created_at: string;
  updated_at: string;
};
