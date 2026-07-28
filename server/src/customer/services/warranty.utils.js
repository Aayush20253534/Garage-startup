const WARRANTY_DURATION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getActivationDate = (booking) =>
  booking.customerAcceptedAt || booking.deliveredAt || booking.updatedAt;

const buildWarrantyRecord = (booking, now = new Date()) => {
  const activatedAt = new Date(getActivationDate(booking));
  const expiresAt = new Date(
    activatedAt.getTime() + WARRANTY_DURATION_DAYS * DAY_IN_MS,
  );
  const remainingMs = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / DAY_IN_MS));
  const isActive = remainingMs > 0;

  return {
    id: booking.id,
    warrantyId: `W-${booking.bookingCode}`,
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    status: isActive ? "ACTIVE" : "EXPIRED",
    isActive,
    durationDays: WARRANTY_DURATION_DAYS,
    daysRemaining,
    activatedAt,
    expiresAt,
    services: booking.services
      .map((item) => item.service)
      .filter(Boolean),
    vehicle: booking.vehicle,
    garage: booking.garage,
  };
};

module.exports = {
  WARRANTY_DURATION_DAYS,
  DAY_IN_MS,
  buildWarrantyRecord,
};
