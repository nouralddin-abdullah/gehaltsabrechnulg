"use client";

import { useState } from "react";
import { COMPANY_FIELDS } from "@/lib/company-fields";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TEMPLATES } from "@/lib/template-manifest";
import {
  createCompany,
  updateCompany,
  createCompanyReturning,
} from "@/app/(app)/companies/actions";
import type { Company } from "@/lib/db/types";

function CompanyFields({ company }: { company?: Company }) {
  return (
    <>
      {COMPANY_FIELDS.map((f) => (
        <Field key={f.name} label={f.label} hint={f.description} example={f.example}>
          <Input
            name={f.name}
            defaultValue={(company as unknown as Record<string, string>)?.[f.name] ?? ""}
          />
        </Field>
      ))}
      <Field
        label="Default template"
        hint="Used as the starting template for new slips (changeable per slip)."
      >
        <Select name="default_template" defaultValue={company?.default_template ?? "datev-classic"}>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function CompanyForm({
  company,
  onCreated,
  onCancel,
}: {
  company?: Company;
  onCreated?: (c: Company) => void; // inline mode (wizard)
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // Inline mode: capture the created company instead of navigating.
  if (onCreated) {
    return (
      <form
        className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
        action={async (fd) => {
          setBusy(true);
          const c = await createCompanyReturning(fd);
          setBusy(false);
          onCreated(c);
        }}
      >
        <CompanyFields company={company} />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save company"}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    );
  }

  // Page mode: create or edit, then navigate (server action redirects).
  return (
    <form action={company ? updateCompany : createCompany} className="flex flex-col gap-4">
      {company && <input type="hidden" name="id" value={company.id} />}
      <CompanyFields company={company} />
      <Button type="submit" className="self-start">
        {company ? "Save changes" : "Add company"}
      </Button>
    </form>
  );
}
