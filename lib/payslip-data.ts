import type { BruttoRow } from "@/lib/slip-state";
import type { PayslipData } from "@/lib/db/types";

export const GERMAN_MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
] as const;

export function monthNumber(name: string): number {
  const i = GERMAN_MONTHS.findIndex(
    (m) => m.toLowerCase() === String(name).trim().toLowerCase(),
  );
  return i < 0 ? 0 : i + 1;
}

function parseBrutto(raw: string): BruttoRow[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as BruttoRow[]) : [];
  } catch {
    return [];
  }
}

export function buildPayslipData(formData: FormData): PayslipData {
  const monat = String(formData.get("monat") ?? "");
  const jahr = String(formData.get("jahr") ?? "");
  const brutto = parseBrutto(String(formData.get("brutto_json") ?? ""));
  return {
    zeitraum: { monat, jahr },
    brutto,
    steuer: [],
    sv: [],
    verdienst: {},
    nettoBezuege: [],
    bank: {
      svAgAnteil: String(formData.get("svAgAnteil") ?? ""),
      zusAgKosten: String(formData.get("zusAgKosten") ?? ""),
      gesamtkosten: String(formData.get("gesamtkosten") ?? ""),
    },
    meta: {
      druckdatum: String(formData.get("druckdatum") ?? ""),
      blatt: String(formData.get("blatt") ?? "1"),
    },
  };
}
