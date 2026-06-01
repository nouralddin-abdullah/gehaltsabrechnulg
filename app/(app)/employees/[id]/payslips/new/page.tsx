import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listCompanies } from "@/lib/db/companies";
import { MonthForm } from "@/components/MonthForm";
import { DEFAULT_TEMPLATE_ID } from "@/lib/template-manifest";

export default async function NewMonthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();
  const companies = await listCompanies();
  const company = companies.find((c) => c.id === employee.company_id) ?? null;
  const templateId = company?.default_template ?? DEFAULT_TEMPLATE_ID;

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">
        Add month — {employee.name}
      </h1>
      <MonthForm employeeId={id} templateId={templateId} />
    </main>
  );
}
