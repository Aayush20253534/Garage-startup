const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getCashfreeRequestConfig,
  getCashfreeRequestTimeoutMs,
} = require("../../src/config/cashfree");

test("Cashfree requests always use a bounded server-side timeout", () => {
  const previous = process.env.CASHFREE_REQUEST_TIMEOUT_MS;

  try {
    delete process.env.CASHFREE_REQUEST_TIMEOUT_MS;
    assert.equal(getCashfreeRequestTimeoutMs(), 15_000);
    assert.equal(getCashfreeRequestConfig().timeout, 15_000);

    process.env.CASHFREE_REQUEST_TIMEOUT_MS = "250";
    assert.equal(getCashfreeRequestTimeoutMs(), 1_000);

    process.env.CASHFREE_REQUEST_TIMEOUT_MS = "12000";
    assert.equal(getCashfreeRequestTimeoutMs(), 12_000);

    process.env.CASHFREE_REQUEST_TIMEOUT_MS = "90000";
    assert.equal(getCashfreeRequestTimeoutMs(), 30_000);
  } finally {
    if (previous === undefined) {
      delete process.env.CASHFREE_REQUEST_TIMEOUT_MS;
    } else {
      process.env.CASHFREE_REQUEST_TIMEOUT_MS = previous;
    }
  }
});

test("Cashfree request config merges headers without dropping credentials", () => {
  const previousId = process.env.CASHFREE_APP_ID;
  const previousSecret = process.env.CASHFREE_SECRET_KEY;

  try {
    process.env.CASHFREE_APP_ID = "test-id";
    process.env.CASHFREE_SECRET_KEY = "test-secret";

    const config = getCashfreeRequestConfig({
      headers: { "x-idempotency-key": "stable-key" },
    });

    assert.equal(config.headers["x-client-id"], "test-id");
    assert.equal(config.headers["x-client-secret"], "test-secret");
    assert.equal(config.headers["x-idempotency-key"], "stable-key");
  } finally {
    if (previousId === undefined) delete process.env.CASHFREE_APP_ID;
    else process.env.CASHFREE_APP_ID = previousId;

    if (previousSecret === undefined) delete process.env.CASHFREE_SECRET_KEY;
    else process.env.CASHFREE_SECRET_KEY = previousSecret;
  }
});
