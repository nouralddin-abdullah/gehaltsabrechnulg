import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { listEmployees } from "@/lib/db/employees";
import { EmployeeList } from "@/components/EmployeeList";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const employees = await listEmployees();

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Employees</h1>
          <p className="text-xs text-neutral-500">
            {profile?.username ?? user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/companies" className="text-sm text-neutral-400">
            Companies
          </Link>
          <Link
            href="/employees/new"
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900"
          >
            New employee
          </Link>
          <form action={logout}>
            <button className="text-sm text-neutral-400">Log out</button>
          </form>
        </div>
      </div>

      <EmployeeList employees={employees} />
    </main>
  );
}
