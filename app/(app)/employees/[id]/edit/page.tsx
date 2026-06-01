import { notFound } from "next/navigation";
import { listCompanies } from "@/lib/db/companies";
import { getEmployee } from "@/lib/db/employees";
import { EmployeeForm } from "@/components/EmployeeForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [companies, employee] = await Promise.all([listCompanies(), getEmployee(id)]);
  if (!employee) notFound();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/dashboard" },
          { label: employee.name || "(unnamed)", href: `/employees/${id}` },
          { label: "Edit" },
        ]}
      />
      <PageHeader title="Edit employee" />
      <EmployeeForm companies={companies} employee={employee} />
    </>
  );
}
