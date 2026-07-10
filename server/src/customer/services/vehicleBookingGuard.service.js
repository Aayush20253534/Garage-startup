const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const BOOKING_STATUS = require("../../constants/bookingStatus");

const ACTIVE_VEHICLE_BOOKING_STATUSES = [
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.SEARCHING_GARAGE,
  BOOKING_STATUS.GARAGE_ASSIGNED,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.IN_PROGRESS,
];

const buildActiveBookingMessage = (booking) => {
  const bookingLabel = booking.bookingCode || booking.id;

  return `This vehicle already has an active booking (${bookingLabel}). Complete or cancel that booking before booking this vehicle again.`;
};

const findActiveVehicleBooking = async (
  userId,
  vehicleId,
  { tx = prisma } = {},
) =>
  tx.booking.findFirst({
    where: {
      userId,
      vehicleId,
      status: { in: ACTIVE_VEHICLE_BOOKING_STATUSES },
    },
    select: {
      id: true,
      bookingCode: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

const ensureVehicleHasNoActiveBooking = async (
  userId,
  vehicleId,
  options = {},
) => {
  const activeBooking = await findActiveVehicleBooking(
    userId,
    vehicleId,
    options,
  );

  if (activeBooking) {
    throw new ApiError(409, buildActiveBookingMessage(activeBooking));
  }

  return true;
};

module.exports = {
  ACTIVE_VEHICLE_BOOKING_STATUSES,
  ensureVehicleHasNoActiveBooking,
  findActiveVehicleBooking,
};
