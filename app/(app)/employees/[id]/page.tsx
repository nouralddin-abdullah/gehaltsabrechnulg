import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listPayslipsForEmployee } from "@/lib/db/payslips";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();
  const payslips = await listPayslipsForEmployee(id);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/dashboard" },
          { label: employee.name || "(unnamed)" },
        ]}
      />
      <PageHeader title={employee.name || "(unnamed)"}>
        <Link
          href={`/employees/${id}/edit`}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          Edit details
        </Link>
        <Link
          href={`/employees/${id}/payslips/new`}
          className="rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Add month
        </Link>
      </PageHeader>
      <ul className="divide-y divide-zinc-800">
        {payslips.length === 0 && <li className="py-4 text-zinc-500">No months yet.</li>}
        {payslips.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <Link
              href={`/employees/${id}/payslips/${p.id}`}
              className="text-zinc-100 hover:underline"
            >
              {p.data.zeitraum.monat} {p.data.zeitraum.jahr}
            </Link>
            <span className="text-xs text-zinc-500">
              {p.status === "issued" ? `#${p.serial_number}` : "draft"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
