import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listCompanies } from "@/lib/db/companies";
import { getPayslip, getYearComputedTotals } from "@/lib/db/payslips";
import { SlipPreview } from "@/components/SlipPreview";
import { TEMPLATES } from "@/lib/template-manifest";

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

  // captured totals for the year's other months up to and including this one
  const otherMonths = await getYearComputedTotals(
    id,
    payslip.year,
    payslip.month,
    payslip.id,
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <SlipPreview
        company={company}
        employee={employee}
        payslip={payslip}
        templates={TEMPLATES}
        otherMonths={otherMonths}
      />
    </main>
  );
}
