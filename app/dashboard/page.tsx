import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";

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

  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold text-neutral-100">Dashboard</h1>
      <p className="mt-2 text-neutral-400">
        Signed in as{" "}
        <span className="text-neutral-200">
          {profile?.username ?? user.email}
        </span>
      </p>
      <form action={logout} className="mt-6">
        <button className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200">
          Log out
        </button>
      </form>
    </main>
  );
}
