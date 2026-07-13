const CASHFREE_API_VERSION =
  String(process.env.CASHFREE_API_VERSION || "2025-01-01").trim();

const getCashfreeMode = () =>
  process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";

const getCashfreeBaseUrl = () =>
  getCashfreeMode() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const isCashfreeConfigured = () =>
  Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);

const getCashfreeHeaders = () => ({
  "x-client-id": process.env.CASHFREE_APP_ID,
  "x-client-secret": process.env.CASHFREE_SECRET_KEY,
  "x-api-version": CASHFREE_API_VERSION,
  "Content-Type": "application/json",
  Accept: "application/json",
});

module.exports = {
  getCashfreeBaseUrl,
  getCashfreeHeaders,
  getCashfreeMode,
  isCashfreeConfigured,
};
