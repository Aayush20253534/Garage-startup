const crypto = require("crypto");
const ApiError = require("../../utils/apiError");

const getCashfreeWebhookSecret = () =>
  process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY;

const verifyCashfreeWebhookSignature = (req, now = Date.now()) => {
  const required = !["0", "false", "no", "off"].includes(
    String(process.env.CASHFREE_WEBHOOK_SIGNATURE_REQUIRED || "true").toLowerCase(),
  );

  if (!required && process.env.NODE_ENV === "production") {
    throw new ApiError(500, "Cashfree webhook signatures cannot be disabled in production");
  }

  if (!required) return true;

  const secret = getCashfreeWebhookSecret();
  const timestamp = req.get("x-webhook-timestamp");
  const signature = req.get("x-webhook-signature");
  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody.toString("utf8")
    : JSON.stringify(req.body || {});

  if (!secret) {
    throw new ApiError(500, "Cashfree webhook secret is not configured");
  }

  if (!timestamp || !signature) {
    throw new ApiError(400, "Missing Cashfree webhook signature headers");
  }

  const rawTimestamp = Number(timestamp);
  const timestampMs = rawTimestamp > 1_000_000_000_000
    ? rawTimestamp
    : rawTimestamp * 1000;
  const maxAgeMs = Math.max(
    60 * 1000,
    Number(process.env.CASHFREE_WEBHOOK_MAX_AGE_MS || 5 * 60 * 1000),
  );

  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > maxAgeMs) {
    throw new ApiError(401, "Stale Cashfree webhook signature");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new ApiError(401, "Invalid Cashfree webhook signature");
  }

  return true;
};

const getCashfreeOrderIdFromWebhook = (payload = {}) => {
  const candidates = [
    payload.order_id,
    payload.cashfreeOrderId,
    payload.data?.order_id,
    payload.data?.order?.order_id,
    payload.data?.payment?.order_id,
    payload.order?.order_id,
    payload.payment?.order_id,
  ];

  return candidates
    .map((value) => String(value || "").trim())
    .find(Boolean);
};

module.exports = {
  getCashfreeOrderIdFromWebhook,
  verifyCashfreeWebhookSignature,
};
