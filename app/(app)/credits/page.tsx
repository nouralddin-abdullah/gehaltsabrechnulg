import { getCreditBalance, listCreditTransactions } from "@/lib/db/credits";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";
import { CreditPacks } from "@/components/CreditPacks";

function describe(reason: string): string {
  if (reason === "print") return "Print";
  if (reason.startsWith("purchase")) return "Purchase";
  return reason;
}

export default async function CreditsPage() {
  const [balance, transactions] = await Promise.all([
    getCreditBalance(),
    listCreditTransactions(),
  ]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Credits" }]} />
      <PageHeader
        title="Credits"
        description="Each printed payslip spends one credit. Unlock an employee once and every later payslip for them prints free."
      />

      <Card className="mb-8 flex items-center justify-between p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Balance</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-zinc-100">
            {balance}
            <span className="ml-2 text-base font-normal text-zinc-500">
              credit{balance === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-zinc-300">Buy credits</h2>
      <CreditPacks />
      <p className="mt-3 text-xs text-zinc-500">
        Payment isn&rsquo;t connected yet — buying adds credits to your account
        instantly for now.
      </p>

      <h2 className="mb-3 mt-10 text-sm font-medium text-zinc-300">
        Recent activity
      </h2>
      <Card className="divide-y divide-zinc-800">
        {transactions.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">No activity yet.</p>
        )}
        {transactions.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <div>
              <span className="text-zinc-200">{describe(t.reason)}</span>
              <span className="ml-2 text-xs text-zinc-500">
                {new Date(t.created_at).toLocaleString("de-DE")}
              </span>
            </div>
            <span
              className={
                "font-medium " +
                (t.delta >= 0 ? "text-emerald-400" : "text-zinc-400")
              }
            >
              {t.delta >= 0 ? `+${t.delta}` : t.delta}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
