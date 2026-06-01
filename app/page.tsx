import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold">Gehaltsabrechnung SaaS</h1>
      <p className="mt-2 text-neutral-400">Foundation scaffold.</p>
      <Link
        href="/demo"
        className="mt-6 inline-block rounded bg-neutral-100 px-4 py-2 text-neutral-900"
      >
        Open slip demo
      </Link>
    </main>
  );
}
