import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listEmployees } from "@/lib/db/employees";
import { EmployeeList } from "@/components/EmployeeList";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { purchase } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("username").eq("id", user.id).single()
    : { data: null };
  const employees = await listEmployees();

  return (
    <>
      {purchase === "success" && (
        <div className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Payment received — your credits will appear in your balance within a few
          seconds.
        </div>
      )}
      <PageHeader title="Employees" description={profile?.username ?? user?.email ?? ""}>
        <Link
          href="/employees/new"
          className="rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          New employee
        </Link>
      </PageHeader>
      <EmployeeList employees={employees} />
    </>
  );
}
