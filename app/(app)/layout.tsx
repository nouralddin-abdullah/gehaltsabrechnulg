import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { getCreditBalance } from "@/lib/db/credits";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, balance] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    getCreditBalance(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        username={profile?.username ?? user.email ?? ""}
        credits={balance}
      />
      <div className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </div>
    </div>
  );
}
