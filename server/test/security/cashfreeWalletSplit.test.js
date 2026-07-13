const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  getStoredPaymentSplit,
  isSamePaymentSplit,
} = require("../../src/customer/security/cashfreePaymentSplit");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Cashfree payment split compares wallet and remaining gateway amount", () => {
  const payment = {
    walletAmountUsed: 20,
    upiAmountPaid: 29,
  };

  assert.deepEqual(getStoredPaymentSplit(payment), {
    walletAmountUsed: 20,
    upiAmountPaid: 29,
  });
  assert.equal(
    isSamePaymentSplit(payment, {
      walletAmountUsed: 20,
      upiAmountPaid: 29,
    }),
    true,
  );
  assert.equal(
    isSamePaymentSplit(payment, {
      walletAmountUsed: 49,
      upiAmountPaid: 0,
    }),
    false,
  );
  assert.equal(
    isSamePaymentSplit(payment, {
      walletAmountUsed: 0,
      upiAmountPaid: 49,
    }),
    false,
  );
});

test("wallet split changes terminate the stale Cashfree order before replacement", () => {
  const paymentService = read(
    "server/src/customer/services/payment.service.js",
  );
  const pendingBookings = read(
    "client/src/pages/customer/PendingBookings.jsx",
  );
  const paymentClient = read("client/src/utils/bookingPayment.js");

  assert.match(paymentService, /kind: "SPLIT_CHANGED"/);
  assert.match(paymentService, /isSamePaymentSplit\(booking\.payment, split\)/);
  assert.match(paymentService, /order_status: "TERMINATED"/);
  assert.match(
    paymentService,
    /closeCashfreeOrderForPaymentSplitChange\(reservation\)/,
  );
  assert.match(paymentService, /recordFailureActivity: false/);
  assert.match(
    pendingBookings,
    /Changing this option safely refreshes the payment amount/,
  );
  assert.doesNotMatch(
    pendingBookings,
    /hasCreatedCashfreeWalletOrder/,
  );
  assert.match(
    paymentClient,
    /result\.booking && result\.payment\?\.status === "PAID"/,
  );
  assert.doesNotMatch(
    paymentClient,
    /result\.booking && \(!cashfreeOrder/,
  );
});
