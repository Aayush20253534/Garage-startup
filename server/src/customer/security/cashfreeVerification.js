const ApiError = require("../../utils/apiError");

const toWholeRupee = (value, fallback = 0) => {
  const amount = Math.round(Number(value));
  return Number.isFinite(amount) && amount > 0 ? amount : fallback;
};

const getCashfreePayableAmount = (payment = {}) => {
  const upiAmount = Math.round(Number(payment.upiAmountPaid));

  if (Number.isFinite(upiAmount) && upiAmount > 0) {
    return upiAmount;
  }

  if (toWholeRupee(payment.walletAmountUsed) > 0) {
    return 0;
  }

  return toWholeRupee(payment.amount);
};

const assertCashfreeOrderMatchesPayment = (cashfreeOrder = {}, payment = {}) => {
  const cashfreeAmount = Number(cashfreeOrder.order_amount);
  const localCashfreeAmount = getCashfreePayableAmount(payment);
  const cashfreeCurrency = String(cashfreeOrder.order_currency || "").toUpperCase();
  const localCurrency = String(payment.currency || "INR").toUpperCase();

  if (cashfreeOrder.order_id !== payment.cashfreeOrderId) {
    throw new ApiError(400, "Cashfree order ID mismatch");
  }

  if (!Number.isFinite(cashfreeAmount) || cashfreeAmount !== localCashfreeAmount) {
    throw new ApiError(400, "Cashfree payment amount mismatch");
  }

  if (cashfreeCurrency !== localCurrency) {
    throw new ApiError(400, "Cashfree payment currency mismatch");
  }
};

module.exports = {
  assertCashfreeOrderMatchesPayment,
  getCashfreePayableAmount,
};
