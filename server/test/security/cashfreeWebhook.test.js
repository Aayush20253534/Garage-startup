const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getCashfreeOrderIdFromWebhook,
  verifyCashfreeWebhookSignature,
} = require("../../src/customer/security/cashfreeWebhook");

const makeRequest = ({ body, rawBody, timestamp, signature }) => ({
  body,
  rawBody,
  get(name) {
    if (name === "x-webhook-timestamp") return String(timestamp);
    if (name === "x-webhook-signature") return signature;
    return undefined;
  },
});

test("Cashfree webhook accepts a fresh HMAC over the exact raw body", () => {
  process.env.CASHFREE_WEBHOOK_SECRET = "cashfree-test-secret-1234567890";
  process.env.CASHFREE_WEBHOOK_SIGNATURE_REQUIRED = "true";
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);
  const rawBody = Buffer.from(JSON.stringify({ data: { order: { order_id: "cf_1" } } }));
  const signature = crypto
    .createHmac("sha256", process.env.CASHFREE_WEBHOOK_SECRET)
    .update(`${timestamp}${rawBody.toString("utf8")}`)
    .digest("base64");

  assert.equal(
    verifyCashfreeWebhookSignature(
      makeRequest({ body: {}, rawBody, timestamp, signature }),
      now,
    ),
    true,
  );
});

test("Cashfree webhook rejects stale and tampered signatures", () => {
  process.env.CASHFREE_WEBHOOK_SECRET = "cashfree-test-secret-1234567890";
  process.env.CASHFREE_WEBHOOK_SIGNATURE_REQUIRED = "true";
  const now = Date.now();
  const staleTimestamp = Math.floor((now - 10 * 60 * 1000) / 1000);

  assert.throws(
    () => verifyCashfreeWebhookSignature(
      makeRequest({ body: {}, rawBody: Buffer.from("{}"), timestamp: staleTimestamp, signature: "bad" }),
      now,
    ),
    (error) => error.statusCode === 401,
  );

  const timestamp = Math.floor(now / 1000);
  assert.throws(
    () => verifyCashfreeWebhookSignature(
      makeRequest({ body: {}, rawBody: Buffer.from("{}"), timestamp, signature: "bad" }),
      now,
    ),
    (error) => error.statusCode === 401,
  );
});

test("Cashfree order ID extraction supports current webhook shapes", () => {
  assert.equal(
    getCashfreeOrderIdFromWebhook({ data: { order: { order_id: "cf_nested" } } }),
    "cf_nested",
  );
});
