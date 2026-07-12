const test = require("node:test");
const assert = require("node:assert/strict");

const {
  csrfProtection,
  getRequestPath,
  isBrowserRequest,
  isSessionEstablishingPath,
  isWebhookPath,
  requiresCsrfProtection,
} = require("../../src/middlewares/csrf.middleware");

const req = (path, overrides = {}) => ({
  originalUrl: path,
  method: "POST",
  cookies: {},
  get(name) {
    return overrides.headers?.[String(name).toLowerCase()] || "";
  },
  ...overrides,
});

test("CSRF bypass accepts only exact Cashfree and WhatsApp webhook paths", () => {
  assert.equal(isWebhookPath(req("/api/v1/webhooks/cashfree")), true);
  assert.equal(isWebhookPath(req("/api/v1/webhooks/cashfree/")), true);
  assert.equal(isWebhookPath(req("/api/v1/webhooks/whatsapp/webhook")), true);
  assert.equal(isWebhookPath(req("/api/v1/whatsapp/webhook?hub.mode=subscribe")), true);
});

test("CSRF bypass rejects webhook-like prefixes and sibling routes", () => {
  assert.equal(isWebhookPath(req("/api/v1/webhooks/cashfree-evil")), false);
  assert.equal(isWebhookPath(req("/api/v1/webhooks/cashfree/status")), false);
  assert.equal(isWebhookPath(req("/api/v1/whatsapp/health")), false);
  assert.equal(isWebhookPath(req("/api/v1/webhooks/whatsapp")), false);
});

test("request path normalization removes query strings and trailing slashes only", () => {
  assert.equal(getRequestPath(req("/api/v1/webhooks/cashfree/?x=1")), "/api/v1/webhooks/cashfree");
  assert.equal(getRequestPath(req("/")), "/");
});

test("session-establishing browser auth routes require CSRF before login", () => {
  const browserLogin = req("/api/v1/auth/login", {
    headers: { origin: "https://www.rovauto.com" },
  });

  assert.equal(isBrowserRequest(browserLogin), true);
  assert.equal(isSessionEstablishingPath(browserLogin), true);
  assert.equal(requiresCsrfProtection(browserLogin), true);

  const nonBrowserLogin = req("/api/v1/auth/login");
  assert.equal(isBrowserRequest(nonBrowserLogin), false);
  assert.equal(requiresCsrfProtection(nonBrowserLogin), false);
});

test("all browser routes that can establish a session are explicitly protected", () => {
  for (const path of [
    "/api/v1/auth/login",
    "/api/v1/auth/support/login",
    "/api/v1/auth/google",
    "/api/v1/auth/verify-otp",
    "/api/v1/auth/staff/verify-otp",
  ]) {
    assert.equal(isSessionEstablishingPath(req(path)), true, path);
  }

  assert.equal(isSessionEstablishingPath(req("/api/v1/auth/forgot-password")), false);
  assert.equal(isSessionEstablishingPath(req("/api/v1/auth/login-evil")), false);
});

test("browser login without a matching double-submit token is rejected", () => {
  let issuedCookie = null;
  const request = req("/api/v1/auth/login", {
    headers: { origin: "https://www.rovauto.com" },
  });
  const response = {
    cookie(name, value) {
      issuedCookie = { name, value };
    },
  };

  let nextError = null;
  csrfProtection(request, response, (error) => {
    nextError = error || null;
  });

  assert.ok(issuedCookie?.value);
  assert.equal(nextError?.statusCode, 403);
  assert.equal(nextError?.message, "Invalid CSRF token");
});

test("browser login with a matching cookie and header is accepted", () => {
  const token = "a".repeat(43);
  const request = req("/api/v1/auth/login", {
    cookies: { rovautoCsrf: token },
    headers: {
      origin: "https://www.rovauto.com",
      "x-csrf-token": token,
    },
  });
  const response = { cookie() {} };

  let nextError = "not-called";
  csrfProtection(request, response, (error) => {
    nextError = error || null;
  });

  assert.equal(nextError, null);
});
