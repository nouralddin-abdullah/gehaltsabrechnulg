import { NextResponse, type NextRequest } from "next/server";
import {
  verifyAndParseWhopWebhook,
  WhopSignatureError,
} from "@/lib/whop-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

// Whop calls this on payment events. We verify the signature, and on a
// successful payment credit the order's user (service role → fulfill_credit_order,
// idempotent). Runs on the Node runtime so node:crypto is available.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event;
  try {
    event = verifyAndParseWhopWebhook(raw, headers, process.env.WHOP_WEBHOOK_SECRET);
  } catch (err) {
    const detail = err instanceof WhopSignatureError ? err.message : "error";
    console.error("[whop webhook] signature verification failed:", detail, {
      headerKeys: Object.keys(headers),
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Standard Webhooks uses `type`; the legacy scheme uses `action`.
  const kind = event.type ?? event.action;
  if (kind !== "payment.succeeded") {
    return NextResponse.json({ ok: true, ignored: kind ?? "unknown" });
  }

  const payment = event.data ?? {};
  const orderId = payment.metadata?.order_id as string | undefined;
  const paymentId = (payment.id as string | undefined) ?? `whop_${Date.now()}`;
  if (!orderId) {
    console.warn("[whop webhook] payment.succeeded without order_id metadata", paymentId);
    return NextResponse.json({ ok: true, skipped: "no order_id" });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("fulfill_credit_order", {
      p_order_id: orderId,
      p_whop_payment_id: paymentId,
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
