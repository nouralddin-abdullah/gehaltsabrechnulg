import { EmployeeFields } from "@/components/EmployeeFields";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { Company, Employee } from "@/lib/db/types";
import { saveEmployee } from "@/app/(app)/employees/actions";

export function EmployeeForm({
  companies,
  employee,
}: {
  companies: Company[];
  employee?: Employee;
}) {
  return (
    <form action={saveEmployee} className="flex flex-col gap-8">
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <Field label="Company" hint="Which company this employee is paid under.">
        <Select name="company_id" defaultValue={employee?.company_id ?? ""}>
          <option value="">— none —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <EmployeeFields data={employee?.data} />
      <Button type="submit" className="self-start">
        Save employee
      </Button>
    </form>
  );
}
