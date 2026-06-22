import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listCompanies } from "@/lib/db/companies";
import { getPayslip, getYearComputedTotals } from "@/lib/db/payslips";
import { getCreditBalance } from "@/lib/db/credits";
import Link from "next/link";
import { SlipPreview } from "@/components/SlipPreview";
import { TEMPLATES } from "@/lib/template-manifest";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function PayslipPreviewPage({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>;
}) {
  const { id, payslipId } = await params;
  const [employee, payslip, companies, balance] = await Promise.all([
    getEmployee(id),
    getPayslip(payslipId),
    listCompanies(),
    getCreditBalance(),
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
      <PageHeader title={`${payslip.data.zeitraum.monat} ${payslip.data.zeitraum.jahr}`}>
        <Link
          href={`/employees/${id}/payslips/${payslipId}/edit`}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          Edit month
        </Link>
      </PageHeader>
      <SlipPreview
        company={company}
        employee={employee}
        payslip={payslip}
        templates={TEMPLATES}
        otherMonths={otherMonths}
        balance={balance}
      />
    </>
  );
}
