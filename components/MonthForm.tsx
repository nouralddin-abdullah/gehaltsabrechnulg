"use client";

import { useState } from "react";
import type { BruttoRow } from "@/lib/slip-state";
import type { Payslip } from "@/lib/db/types";
import { GERMAN_MONTHS } from "@/lib/payslip-data";
import { parseDE, formatDE } from "@/lib/num-format";
import { createMonth } from "@/app/(app)/employees/[id]/payslips/actions";

const EMPTY_ROW: BruttoRow = {
  lohnart: "", bezeichnung: "", einheit: "", menge: "", faktor: "",
  prozent: "", st: "L", sv: "L", gb: "J",
};

// Compact field style for the dense brutto grid.
const CELL =
  "rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-500";

// Betrag = Menge × Faktor (mirrors the template's computeRowBetrag for live preview).
function rowBetrag(r: BruttoRow): number {
  if (r.hinweis) return 0;
  return Math.round(parseDE(r.menge) * parseDE(r.faktor) * 100) / 100;
}

export function MonthForm({
  employeeId,
  templateId,
  action,
  payslip,
}: {
  employeeId: string;
  templateId: string;
  action?: (formData: FormData) => void;
  payslip?: Payslip; // when present, the form is pre-filled for editing
}) {
  const seedRows: BruttoRow[] = payslip?.data.brutto?.length
    ? payslip.data.brutto.map((r) =>
        r.hinweis ? { ...EMPTY_ROW, hinweis: true, text: r.text ?? "" } : { ...EMPTY_ROW, ...r },
      )
    : [{ ...EMPTY_ROW }];
  const [rows, setRows] = useState<BruttoRow[]>(seedRows);

  const update = (i: number, key: keyof BruttoRow, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const addHinweis = () =>
    setRows((rs) => [...rs, { ...EMPTY_ROW, hinweis: true, text: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const gesamtBrutto = rows.reduce(
    (sum, r) =>
      sum + (!r.hinweis && (r.gb || "").toUpperCase() === "J" ? rowBetrag(r) : 0),
    0,
  );

  const boundAction = action ?? createMonth.bind(null, employeeId, templateId);
  const COLS =
    "grid grid-cols-[4rem_minmax(7rem,1fr)_3.5rem_4.5rem_4.5rem_3.5rem_2.75rem_2.75rem_3rem_5.5rem_1.5rem] gap-1.5 items-center";

  return (
    <form action={boundAction} className="flex flex-col gap-6">
      <input type="hidden" name="brutto_json" value={JSON.stringify(rows)} />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-zinc-300">
          Abrechnungszeitraum
        </legend>
        <div className="flex gap-3">
          <select
            name="monat"
            defaultValue={payslip?.data.zeitraum.monat ?? ""}
            className="cmp-input flex-1"
            required
          >
            <option value="" disabled>
              Monat …
            </option>
            {GERMAN_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input name="jahr" placeholder="Jahr" defaultValue={payslip?.data.zeitraum.jahr ?? "2026"} className="cmp-input w-28" required />
        </div>
        <div className="flex gap-3">
          <input name="druckdatum" placeholder="Druckdatum (TT.MM.JJJJ)" defaultValue={payslip?.data.meta?.druckdatum ?? ""} className="cmp-input flex-1" />
          <input name="blatt" placeholder="Blatt" defaultValue={payslip?.data.meta?.blatt ?? "1"} className="cmp-input w-20" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5 overflow-x-auto">
        <legend className="text-sm font-medium text-zinc-300">Brutto-Bezüge</legend>

        {rows.map((r, i) =>
          r.hinweis ? (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={r.text ?? ""}
                onChange={(e) => update(i, "text", e.target.value)}
                placeholder="Hinweis (note line, e.g. „Nachberechnung 09/2023 …“)"
                className={`${CELL} w-full flex-1 italic`}
              />
              <button type="button" onClick={() => removeRow(i)} aria-label="Remove row" className="px-1 text-zinc-500 hover:text-red-400">
                ×
              </button>
            </div>
          ) : (
            <div key={i} className={COLS}>
              <input value={r.lohnart} onChange={(e) => update(i, "lohnart", e.target.value)} placeholder="LA" className={CELL} />
              <input value={r.bezeichnung} onChange={(e) => update(i, "bezeichnung", e.target.value)} placeholder="Bezeichnung" className={CELL} />
              <input value={r.einheit} onChange={(e) => update(i, "einheit", e.target.value)} placeholder="Einh." className={CELL} />
              <input value={r.menge} onChange={(e) => update(i, "menge", e.target.value)} placeholder="Menge" className={`${CELL} text-right`} />
              <input value={r.faktor} onChange={(e) => update(i, "faktor", e.target.value)} placeholder="Faktor" className={`${CELL} text-right`} />
              <input value={r.prozent ?? ""} onChange={(e) => update(i, "prozent", e.target.value)} placeholder="%" className={`${CELL} text-right`} />
              <input value={r.st} onChange={(e) => update(i, "st", e.target.value)} placeholder="St" className={`${CELL} text-center`} />
              <input value={r.sv} onChange={(e) => update(i, "sv", e.target.value)} placeholder="SV" className={`${CELL} text-center`} />
              <select value={r.gb} onChange={(e) => update(i, "gb", e.target.value)} aria-label="GB" className={`${CELL} text-center`}>
                <option value="J">J</option>
                <option value="N">N</option>
              </select>
              <span className="pr-1 text-right text-sm tabular-nums text-zinc-300">
                {formatDE(rowBetrag(r))}
              </span>
              <button type="button" onClick={() => removeRow(i)} aria-label="Remove row" className="px-1 text-zinc-500 hover:text-red-400">
                ×
              </button>
            </div>
          ),
        )}

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button type="button" onClick={addRow} className="text-xs text-neutral-400 underline">
            + Add row
          </button>
          <button type="button" onClick={addHinweis} className="text-xs text-neutral-400 underline">
            + Hinweis
          </button>
          <span className="ml-auto text-sm text-zinc-400">
            Gesamt-Brutto:{" "}
            <strong className="tabular-nums text-zinc-100">{formatDE(gesamtBrutto)}</strong>
          </span>
        </div>
      </fieldset>

      <button className="self-start rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400">
        Save month
      </button>
    </form>
  );
}
