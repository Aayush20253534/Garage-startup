const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { withUniqueBookingCode } = require("../../utils/bookingCode");
const garageRequestService = require("../../services/garageRequest.service");
const {
  ensureVehicleHasNoActiveBooking,
  isActiveVehicleBookingConflictError,
  lockAndEnsureVehicleHasNoActiveBooking,
} = require("./vehicleBookingGuard.service");

const BOOKING_STATUS = require("../../constants/bookingStatus");
const REQUEST_TYPE = require("../../constants/requestType");
const PAYMENT_STATUS = require("../../constants/paymentStatus");

const SOS_CHARGE = 50;
const SOS_ESTIMATED_AMOUNT = 500;
const SOS_SERVICE_NAME = "SOS Emergency Assistance";

const createSosRequest = async (userId, data) => {
  const { vehicleId, latitude, longitude, address, note } = data;

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      userId,
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  await ensureVehicleHasNoActiveBooking(userId, vehicleId);

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet || wallet.balance < SOS_CHARGE) {
    throw new ApiError(400, "Insufficient RovAuto coins for SOS");
  }

  const sosService = await prisma.service.findFirst({
    where: {
      name: SOS_SERVICE_NAME,
      isActive: true,
    },
  });

  if (!sosService) {
    throw new ApiError(
      500,
      "SOS service is not configured. Add an active SOS Emergency Assistance service from admin."
    );
  }

  let booking;

  try {
    booking = await withUniqueBookingCode((bookingCode) =>
      prisma.$transaction(async (tx) => {
        await lockAndEnsureVehicleHasNoActiveBooking(userId, vehicleId, {
          tx,
        });

        return tx.booking.create({
          data: {
            userId,
            vehicleId,
            garageId: null,
            bookingCode,
            requestType: REQUEST_TYPE.SOS,
            status: BOOKING_STATUS.SEARCHING_GARAGE,
            garageSearchRound: 0,
            garageSearchCycle: 1,
            searchRadiusKm: null,
            customerLatitude: Number(latitude),
            customerLongitude: Number(longitude),
            customerAddress: address || null,
            customerNote: note || "SOS emergency request",
            handlingFee: SOS_CHARGE,
            totalServiceAmount: SOS_ESTIMATED_AMOUNT,
            totalServiceMaxAmount: SOS_ESTIMATED_AMOUNT + 500,
            walletAmountUsed: 0,
            payableAmount: 0,
            services: {
              create: {
                serviceId: sosService.id,
                quantity: 1,
                estimatedPrice: SOS_ESTIMATED_AMOUNT,
                estimatedMinPrice: SOS_ESTIMATED_AMOUNT,
                estimatedMaxPrice: SOS_ESTIMATED_AMOUNT + 500,
              },
            },
            payment: {
              create: {
                amount: 0,
                currency: "INR",
                status: PAYMENT_STATUS.PAID,
                walletAmountUsed: 0,
                upiAmountPaid: 0,
              },
            },
          },
          include: {
            vehicle: true,
            services: {
              include: {
                service: {
                  include: {
                    category: true,
                    media: true,
                  },
                },
              },
            },
            payment: true,
          },
        });
      }),
    );
  } catch (error) {
    if (isActiveVehicleBookingConflictError(error)) {
      await ensureVehicleHasNoActiveBooking(userId, vehicleId);
    }

    throw error;
  }

  try {
    const requests =
      await garageRequestService.broadcastBookingToNearbyGarages(booking.id);

    return {
      booking,
      requests,
      message: "SOS signal sent to nearby garages",
    };
  } catch (error) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BOOKING_STATUS.EXPIRED,
        expiredAt: new Date(),
      },
    });

    throw error;
  }
};

const getSosRequestById = async (userId, bookingId) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
      requestType: REQUEST_TYPE.SOS,
    },
    include: {
      vehicle: true,
      garage: true,
      services: {
        include: {
          service: {
            include: {
              category: true,
              media: true,
            },
          },
        },
      },
      broadcasts: {
        include: {
          garage: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      payment: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "SOS request not found");
  }

  return booking;
};

module.exports = {
  createSosRequest,
  getSosRequestById,
};
