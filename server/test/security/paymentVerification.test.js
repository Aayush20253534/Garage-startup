const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/rovauto_test";
process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret-1234";

const ApiError = require("../../src/utils/apiError");
const {
  assertCashfreeOrderMatchesPayment,
} = require("../../src/customer/security/cashfreeVerification");

const payment = {
  cashfreeOrderId: "cf_booking_1",
  amount: 500,
  upiAmountPaid: 400,
  walletAmountUsed: 100,
  currency: "INR",
};

test("Cashfree verification accepts exact ID, payable amount, and currency", () => {
  assert.doesNotThrow(() =>
    assertCashfreeOrderMatchesPayment(
      { order_id: "cf_booking_1", order_amount: 400, order_currency: "INR" },
      payment,
    ),
  );
});

test("Cashfree verification rejects order ID, amount, and currency mismatches", () => {
  for (const order of [
    { order_id: "other", order_amount: 400, order_currency: "INR" },
    { order_id: "cf_booking_1", order_amount: 401, order_currency: "INR" },
    { order_id: "cf_booking_1", order_amount: 400, order_currency: "USD" },
  ]) {
    assert.throws(
      () => assertCashfreeOrderMatchesPayment(order, payment),
      (error) => error instanceof ApiError && error.statusCode === 400,
    );
  }
});
