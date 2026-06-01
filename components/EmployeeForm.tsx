import { EMPLOYEE_FIELD_GROUPS } from "@/lib/employee-fields";
import type { Company, Employee } from "@/lib/db/types";
import { saveEmployee } from "@/app/employees/actions";

function getPath(obj: unknown, path: string): string {
  const [g, k] = path.split(".");
  const bucket = (obj as Record<string, Record<string, unknown>> | undefined)?.[
    g
  ];
  const v = bucket?.[k];
  if (v === undefined || v === null) return "";
  return typeof v === "boolean" ? (v ? "on" : "") : String(v);
}

export function EmployeeForm({
  companies,
  employee,
}: {
  companies: Company[];
  employee?: Employee;
}) {
  const d = employee?.data;
  return (
    <form action={saveEmployee} className="flex flex-col gap-6">
      {employee && <input type="hidden" name="id" value={employee.id} />}

      <label className="flex flex-col gap-1 text-sm text-neutral-300">
        Company
        <select
          name="company_id"
          defaultValue={employee?.company_id ?? ""}
          className="cmp-input"
        >
          <option value="">— none —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <a href="/companies" className="text-xs text-neutral-500 underline">
          Manage companies
        </a>
      </label>

      {EMPLOYEE_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-300">
            {group.title}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {group.fields.map((f) => {
              const value = d ? getPath(d, f.path) : "";
              if (f.type === "checkbox") {
                return (
                  <label
                    key={f.path}
                    className="flex items-center gap-2 text-sm text-neutral-300"
                  >
                    <input
                      type="checkbox"
                      name={f.path}
                      defaultChecked={value === "on"}
                    />
                    {f.label}
                  </label>
                );
              }
              return (
                <label
                  key={f.path}
                  className="flex flex-col gap-1 text-xs text-neutral-400"
                >
                  {f.label}
                  <input
                    name={f.path}
                    defaultValue={value}
                    className="cmp-input"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <button className="self-start rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900">
        Save employee
      </button>
    </form>
  );
}
