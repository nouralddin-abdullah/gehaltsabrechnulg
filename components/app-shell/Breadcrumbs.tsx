import Link from "next/link";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="mb-6 flex items-center gap-1.5 text-sm text-zinc-500">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-zinc-700">›</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-zinc-300">
              {it.label}
            </Link>
          ) : (
            <span className="text-zinc-300">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
