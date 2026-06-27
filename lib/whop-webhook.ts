import crypto from "node:crypto";

// Verifies + parses Whop webhook deliveries. Kept free of `server-only` and the
// Whop SDK so it stays unit-testable. Whop has two delivery schemes and shows
// the signing secret as `ws_<hex>` in the dashboard:
//
//   * Standard Webhooks (what @whop/sdk delivers): headers webhook-id /
//     webhook-timestamp / webhook-signature; signature = base64(HMAC-SHA256(key,
//     `${id}.${ts}.${body}`)); header value is a space-separated list of
//     `v1,<sig>`.
//   * Legacy @whop/api: header x-whop-signature = `t=<ts>,v1=<hexsig>`;
//     signature = hex(HMAC-SHA256(key, `${ts}.${body}`)).
//
// Whop's `ws_<hex>` secret is a 32-byte key encoded as hex; other flows use
// base64 (`whsec_<base64>`) or the raw secret string. We try each derivation —
// all are the same secret, so this never weakens verification, it only makes us
// correct regardless of which encoding Whop signed with.

export type WhopWebhookEvent = {
  type?: string; // Standard Webhooks discriminator
  action?: string; // legacy discriminator
  data?: {
    id?: string;
    metadata?: Record<string, unknown> | null;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

export class WhopSignatureError extends Error {}

function lower(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(headers)) out[k.toLowerCase()] = headers[k];
  return out;
}

function candidateKeys(secret: string): Buffer[] {
  const keys: Buffer[] = [];
  const body = secret.replace(/^(ws_|whsec_)/, "");
  if (/^[0-9a-fA-F]+$/.test(body) && body.length % 2 === 0)
    keys.push(Buffer.from(body, "hex"));
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(body)) {
    try {
      const b = Buffer.from(body, "base64");
      if (b.length) keys.push(b);
    } catch {
      /* not base64 */
    }
  }
  keys.push(Buffer.from(secret, "utf8"));
  return keys;
}

function hmac(key: Buffer, msg: string, enc: "base64" | "hex"): string {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest(enc);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function verifyAndParseWhopWebhook(
  rawBody: string,
  headersIn: Record<string, string>,
  secret: string | undefined,
): WhopWebhookEvent {
  if (!secret) throw new WhopSignatureError("missing webhook secret");
  const headers = lower(headersIn);
  const keys = candidateKeys(secret);

  // Standard Webhooks scheme.
  const id = headers["webhook-id"];
  const ts = headers["webhook-timestamp"];
  const sig = headers["webhook-signature"];
  if (id && ts && sig) {
    const signed = `${id}.${ts}.${rawBody}`;
    const sent = sig
      .split(" ")
      .map((s) => s.split(","))
      .filter((p) => p[0] === "v1")
      .map((p) => p[1]);
    for (const key of keys) {
      const mac = hmac(key, signed, "base64");
      if (sent.some((s) => safeEqual(s, mac))) return JSON.parse(rawBody);
    }
    throw new WhopSignatureError("standard webhook signature mismatch");
  }

  // Legacy x-whop-signature scheme.
  const xsig = headers["x-whop-signature"];
  if (xsig) {
    const parts: Record<string, string> = {};
    for (const kv of xsig.split(",")) {
      const [k, v] = kv.split("=");
      if (k && v !== undefined) parts[k.trim()] = v.trim();
    }
    const signed = `${parts.t}.${rawBody}`;
    for (const key of keys) {
      if (parts.v1 && safeEqual(hmac(key, signed, "hex"), parts.v1))
        return JSON.parse(rawBody);
    }
    throw new WhopSignatureError("legacy webhook signature mismatch");
  }

  throw new WhopSignatureError("no recognized whop signature header");
}
