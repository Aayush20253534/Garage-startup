const getPaymentReference = (payment = {}) =>
  payment.cashfreeOrderId || payment.id || "wallet-only";

const getBookingPaymentIdempotencyKey = (bookingId, paymentReference) =>
  `booking-payment:${bookingId}:${paymentReference || "wallet-only"}`;

const getBookingRefundIdempotencyKey = (bookingId, paymentReference) =>
  `booking-refund:${bookingId}:${paymentReference || "wallet-only"}`;

module.exports = {
  getBookingPaymentIdempotencyKey,
  getBookingRefundIdempotencyKey,
  getPaymentReference,
};
