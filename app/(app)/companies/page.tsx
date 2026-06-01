import Link from "next/link";
import { listCompanies } from "@/lib/db/companies";
import { TEMPLATES } from "@/lib/template-manifest";
import { createCompany, deleteCompany } from "./actions";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Companies</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400">
          ← Dashboard
        </Link>
      </div>

      <ul className="mt-6 divide-y divide-neutral-800">
        {companies.length === 0 && (
          <li className="py-4 text-neutral-500">No companies yet.</li>
        )}
        {companies.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-neutral-100">{c.name}</p>
              <p className="text-xs text-neutral-500">{c.firma}</p>
            </div>
            <form action={deleteCompany}>
              <input type="hidden" name="id" value={c.id} />
              <button className="text-xs text-red-400">Delete</button>
            </form>
          </li>
        ))}
      </ul>

      <form
        action={createCompany}
        className="mt-8 flex flex-col gap-3 border-t border-neutral-800 pt-6"
      >
        <h2 className="text-sm font-medium text-neutral-300">Add company</h2>
        <input name="name" placeholder="Display name" required className="cmp-input" />
        <input
          name="firma"
          placeholder="Employer line (Firma*Straße*PLZ Ort)"
          className="cmp-input"
        />
        <div className="flex gap-3">
          <input name="mandant" placeholder="Mandant" className="cmp-input flex-1" />
          <input name="roc_code" placeholder="R0C code" className="cmp-input flex-1" />
        </div>
        <select
          name="default_template"
          className="cmp-input"
          defaultValue="datev-classic"
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="self-start rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">
          Add company
        </button>
      </form>
    </main>
  );
}
