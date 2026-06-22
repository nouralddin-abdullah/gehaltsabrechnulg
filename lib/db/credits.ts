import { createClient } from "@/lib/supabase/server";
import type { CreditTransaction } from "./types";

// Current credit balance for the signed-in user (0 if no wallet row yet).
export async function getCreditBalance(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data, error } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

export type PrintResult =
  | { ok: true; balance: number; serial: number; charged: boolean }
  | { ok: false; error: "insufficient_credits" };

// Atomically print a payslip: spends a credit on the FIRST print of the
// employee, assigns/reuses the payslip serial, and never lets the balance go
// negative — all enforced in the DB (print_payslip RPC, migration 0007).
export async function printPayslip(payslipId: string): Promise<PrintResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("print_payslip", {
    p_payslip_id: payslipId,
  });
  if (error) {
    if (String(error.message).includes("insufficient_credits")) {
      return { ok: false, error: "insufficient_credits" };
    }
    throw error;
  }
  const r = data as { balance: number; serial: number; charged: boolean };
  return { ok: true, ...r };
}

// Add credits to the caller's wallet (mock purchase until payments are wired).
export async function grantCredits(
  amount: number,
  reason = "purchase",
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grant_credits", {
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
  return data as number;
}

export async function listCreditTransactions(
  limit = 20,
): Promise<CreditTransaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as CreditTransaction[];
}
