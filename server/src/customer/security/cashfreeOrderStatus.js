const REUSABLE_CASHFREE_ORDER_STATUSES = new Set(["ACTIVE"]);
const TERMINAL_CASHFREE_ORDER_STATUSES = new Set([
  "EXPIRED",
  "TERMINATED",
  "FAILED",
  "CANCELLED",
  "CANCELED",
]);
const RECONCILING_CASHFREE_ORDER_STATUSES = new Set([
  "TERMINATION_REQUESTED",
]);

const getCashfreeOrderStatus = (cashfreeOrder) =>
  String(cashfreeOrder?.order_status || "").trim().toUpperCase();

const isReusableCashfreeOrder = (cashfreeOrder) =>
  REUSABLE_CASHFREE_ORDER_STATUSES.has(
    typeof cashfreeOrder === "string"
      ? cashfreeOrder.trim().toUpperCase()
      : getCashfreeOrderStatus(cashfreeOrder),
  );

const isTerminalCashfreeOrder = (cashfreeOrder) =>
  TERMINAL_CASHFREE_ORDER_STATUSES.has(
    typeof cashfreeOrder === "string"
      ? cashfreeOrder.trim().toUpperCase()
      : getCashfreeOrderStatus(cashfreeOrder),
  );

const isReconcilingCashfreeOrder = (cashfreeOrder) =>
  RECONCILING_CASHFREE_ORDER_STATUSES.has(
    typeof cashfreeOrder === "string"
      ? cashfreeOrder.trim().toUpperCase()
      : getCashfreeOrderStatus(cashfreeOrder),
  );

module.exports = {
  getCashfreeOrderStatus,
  isReconcilingCashfreeOrder,
  isReusableCashfreeOrder,
  isTerminalCashfreeOrder,
  RECONCILING_CASHFREE_ORDER_STATUSES,
  REUSABLE_CASHFREE_ORDER_STATUSES,
  TERMINAL_CASHFREE_ORDER_STATUSES,
};
