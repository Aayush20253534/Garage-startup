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

const DEFAULT_CASHFREE_REQUEST_TIMEOUT_MS = 15_000;
const MIN_CASHFREE_REQUEST_TIMEOUT_MS = 1_000;
const MAX_CASHFREE_REQUEST_TIMEOUT_MS = 30_000;

const getCashfreeRequestTimeoutMs = () => {
  const configured = Number(process.env.CASHFREE_REQUEST_TIMEOUT_MS);

  if (!Number.isFinite(configured)) {
    return DEFAULT_CASHFREE_REQUEST_TIMEOUT_MS;
  }

  return Math.min(
    MAX_CASHFREE_REQUEST_TIMEOUT_MS,
    Math.max(MIN_CASHFREE_REQUEST_TIMEOUT_MS, Math.trunc(configured)),
  );
};

const getCashfreeRequestConfig = (overrides = {}) => ({
  timeout: getCashfreeRequestTimeoutMs(),
  ...overrides,
  headers: {
    ...getCashfreeHeaders(),
    ...(overrides.headers || {}),
  },
});

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
  getCashfreeRequestConfig,
  getCashfreeRequestTimeoutMs,
  isCashfreeConfigured,
};
