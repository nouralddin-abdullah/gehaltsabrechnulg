import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-xs font-medium uppercase tracking-widest text-indigo-400">
          Gehaltsabrechnung
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Payroll slips, done right.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Manage your employees and companies, generate authentic German payroll
          slips, and keep every month in order — with real, consistent serial
          numbers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
          >
            Log in
          </Link>
        </div>
        <p className="mt-10 text-xs text-zinc-600">
          <Link href="/demo" className="transition hover:text-zinc-400">
            View a sample slip →
          </Link>
        </p>
      </div>
    </main>
  );
}
