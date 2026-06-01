"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";

const NAV = [
  { href: "/dashboard", label: "Employees" },
  { href: "/companies", label: "Companies" },
];

export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4">
      <div className="px-2 py-3 text-sm font-semibold tracking-tight text-zinc-100">
        Gehaltsabrechnung
      </div>
      <nav className="mt-4 flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-md px-3 py-2 text-sm transition " +
                (active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-zinc-800 pt-4">
        <p className="truncate px-3 text-xs text-zinc-500">{username}</p>
        <form action={logout}>
          <button className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-100">
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
