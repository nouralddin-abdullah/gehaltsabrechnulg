import { listCompanies } from "@/lib/db/companies";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function NewEmployeePage() {
  const companies = await listCompanies();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">
        New employee
      </h1>
      <EmployeeForm companies={companies} />
    </main>
  );
}
