import "server-only";
import { Whop } from "@whop/sdk";

// Server-only Whop wrapper. Credit packs are sold through a SINGLE one-time Whop
// product (WHOP_PRODUCT_ID) whose price is set per-checkout (initial_price), so
// pack pricing stays defined in lib/credits.ts. Payment is confirmed out-of-band
// by the webhook (app/api/whop/webhook) — never at checkout creation.

const apiKey = process.env.WHOP_API_KEY;
const companyId = process.env.WHOP_COMPANY_ID;
const productId = process.env.WHOP_PRODUCT_ID;

// True only when every value needed to create a real checkout is present. When
// false the app falls back to the dev mock (instant grant) so local work keeps
// flowing without Whop credentials.
export const whopConfigured = Boolean(apiKey && companyId && productId);

let client: Whop | null = null;
function getClient(): Whop {
  if (!client) client = new Whop({ apiKey: apiKey! });
  return client;
}

export type CreateCheckoutArgs = {
  orderId: string;
  amount: number; // EUR, charged via initial_price
  redirectUrl: string;
};

// Creates a one-time Whop checkout for `amount` EUR and tags it with the order
// id so the webhook can credit the right user. Returns the hosted purchase URL.
export async function createPackCheckout({
  orderId,
  amount,
  redirectUrl,
}: CreateCheckoutArgs): Promise<string> {
  // Single product ⇒ product_id; supports access-pass ids too, just in case.
  const planKey = productId!.startsWith("prod_") ? "product_id" : "access_pass_id";

  const checkout = await getClient().checkoutConfigurations.create({
    plan: {
      company_id: companyId!,
      [planKey]: productId!,
      initial_price: amount,
      plan_type: "one_time",
      currency: "eur",
      adaptive_pricing_enabled: false,
    },
    metadata: { order_id: orderId },
    redirect_url: redirectUrl,
  });

  return checkout.purchase_url;
}
