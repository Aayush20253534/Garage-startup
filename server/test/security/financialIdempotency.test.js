const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getBookingPaymentIdempotencyKey,
  getBookingRefundIdempotencyKey,
  getPaymentReference,
} = require("../../src/customer/services/bookingFinancialIdempotency");
const {
  getBookingFinanceLockKey,
} = require("../../src/customer/services/bookingFinanceLock.service");

test("wallet ledger keys are stable for repeated delivery of one payment", () => {
  const payment = { id: "pay-1", cashfreeOrderId: "cf-order-1" };
  const reference = getPaymentReference(payment);

  assert.equal(reference, "cf-order-1");
  assert.equal(
    getBookingPaymentIdempotencyKey("booking-1", reference),
    getBookingPaymentIdempotencyKey("booking-1", reference),
  );
  assert.equal(
    getBookingRefundIdempotencyKey("booking-1", reference),
    getBookingRefundIdempotencyKey("booking-1", reference),
  );
});

test("separate Cashfree attempts cannot collide in the wallet ledger", () => {
  assert.notEqual(
    getBookingPaymentIdempotencyKey("booking-1", "cf-order-1"),
    getBookingPaymentIdempotencyKey("booking-1", "cf-order-2"),
  );
  assert.notEqual(
    getBookingRefundIdempotencyKey("booking-1", "cf-order-1"),
    getBookingRefundIdempotencyKey("booking-1", "cf-order-2"),
  );
});

test("booking finance locks are stable per booking and isolated across bookings", () => {
  assert.equal(
    getBookingFinanceLockKey("booking-1"),
    getBookingFinanceLockKey("booking-1"),
  );
  assert.notEqual(
    getBookingFinanceLockKey("booking-1"),
    getBookingFinanceLockKey("booking-2"),
  );
});
