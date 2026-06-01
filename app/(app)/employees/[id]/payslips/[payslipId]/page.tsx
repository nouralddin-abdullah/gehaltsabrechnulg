import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listCompanies } from "@/lib/db/companies";
import { getPayslip, getYearComputedTotals } from "@/lib/db/payslips";
import { SlipPreview } from "@/components/SlipPreview";
import { TEMPLATES } from "@/lib/template-manifest";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function PayslipPreviewPage({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>;
}) {
  const { id, payslipId } = await params;
  const [employee, payslip, companies] = await Promise.all([
    getEmployee(id),
    getPayslip(payslipId),
    listCompanies(),
  ]);
  if (!employee || !payslip) notFound();
  const company = companies.find((c) => c.id === employee.company_id) ?? null;

  const otherMonths = await getYearComputedTotals(
    id,
    payslip.year,
    payslip.month,
    payslip.id,
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/dashboard" },
          { label: employee.name || "(unnamed)", href: `/employees/${id}` },
          { label: `${payslip.data.zeitraum.monat} ${payslip.data.zeitraum.jahr}` },
        ]}
      />
      <SlipPreview
        company={company}
        employee={employee}
        payslip={payslip}
        templates={TEMPLATES}
        otherMonths={otherMonths}
      />
    </>
  );
}
