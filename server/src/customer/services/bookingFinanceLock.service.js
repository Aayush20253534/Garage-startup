const getBookingFinanceLockKey = (bookingId) =>
  `booking-finance:${bookingId}`;

/**
 * Serialize all money-moving state transitions for a booking.
 *
 * PostgreSQL transaction-scoped advisory locks are released automatically
 * when the surrounding Prisma transaction commits or rolls back. Every
 * booking payment, refund, cancellation, and order-reservation path must take
 * this lock before reading the current financial state.
 */
const lockBookingFinance = async (bookingId, { tx } = {}) => {
  if (!tx?.$executeRaw) {
    throw new Error(
      "lockBookingFinance must be called inside a Prisma transaction",
    );
  }

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${getBookingFinanceLockKey(
      bookingId,
    )})::bigint)
  `;
};

module.exports = {
  getBookingFinanceLockKey,
  lockBookingFinance,
};
