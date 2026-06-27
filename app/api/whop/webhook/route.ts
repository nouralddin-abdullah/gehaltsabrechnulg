import { NextResponse, type NextRequest } from "next/server";
import { unwrapWebhook } from "@/lib/whop";
import { createAdminClient } from "@/lib/supabase/admin";

// Whop calls this on payment events. We verify the signature, and on
// payment.succeeded credit the order's user (service role → fulfill_credit_order,
// idempotent). Runs on the Node runtime so the Whop SDK + crypto are available.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event;
  try {
    event = unwrapWebhook(raw, headers);
  } catch (err) {
    console.error("[whop webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (event.type !== "payment.succeeded") {
    // Acknowledge everything else so Whop doesn't retry events we ignore.
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const payment = event.data as { id: string; metadata?: Record<string, unknown> };
  const orderId = payment.metadata?.order_id as string | undefined;
  if (!orderId) {
    console.warn("[whop webhook] payment.succeeded without order_id metadata", payment.id);
    return NextResponse.json({ ok: true, skipped: "no order_id" });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("fulfill_credit_order", {
      p_order_id: orderId,
      p_whop_payment_id: payment.id,
    });
    if (error) throw error;
    console.log("[whop webhook] fulfilled", orderId, data);
    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    // 500 → Whop retries, so a transient DB hiccup won't drop the credit.
    console.error("[whop webhook] fulfilment failed", orderId, err);
    return NextResponse.json({ error: "fulfilment failed" }, { status: 500 });
  }
}
