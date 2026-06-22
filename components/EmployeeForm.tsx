import { EmployeeFields } from "@/components/EmployeeFields";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Company, Employee } from "@/lib/db/types";
import { identityLockState } from "@/lib/credits";
import { saveEmployee } from "@/app/(app)/employees/actions";

export function EmployeeForm({
  companies,
  employee,
}: {
  companies: Company[];
  employee?: Employee;
}) {
  const lock = identityLockState(employee?.unlocked_at ?? null);

  return (
    <form action={saveEmployee} className="flex flex-col gap-8">
      {employee && <input type="hidden" name="id" value={employee.id} />}

      {lock.locked && (
        <Card className="border-amber-800/60 bg-amber-500/5 p-4 text-sm text-amber-200">
          This employee has been printed. Their name, date of birth and
          personnel number are now locked and can&rsquo;t be changed.
        </Card>
      )}
      {lock.unlocked && !lock.locked && lock.locksAt && (
        <Card className="border-zinc-700 bg-zinc-800/40 p-4 text-sm text-zinc-300">
          You can still edit this employee&rsquo;s name, date of birth and
          personnel number until{" "}
          <strong className="text-zinc-100">
            {new Date(lock.locksAt).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          . After that they lock permanently.
        </Card>
      )}

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
      <EmployeeFields data={employee?.data} lockIdentity={lock.locked} />
      <Button type="submit" className="self-start">
        Save employee
      </Button>
    </form>
  );
}
