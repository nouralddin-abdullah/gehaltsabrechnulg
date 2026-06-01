import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db/employees";
import { listPayslipsForEmployee } from "@/lib/db/payslips";

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
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">
            {employee.name || "(unnamed)"}
          </h1>
          <Link href="/dashboard" className="text-xs text-neutral-500">
            ← Employees
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/employees/${id}/edit`} className="text-sm text-neutral-400">
            Edit details
          </Link>
          <Link
            href={`/employees/${id}/payslips/new`}
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900"
          >
            Add month
          </Link>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-neutral-800">
        {payslips.length === 0 && (
          <li className="py-4 text-neutral-500">No months yet.</li>
        )}
        {payslips.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <Link
              href={`/employees/${id}/payslips/${p.id}`}
              className="text-neutral-100 hover:underline"
            >
              {p.data.zeitraum.monat} {p.data.zeitraum.jahr}
            </Link>
            <span className="text-xs text-neutral-500">
              {p.status === "issued" ? `#${p.serial_number}` : "draft"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
