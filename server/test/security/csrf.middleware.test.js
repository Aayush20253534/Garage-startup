const test = require("node:test");
const assert = require("node:assert/strict");

const { getRequestPath, isWebhookPath } = require("../../src/middlewares/csrf.middleware");

const req = (path) => ({ originalUrl: path });

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
