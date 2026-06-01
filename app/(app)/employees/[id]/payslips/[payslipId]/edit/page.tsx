import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { getPayslip } from "@/lib/db/payslips";
import { MonthForm } from "@/components/MonthForm";
import { updateMonth } from "@/app/(app)/employees/[id]/payslips/actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function EditMonthPage({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>;
}) {
  const { id, payslipId } = await params;
  const [employee, payslip] = await Promise.all([
    getEmployee(id),
    getPayslip(payslipId),
  ]);
  if (!employee || !payslip) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/dashboard" },
          { label: employee.name || "(unnamed)", href: `/employees/${id}` },
          {
            label: `${payslip.data.zeitraum.monat} ${payslip.data.zeitraum.jahr}`,
            href: `/employees/${id}/payslips/${payslipId}`,
          },
          { label: "Edit" },
        ]}
      />
      <PageHeader title="Edit month" />
      <MonthForm
        employeeId={id}
        templateId={payslip.template_id}
        payslip={payslip}
        action={updateMonth.bind(null, id, payslipId)}
      />
    </>
  );
}
