"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { grantCredits } from "@/lib/db/credits";
import { packById } from "@/lib/credits";
import { whopConfigured, createPackCheckout } from "@/lib/whop";

export type CheckoutResult =
  | { url: string } // redirect the browser to Whop to pay
  | { url: null; balance: number }; // dev fallback: credits granted instantly

// Where Whop sends the buyer back after a successful payment.
async function successUrl(): Promise<string> {
  const h = await headers();
  const origin =
    h.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return `${origin}/dashboard?purchase=success`;
}

// Begin a credit-pack purchase. With Whop configured this opens a hosted
// checkout and returns its URL (the wallet is credited later by the webhook).
// Without Whop env (local dev) it falls back to the old instant grant so the
// flow stays testable.
export async function startCreditCheckout(packId: string): Promise<CheckoutResult> {
  const pack = packById(packId);
  if (!pack) throw new Error("unknown pack");

  if (!whopConfigured) {
    const balance = await grantCredits(pack.credits, `purchase:${pack.id}`);
    revalidatePath("/credits");
    revalidatePath("/", "layout");
    return { url: null, balance };
  }

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("create_credit_order", {
    p_pack_id: pack.id,
    p_credits: pack.credits,
    p_amount: pack.price,
    p_currency: "eur",
  });
  if (error) throw error;

  const url = await createPackCheckout({
    orderId: orderId as string,
    amount: pack.price,
    redirectUrl: await successUrl(),
  });

  // Best-effort: link the checkout back to the order for support/debugging.
  try {
    const checkoutId = url.split("/").pop()?.split("?")[0] ?? null;
    if (checkoutId)
      await supabase.rpc("attach_checkout", {
        p_order_id: orderId,
        p_checkout_id: checkoutId,
      });
  } catch {
    // non-fatal
  }

  return { url };
}
