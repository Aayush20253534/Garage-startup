const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Cashfree payment sessions are recovered without requiring a second tap", () => {
  const paymentService = read(
    "server/src/customer/services/payment.service.js",
  );
  const paymentClient = read("client/src/utils/bookingPayment.js");
  const pendingBookings = read(
    "client/src/pages/customer/PendingBookings.jsx",
  );
  const cashfreeConfig = read("server/src/config/cashfree.js");

  assert.match(paymentService, /CASHFREE_PAYMENT_SESSION_POLL_DELAYS_MS/);
  assert.match(paymentService, /fetchCashfreeOrderUntilSessionReady/);
  assert.match(paymentService, /initialOrder: cashfreeOrder/);
  assert.match(paymentClient, /PAYMENT_ORDER_RETRY_DELAYS_MS/);
  assert.match(paymentClient, /isRetryablePaymentOrderError/);
  assert.match(paymentClient, /RETRYABLE_PAYMENT_NETWORK_CODES/);
  assert.match(paymentClient, /requestBookingPaymentOrder/);
  assert.match(
    paymentClient,
    /result\.booking && result\.payment\?\.status === "PAID"/,
  );
  assert.doesNotMatch(
    paymentClient,
    /result\.booking && \(!cashfreeOrder/,
  );
  assert.doesNotMatch(
    pendingBookings,
    /Wait a few seconds, then tap Pay again/,
  );
  assert.match(
    paymentService,
    /409,[\s\S]{0,180}PAYMENT_SESSION_UNAVAILABLE/,
  );
  assert.match(cashfreeConfig, /CASHFREE_API_VERSION/);
  assert.match(cashfreeConfig, /2025-01-01/);
});
