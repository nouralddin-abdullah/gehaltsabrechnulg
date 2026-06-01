"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { EmployeeFields } from "@/components/EmployeeFields";
import { CompanyForm } from "@/components/CompanyForm";
import { MonthForm } from "@/components/MonthForm";
import {
  saveEmployeeStep,
  setEmployeeCompany,
} from "@/app/(app)/employees/actions";
import { createMonthThenDetail } from "@/app/(app)/employees/[id]/payslips/actions";
import { DEFAULT_TEMPLATE_ID } from "@/lib/template-manifest";
import type { Company } from "@/lib/db/types";

const STEPS = ["Personal", "Company", "Months"];

type WizardState = { employeeId?: string; error?: string };

export function EmployeeWizard({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [addingCompany, setAddingCompany] = useState(false);
  const [localCompanies, setLocalCompanies] = useState(companies);

  const [state, formAction, pending] = useActionState<WizardState, FormData>(
    saveEmployeeStep,
    {},
  );

  useEffect(() => {
    if (state.employeeId && !employeeId) {
      setEmployeeId(state.employeeId);
      setStep(1);
    }
  }, [state.employeeId, employeeId]);

  const finish = () => employeeId && router.push(`/employees/${employeeId}`);

  const goCompany = async () => {
    if (employeeId) await setEmployeeCompany(employeeId, companyId || null);
    setStep(2);
  };

  const template =
    localCompanies.find((c) => c.id === companyId)?.default_template ??
    DEFAULT_TEMPLATE_ID;

  return (
    <div>
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <form action={formAction} className="flex flex-col gap-8">
          <EmployeeFields />
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Saving…" : "Continue"}
          </Button>
        </form>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <Field
            label="Company"
            hint="Pick the company this employee is paid under, or add a new one."
          >
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">— none —</option>
              {localCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {addingCompany ? (
            <CompanyForm
              onCreated={(c) => {
                setLocalCompanies((list) => [...list, c]);
                setCompanyId(c.id);
                setAddingCompany(false);
              }}
              onCancel={() => setAddingCompany(false)}
            />
          ) : (
            <Button variant="ghost" className="self-start" onClick={() => setAddingCompany(true)}>
              + Add company
            </Button>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={goCompany}>Continue</Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Skip for now
            </Button>
            <Button variant="ghost" onClick={finish}>
              Save &amp; finish
            </Button>
          </div>
        </div>
      )}

      {step === 2 && employeeId && (
        <div className="flex flex-col gap-6">
          <MonthForm
            employeeId={employeeId}
            templateId={template}
            action={createMonthThenDetail.bind(null, employeeId, template)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="ghost" onClick={finish}>
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
