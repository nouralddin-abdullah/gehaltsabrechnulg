import { notFound } from "next/navigation";
import { listCompanies } from "@/lib/db/companies";
import { getEmployee } from "@/lib/db/employees";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [companies, employee] = await Promise.all([
    listCompanies(),
    getEmployee(id),
  ]);
  if (!employee) notFound();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">
        Edit employee
      </h1>
      <EmployeeForm companies={companies} employee={employee} />
    </main>
  );
}
