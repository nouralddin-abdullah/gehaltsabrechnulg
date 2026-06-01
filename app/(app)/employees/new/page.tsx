import { listCompanies } from "@/lib/db/companies";
import { EmployeeWizard } from "@/components/EmployeeWizard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function NewEmployeePage() {
  const companies = await listCompanies();
  return (
    <>
      <Breadcrumbs items={[{ label: "Employees", href: "/dashboard" }, { label: "New" }]} />
      <PageHeader title="New employee" />
      <EmployeeWizard companies={companies} />
    </>
  );
}
