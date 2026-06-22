"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SlipFrame, type SlipFrameHandle } from "@/components/SlipFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { assembleState } from "@/lib/assembleState";
import { sumComputedTotals } from "@/lib/cumulative";
import { PRINT_COST } from "@/lib/credits";
import type { Company, Employee, Payslip, ComputedTotals } from "@/lib/db/types";
import type { TemplateMeta } from "@/lib/template-manifest";
import {
  saveComputedTotals,
  printPayslip,
  changeTemplate,
} from "@/app/(app)/employees/[id]/payslips/actions";

export function SlipPreview({
  company,
  employee,
  payslip,
  templates,
  otherMonths,
  balance,
}: {
  company: Company | null;
  employee: Employee;
  payslip: Payslip;
  templates: TemplateMeta[];
  otherMonths: ComputedTotals[]; // captured totals of the year's other months <= this one
  balance: number;
}) {
  const router = useRouter();
  const frameRef = useRef<SlipFrameHandle>(null);

  const [templateId, setTemplateId] = useState(payslip.template_id);
  const [thisMonth, setThisMonth] = useState<ComputedTotals | null>(
    payslip.computed_totals,
  );
  const [serial, setSerial] = useState<number | null>(payslip.serial_number);
  const [credits, setCredits] = useState(balance);
  // This exact slip already printed once → show the clean, printable document.
  const [unlocked, setUnlocked] = useState(payslip.printed_at != null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The employee is unlocked once any of their slips has been paid-printed.
  const employeeUnlocked = employee.unlocked_at != null;
  // A credit is only charged on the employee's very first print.
  const willCharge = !employeeUnlocked;

  const meta = templates.find((t) => t.id === templateId) ?? templates[0];
  const cumulative = meta.supportsCumulative
    ? sumComputedTotals([...otherMonths, ...(thisMonth ? [thisMonth] : [])])
    : null;

  const state = assembleState(company, employee, payslip, { serial, cumulative });
  const mode = unlocked ? "print" : "preview";

  const onComputed = useCallback(
    (totals: ComputedTotals) => {
      setThisMonth((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(totals)) return prev;
        void saveComputedTotals(payslip.id, totals);
        return totals;
      });
    },
    [payslip.id],
  );

  const onTemplateChange = async (id: string) => {
    setTemplateId(id);
    await changeTemplate(employee.id, payslip.id, id);
  };

  const onPrint = async () => {
    // Already paid for this slip → just print the clean copy, no charge.
    if (unlocked) {
      frameRef.current?.print();
      return;
    }
    if (willCharge && credits < PRINT_COST) {
      setError("out_of_credits");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await printPayslip(employee.id, payslip.id);
      if (!res.ok) {
        setError("out_of_credits");
        setBusy(false);
        return;
      }
      setSerial(res.serial);
      setCredits(res.balance);
      setUnlocked(true);
      router.refresh(); // persist server view (serial, unlock, balance)
      // let the frame re-render clean (guard removed + serial injected), then print
      setTimeout(() => {
        frameRef.current?.print();
        setBusy(false);
      }, 400);
    } catch {
      setError("failed");
      setBusy(false);
    }
  };

  const printLabel = unlocked
    ? "Print / PDF"
    : willCharge
      ? `Print (${PRINT_COST} credit)`
      : "Print (free)";

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <span className="text-zinc-400">Template</span>
          <Select
            value={templateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="inline-block w-auto"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.supportsCumulative ? "" : " (single month)"}
              </option>
            ))}
          </Select>
        </label>

        <span
          className={
            "rounded-md border px-2.5 py-1 text-xs " +
            (serial != null
              ? "border-emerald-800/60 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700 text-zinc-400")
          }
        >
          {serial != null ? `Serial #${serial}` : "Draft — not issued"}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {credits} credit{credits === 1 ? "" : "s"} left
          </span>
          <Button onClick={onPrint} disabled={busy}>
            {busy ? "Working…" : printLabel}
          </Button>
        </div>
      </Card>

      {!unlocked && (
        <p className="text-xs text-zinc-500">
          {willCharge
            ? `Printing spends ${PRINT_COST} credit and unlocks ${employee.name || "this employee"} — every future payslip for them then prints for free.`
            : "This employee is already unlocked — printing is free."}
        </p>
      )}

      {error === "out_of_credits" && (
        <Card className="border-amber-800/60 bg-amber-500/5 p-4 text-sm text-amber-200">
          You&rsquo;re out of credits.{" "}
          <Link href="/credits" className="font-medium underline">
            Buy more credits
          </Link>{" "}
          to print this payslip.
        </Card>
      )}

      {error === "failed" && (
        <Card className="border-red-800/60 bg-red-500/5 p-4 text-sm text-red-200">
          Something went wrong while printing. Please try again.
        </Card>
      )}

      <div className="flex justify-center">
        <SlipFrame
          ref={frameRef}
          templateFile={meta.file}
          state={state}
          mode={mode}
          onComputed={onComputed}
        />
      </div>
    </div>
  );
}
