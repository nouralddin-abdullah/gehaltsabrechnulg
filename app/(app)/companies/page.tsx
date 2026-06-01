import Link from "next/link";
import { listCompanies } from "@/lib/db/companies";
import { CompanyForm } from "@/components/CompanyForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { deleteCompany } from "./actions";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  return (
    <>
      <PageHeader title="Companies" description="Private to your account." />
      <ul className="flex flex-col gap-2">
        {companies.length === 0 && <li className="text-zinc-500">No companies yet.</li>}
        {companies.map((c) => (
          <li key={c.id}>
            <Card className="flex items-center justify-between p-4">
              <div>
                <p className="text-zinc-100">{c.name}</p>
                <p className="text-xs text-zinc-500">{c.firma}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/companies/${c.id}/edit`}
                  className="text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Edit
                </Link>
                <form action={deleteCompany}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-red-400">Delete</button>
                </form>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-zinc-800 pt-8">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">Add company</h2>
        <CompanyForm />
      </div>
    </>
  );
}
