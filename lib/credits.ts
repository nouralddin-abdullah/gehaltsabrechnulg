// Credit packs + pricing. Payment is not wired yet — see app/(app)/credits.
// Printing a payslip costs PRINT_COST credits, charged the first time any of an
// employee's payslips is printed (then that employee prints free; see migration
// 0007). Identity fields stay editable for EDIT_WINDOW_HOURS after that.

export type CreditPack = {
  id: string;
  credits: number;
  price: number; // EUR
  popular?: boolean;
};

export const PRINT_COST = 1;
export const EDIT_WINDOW_HOURS = 1;

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", credits: 3, price: 30 },
  { id: "standard", credits: 15, price: 100, popular: true },
  { id: "pro", credits: 30, price: 190 },
  { id: "business", credits: 100, price: 450 },
];

export function packById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEuro(n: number): string {
  return euro.format(n);
}

// €/credit, rounded to cents — shown as the value-per-pack hint.
export function pricePerCredit(pack: CreditPack): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(pack.price / pack.credits);
}

export type IdentityLock = {
  unlocked: boolean; // employee has been paid-printed at least once
  locked: boolean; // identity edits are now frozen
  locksAt: number | null; // epoch ms when the window closes
};

// Mirrors the DB trigger in 0007 (kept in sync for UI hints; the DB is the
// source of truth).
export function identityLockState(unlockedAt: string | null): IdentityLock {
  if (!unlockedAt) return { unlocked: false, locked: false, locksAt: null };
  const locksAt = new Date(unlockedAt).getTime() + EDIT_WINDOW_HOURS * 3_600_000;
  return { unlocked: true, locked: Date.now() >= locksAt, locksAt };
}
