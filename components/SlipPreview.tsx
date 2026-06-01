"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SlipFrame } from "@/components/SlipFrame";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { assembleState } from "@/lib/assembleState";
import { sumComputedTotals } from "@/lib/cumulative";
import type { Company, Employee, Payslip, ComputedTotals } from "@/lib/db/types";
import type { TemplateMeta } from "@/lib/template-manifest";
import {
  saveComputedTotals,
  issuePayslip,
  changeTemplate,
} from "@/app/(app)/employees/[id]/payslips/actions";

export function SlipPreview({
  company,
  employee,
  payslip,
  templates,
  otherMonths,
}: {
  company: Company | null;
  employee: Employee;
  payslip: Payslip;
  templates: TemplateMeta[];
  otherMonths: ComputedTotals[]; // captured totals of the year's other months <= this one
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(payslip.template_id);
  const [thisMonth, setThisMonth] = useState<ComputedTotals | null>(
    payslip.computed_totals,
  );

  const meta = templates.find((t) => t.id === templateId) ?? templates[0];
  const supportsCumulative = meta.supportsCumulative;

  const cumulative = supportsCumulative
    ? sumComputedTotals([...otherMonths, ...(thisMonth ? [thisMonth] : [])])
    : null;

  const state = assembleState(company, employee, payslip, {
    serial: payslip.serial_number,
    cumulative,
  });

  const onComputed = useCallback(
    (totals: ComputedTotals) => {
      // persist + feed this month into the cumulative; only re-render if changed
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

  const onIssue = async () => {
    await issuePayslip(employee.id, payslip.id);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-zinc-300">
          Template{" "}
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

        {payslip.serial_number != null ? (
          <span className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300">
            Serial #{payslip.serial_number}
          </span>
        ) : (
          <Button onClick={onIssue}>Issue &amp; assign serial</Button>
        )}
      </div>

      <SlipFrame
        templateFile={meta.file}
        state={state}
        onComputed={onComputed}
      />
    </div>
  );
}
