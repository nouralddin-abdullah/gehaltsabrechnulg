"use client";

import { useState } from "react";
import type { BruttoRow } from "@/lib/slip-state";
import { GERMAN_MONTHS } from "@/lib/payslip-data";
import { createMonth } from "@/app/employees/[id]/payslips/actions";

const EMPTY_ROW: BruttoRow = {
  lohnart: "", bezeichnung: "", einheit: "", menge: "", faktor: "",
  prozent: "", st: "L", sv: "L", gb: "J",
};

export function MonthForm({
  employeeId,
  templateId,
}: {
  employeeId: string;
  templateId: string;
}) {
  const [rows, setRows] = useState<BruttoRow[]>([{ ...EMPTY_ROW }]);

  const update = (i: number, key: keyof BruttoRow, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const action = createMonth.bind(null, employeeId, templateId);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="brutto_json" value={JSON.stringify(rows)} />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-neutral-300">
          Abrechnungszeitraum
        </legend>
        <div className="flex gap-3">
          <select name="monat" defaultValue="" className="cmp-input flex-1" required>
            <option value="" disabled>
              Monat …
            </option>
            {GERMAN_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input name="jahr" placeholder="Jahr" defaultValue="2026" className="cmp-input w-28" required />
        </div>
        <div className="flex gap-3">
          <input name="druckdatum" placeholder="Druckdatum (TT.MM.JJJJ)" className="cmp-input flex-1" />
          <input name="blatt" placeholder="Blatt" defaultValue="1" className="cmp-input w-20" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-300">
          Brutto-Bezüge
        </legend>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[5rem_1fr_4rem_5rem_5rem_3rem_3rem] gap-2">
            <input value={r.lohnart} onChange={(e) => update(i, "lohnart", e.target.value)} placeholder="LA" className="cmp-input" />
            <input value={r.bezeichnung} onChange={(e) => update(i, "bezeichnung", e.target.value)} placeholder="Bezeichnung" className="cmp-input" />
            <input value={r.einheit} onChange={(e) => update(i, "einheit", e.target.value)} placeholder="Einheit" className="cmp-input" />
            <input value={r.menge} onChange={(e) => update(i, "menge", e.target.value)} placeholder="Menge" className="cmp-input" />
            <input value={r.faktor} onChange={(e) => update(i, "faktor", e.target.value)} placeholder="Faktor" className="cmp-input" />
            <input value={r.st} onChange={(e) => update(i, "st", e.target.value)} placeholder="St" className="cmp-input" />
            <input value={r.sv} onChange={(e) => update(i, "sv", e.target.value)} placeholder="SV" className="cmp-input" />
          </div>
        ))}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { ...EMPTY_ROW }])}
            className="text-xs text-neutral-400 underline"
          >
            + Add row
          </button>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows((rs) => rs.slice(0, -1))}
              className="text-xs text-red-400 underline"
            >
              − Remove last
            </button>
          )}
        </div>
      </fieldset>

      <button className="self-start rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900">
        Save month
      </button>
    </form>
  );
}
