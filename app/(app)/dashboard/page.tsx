import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listEmployees } from "@/lib/db/employees";
import { EmployeeList } from "@/components/EmployeeList";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function DashboardPage() {
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
