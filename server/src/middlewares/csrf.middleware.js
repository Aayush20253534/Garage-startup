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

  if (!hasAuthCookie(req)) {
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
};
