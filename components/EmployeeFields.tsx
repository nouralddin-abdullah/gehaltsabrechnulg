"use client";

import { EMPLOYEE_FIELD_GROUPS } from "@/lib/employee-fields";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { toDateInput } from "@/lib/date-format";
import type { EmployeeData } from "@/lib/db/types";

function getPath(obj: unknown, path: string): string {
  const [g, k] = path.split(".");
  const bucket = (obj as Record<string, Record<string, unknown>> | undefined)?.[g];
  const v = bucket?.[k];
  if (v === undefined || v === null) return "";
  return typeof v === "boolean" ? (v ? "on" : "") : String(v);
}

export function EmployeeFields({ data }: { data?: EmployeeData }) {
  return (
    <div className="flex flex-col gap-8">
      {EMPLOYEE_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-4">
          <legend className="text-sm font-medium text-zinc-300">{group.title}</legend>
          <div className="grid grid-cols-2 gap-4">
            {group.fields.map((f) => {
              const value = data ? getPath(data, f.path) : "";
              if (f.type === "checkbox") {
                return (
                  <label key={f.path} className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" name={f.path} defaultChecked={value === "on"} />
                    {f.label}
                  </label>
                );
              }
              return (
                <Field key={f.path} label={f.label} hint={f.description} example={f.example}>
                  <Input
                    name={f.path}
                    type={f.date ? "date" : "text"}
                    defaultValue={f.date ? toDateInput(value, f.date) : value}
                  />
                </Field>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
