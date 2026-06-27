import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifyAndParseWhopWebhook,
  WhopSignatureError,
} from "@/lib/whop-webhook";

// A realistic Whop `ws_<hex>` secret: prefix + 64 hex chars (= a 32-byte key).
const WS_SECRET = "ws_" + "ab".repeat(32);
const HEX_KEY = Buffer.from(WS_SECRET.slice(3), "hex");

const BODY = JSON.stringify({
  type: "payment.succeeded",
  data: { id: "pay_123", metadata: { order_id: "order-abc" } },
});

function standardHeaders(secret_key: Buffer, body = BODY) {
  const id = "msg_test";
  const ts = String(Math.floor(Date.now() / 1000));
  const mac = crypto
    .createHmac("sha256", secret_key)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": ts,
    "webhook-signature": `v1,${mac}`,
  };
}

describe("verifyAndParseWhopWebhook", () => {
  it("verifies a Standard Webhooks delivery signed with the hex-decoded ws_ key", () => {
    const headers = standardHeaders(HEX_KEY);
    const event = verifyAndParseWhopWebhook(BODY, headers, WS_SECRET);
    expect(event.type).toBe("payment.succeeded");
    expect(event.data?.metadata?.order_id).toBe("order-abc");
    expect(event.data?.id).toBe("pay_123");
  });

  it("tolerates upper-cased header names", () => {
    const h = standardHeaders(HEX_KEY);
    const headers = {
      "Webhook-Id": h["webhook-id"],
      "Webhook-Timestamp": h["webhook-timestamp"],
      "Webhook-Signature": h["webhook-signature"],
    };
    expect(verifyAndParseWhopWebhook(BODY, headers, WS_SECRET).type).toBe(
      "payment.succeeded",
    );
  });

  it("verifies a base64 (whsec_) secret too", () => {
    const rawKey = crypto.randomBytes(32);
    const secret = "whsec_" + rawKey.toString("base64");
    const headers = standardHeaders(rawKey);
    expect(verifyAndParseWhopWebhook(BODY, headers, secret).type).toBe(
      "payment.succeeded",
    );
  });

  it("verifies the legacy x-whop-signature scheme", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(WS_SECRET, "utf8"); // legacy keys off the raw string
    const mac = crypto
      .createHmac("sha256", key)
      .update(`${ts}.${BODY}`)
      .digest("hex");
    const headers = { "x-whop-signature": `t=${ts},v1=${mac}` };
    expect(verifyAndParseWhopWebhook(BODY, headers, WS_SECRET).type).toBe(
      "payment.succeeded",
    );
  });

  it("rejects a tampered body", () => {
    const headers = standardHeaders(HEX_KEY);
    const tampered = BODY.replace("order-abc", "order-evil");
    expect(() => verifyAndParseWhopWebhook(tampered, headers, WS_SECRET)).toThrow(
      WhopSignatureError,
    );
  });

  it("rejects a wrong secret", () => {
    const headers = standardHeaders(HEX_KEY);
    expect(() =>
      verifyAndParseWhopWebhook(BODY, headers, "ws_" + "cd".repeat(32)),
    ).toThrow(WhopSignatureError);
  });

  it("throws when no signature header is present", () => {
    expect(() => verifyAndParseWhopWebhook(BODY, {}, WS_SECRET)).toThrow(
      WhopSignatureError,
    );
  });
});
