const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  getCashfreeOrderStatus,
  isReconcilingCashfreeOrder,
  isReusableCashfreeOrder,
  isTerminalCashfreeOrder,
} = require("../../src/customer/security/cashfreeOrderStatus");
const {
  getCashfreeIdempotencyKey,
} = require("../../src/customer/security/cashfreeIdempotency");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Cashfree order states are classified without undefined runtime constants", () => {
  assert.equal(getCashfreeOrderStatus({ order_status: " active " }), "ACTIVE");
  assert.equal(isReusableCashfreeOrder("ACTIVE"), true);
  assert.equal(isTerminalCashfreeOrder("EXPIRED"), true);
  assert.equal(isTerminalCashfreeOrder("TERMINATED"), true);
  assert.equal(isReconcilingCashfreeOrder("TERMINATION_REQUESTED"), true);
  assert.equal(isReusableCashfreeOrder("PAID"), false);
  assert.equal(isTerminalCashfreeOrder("PAID"), false);
});

test("Cashfree create-order idempotency keys are stable per order and unique across attempts", () => {
  const first = getCashfreeIdempotencyKey("cf_booking_attempt_one");
  const repeated = getCashfreeIdempotencyKey("cf_booking_attempt_one");
  const second = getCashfreeIdempotencyKey("cf_booking_attempt_two");

  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(first, repeated);
  assert.notEqual(first, second);
});

test("booking payment reconciles popup errors and preloads Cashfree in parallel", () => {
  const paymentClient = read("client/src/utils/bookingPayment.js");
  const pendingBookings = read(
    "client/src/pages/customer/PendingBookings.jsx",
  );
  const paymentService = read(
    "server/src/customer/services/payment.service.js",
  );

  assert.match(paymentClient, /let cashfreeSdkPromise = null/);
  assert.match(paymentClient, /let cashfreeReadyPromise = null/);
  assert.match(
    paymentClient,
    /if \(!walletOnlyExpected\)[\s\S]*cashfreeReadyPromise = loadCashfreeCheckout\(\)\.catch/,
  );
  assert.match(
    paymentClient,
    /if \(!cashfreeReadyPromise\)[\s\S]*cashfreeReadyPromise = loadCashfreeCheckout\(\)\.catch/,
  );
  assert.ok(
    paymentClient.indexOf("cashfreeReadyPromise = loadCashfreeCheckout()") <
      paymentClient.indexOf("const result = await requestBookingPaymentOrder"),
    "gateway checkout should start loading before the payment-order request",
  );
  assert.match(paymentClient, /reconcileCheckoutAttempt\(booking\.id\)/);
  assert.match(paymentClient, /VERIFY_RETRY_DELAYS_MS/);
  assert.match(paymentService, /isReusableCashfreeOrder/);
  assert.match(paymentService, /getCashfreeIdempotencyKey/);
  assert.match(paymentService, /PAYMENT_INCOMPLETE/);
  assert.doesNotMatch(
    paymentService,
    /REUSABLE_CASHFREE_ORDER_STATUSES\.has/,
  );
  assert.doesNotMatch(
    paymentService,
    /TERMINAL_CASHFREE_ORDER_STATUSES\.has/,
  );
  assert.doesNotMatch(
    pendingBookings,
    /Please retry payment after fixing the issue/,
  );
});
