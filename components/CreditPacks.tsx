"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CREDIT_PACKS, formatEuro, pricePerCredit } from "@/lib/credits";
import { purchaseCreditPack } from "@/app/(app)/credits/actions";

export function CreditPacks() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const buy = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      await purchaseCreditPack(id);
      setBusyId(null);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CREDIT_PACKS.map((pack) => (
        <Card
          key={pack.id}
          className={
            "relative flex flex-col gap-4 p-5 " +
            (pack.popular ? "border-indigo-500/60 ring-1 ring-indigo-500/30" : "")
          }
        >
          {pack.popular && (
            <span className="absolute -top-2.5 left-5 rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Best value
            </span>
          )}
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-zinc-100">
                {pack.credits}
              </span>
              <span className="text-sm text-zinc-400">credits</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {pricePerCredit(pack)} per credit
            </p>
          </div>
          <div className="text-2xl font-medium text-zinc-100">
            {formatEuro(pack.price)}
          </div>
          <Button
            variant={pack.popular ? "primary" : "secondary"}
            onClick={() => buy(pack.id)}
            disabled={pending}
            className="mt-auto"
          >
            {busyId === pack.id ? "Adding…" : "Buy"}
          </Button>
        </Card>
      ))}
    </div>
  );
}
