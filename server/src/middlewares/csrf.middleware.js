const crypto = require("crypto");

const ApiError = require("../utils/apiError");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SUPPORT_ACCESS_TOKEN_COOKIE_NAME,
  csrfCookieOptions,
} = require("../config/authCookie");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const createCsrfToken = () => crypto.randomBytes(32).toString("base64url");

const getRequestPath = (req) => {
  const rawPath = String(req.originalUrl || req.url || "");
  const pathOnly = rawPath.split("?")[0] || "/";
  return pathOnly.length > 1 ? pathOnly.replace(/\/+$/, "") : pathOnly;
};

const WEBHOOK_PATHS = new Set([
  "/api/v1/webhooks/cashfree",
  "/api/v1/webhooks/whatsapp/webhook",
  "/api/v1/whatsapp/webhook",
]);

/*
 * These endpoints create a new authenticated browser session. They need CSRF
 * protection even before an authentication cookie exists, otherwise another
 * site could log a victim into an attacker-controlled Rovauto account.
 */
const SESSION_ESTABLISHING_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/support/login",
  "/api/v1/auth/google",
  "/api/v1/auth/verify-otp",
  "/api/v1/auth/staff/verify-otp",
]);

const seedCsrfCookie = (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  const token =
    typeof existing === "string" && existing.length >= 32
      ? existing
      : createCsrfToken();

  if (token !== existing) {
    res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
  }

  return token;
};

const hasAuthCookie = (req) =>
  Boolean(
    req.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ||
      req.cookies?.[SUPPORT_ACCESS_TOKEN_COOKIE_NAME],
  );

const isWebhookPath = (req) => WEBHOOK_PATHS.has(getRequestPath(req));

const isSessionEstablishingPath = (req) =>
  SESSION_ESTABLISHING_PATHS.has(getRequestPath(req));

const isBrowserRequest = (req) =>
  Boolean(
    req.get?.("origin") ||
      req.get?.("sec-fetch-site") ||
      req.get?.("sec-fetch-mode"),
  );

const requiresCsrfProtection = (req) =>
  hasAuthCookie(req) ||
  (isSessionEstablishingPath(req) && isBrowserRequest(req));

const isValidCsrfPair = (cookieToken, headerToken) => {
  if (!cookieToken || !headerToken) return false;

  const cookieBuffer = Buffer.from(String(cookieToken));
  const headerBuffer = Buffer.from(String(headerToken));

  return (
    cookieBuffer.length === headerBuffer.length &&
    crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  );
};

const csrfProtection = (req, res, next) => {
  const cookieToken = seedCsrfCookie(req, res);

  if (SAFE_METHODS.has(req.method) || isWebhookPath(req)) {
    return next();
  }

  if (!requiresCsrfProtection(req)) {
    return next();
  }

  const headerToken = req.get(CSRF_HEADER_NAME);

  if (!isValidCsrfPair(cookieToken, headerToken)) {
    return next(new ApiError(403, "Invalid CSRF token"));
  }

  return next();
};

const getCsrfToken = (req, res) => {
  const token = seedCsrfCookie(req, res);
  return res.status(200).json({
    success: true,
    message: "CSRF token issued",
    data: {
      token,
      headerName: CSRF_HEADER_NAME,
    },
  });
};

module.exports = {
  csrfProtection,
  getCsrfToken,
  seedCsrfCookie,
  getRequestPath,
  isWebhookPath,
  isBrowserRequest,
  isSessionEstablishingPath,
  requiresCsrfProtection,
};
