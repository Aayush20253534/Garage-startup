const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const generateBookingCode = require("../../utils/bookingCode");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { deletePattern } = require("../../utils/cache");
const {
  addGarageWhatsappLink,
  createWhatsappLink,
} = require("../../utils/whatsapp");
const bookingLifecycleService = require("../../services/bookingLifecycle.service");
const garageRequestService = require("../../services/garageRequest.service");
const cityServicePriceRangeService = require("../../admin/services/cityServicePriceRange.service");
const cityService = require("../../services/city.service");
const { calculatePlatformFee } = require("../../utils/platformFee");

const bookingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  vehicle: true,
  garage: true,
  services: {
    include: {
      service: {
        include: {
          category: true,
          media: {
            orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
          },
        },
      },
    },
  },
  payment: true,
  broadcasts: {
    include: {
      garage: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  },
  review: true,
  complaints: true,
  inspectionImages: {
    orderBy: [{ phase: "asc" }, { order: "asc" }],
  },
};

const ALLOWED_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];

const getBookingCity = async (location = {}) => {
  const city = await cityService.requireActiveCityFromLocation(location);
  return city.name;
};

const getBookingServiceRange = (service, priceRangeMap = new Map()) => {
  const adminRange = priceRangeMap.get(service.id);

  if (!adminRange) return null;

  return {
    min: Number(adminRange.minPrice) || 0,
    max:
      Number(adminRange.maxPrice) ||
      Number(adminRange.minPrice) ||
      0,
  };
};

const sumServiceRanges = (services = [], priceRangeMap = new Map()) => {
  return services.reduce(
    (total, service) => {
      const range = getBookingServiceRange(service, priceRangeMap);

      if (!range) {
        throw new ApiError(
          400,
          `Price range is not configured for ${service.name} in this city and vehicle.`,
        );
      }

      return {
        min: total.min + range.min,
        max: total.max + range.max,
      };
    },
    { min: 0, max: 0 },
  );
};

const normalizeStatuses = (status) => {
  if (!status) return [];

  const statuses = String(status)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const invalidStatus = statuses.find(
    (item) => !ALLOWED_BOOKING_STATUSES.includes(item),
  );

  if (invalidStatus) {
    throw new ApiError(400, `Invalid booking status: ${invalidStatus}`);
  }

  return [...new Set(statuses)].sort();
};

const invalidateBookingCaches = async (userId) => {
  await Promise.allSettled([
    deletePattern(`customer:${userId}:bookings:*`),
    deletePattern(`customer:${userId}:booking:*`),
    invalidateCustomerCache(userId),
  ]);
};


const getPaidBookingRefundAmount = (booking) => {
  if (!booking?.payment || booking.payment.status !== "PAID") {
    return 0;
  }

  const upiAmountPaid = Number(
    booking.payment.upiAmountPaid ?? booking.payment.amount ?? 0,
  );
  const walletAmountUsed = Number(
    booking.payment.walletAmountUsed ?? booking.walletAmountUsed ?? 0,
  );
  const fallbackPaidAmount = Number(
    booking.payment.amount ?? booking.payableAmount ?? booking.handlingFee ?? 0,
  );

  const refundAmount =
    (Number.isFinite(upiAmountPaid) ? upiAmountPaid : 0) +
    (Number.isFinite(walletAmountUsed) ? walletAmountUsed : 0);

  const normalizedAmount = refundAmount > 0 ? refundAmount : fallbackPaidAmount;

  return Number.isInteger(normalizedAmount) && normalizedAmount > 0
    ? normalizedAmount
    : Math.max(0, Math.round(normalizedAmount || 0));
};

const refundPaidBookingToWallet = async ({ tx, booking, refundAmount }) => {
  if (!refundAmount || refundAmount <= 0 || !booking?.payment) {
    return null;
  }

  let wallet = await tx.wallet.findUnique({
    where: { userId: booking.userId },
  });

  if (!wallet) {
    wallet = await tx.wallet.create({
      data: {
        userId: booking.userId,
        type: "CUSTOMER",
        balance: 0,
      },
    });
  }

  const balanceAfter = wallet.balance + refundAmount;

  const updatedWallet = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: balanceAfter },
  });

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId: booking.userId,
      type: "BOOKING_REFUND",
      status: "SUCCESS",
      amount: refundAmount,
      balanceAfter,
      cashfreeOrderId: booking.payment.cashfreeOrderId || null,
      cashfreePaymentId: booking.payment.cashfreePaymentId || null,
      description: `Refund for cancelled booking ${booking.bookingCode}`,
    },
  });

  const payment = await tx.payment.update({
    where: { bookingId: booking.id },
    data: { status: "REFUNDED" },
  });

  return {
    amount: refundAmount,
    wallet: updatedWallet,
    transaction,
    payment,
  };
};

const createBooking = async (userId, data) => {
  const {
    vehicleId,
    serviceIds,
    scheduledDate,
    startTime,
    endTime,
    customerNote,
    location,
  } = data;

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new ApiError(400, "At least one service is required");
  }

  if (
    location?.latitude === null ||
    location?.latitude === undefined ||
    location?.longitude === null ||
    location?.longitude === undefined
  ) {
    throw new ApiError(400, "Customer location is required");
  }

  const uniqueServiceIds = [...new Set(serviceIds)];

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      userId,
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  const services = await prisma.service.findMany({
    where: {
      id: { in: uniqueServiceIds },
      isActive: true,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          isComingSoon: true,
        },
      },
    },
  });

  if (services.length !== uniqueServiceIds.length) {
    throw new ApiError(404, "One or more services are invalid");
  }

  const comingSoonServices = services.filter(
    (service) =>
      service.isComingSoon || service.category?.isComingSoon,
  );

  if (comingSoonServices.length > 0) {
    const serviceNames = comingSoonServices
      .map((service) => service.name)
      .join(", ");

    throw new ApiError(
      409,
      `${serviceNames} ${
        comingSoonServices.length === 1 ? "is" : "are"
      } coming soon and cannot be booked yet.`,
    );
  }

  const bookingCity = await getBookingCity(location);
  const customerAddress = cityService.ensureAddressContainsCity(
    location.address || location.city || "",
    bookingCity,
  );

  const priceRangeMap =
    await cityServicePriceRangeService.findBestPriceRangesForBooking({
      city: bookingCity,
      services,
      vehicle,
    });

  const serviceRangeTotal = sumServiceRanges(
    services,
    priceRangeMap,
  );
  const totalServiceAmount = serviceRangeTotal.min;
  const totalServiceMaxAmount = serviceRangeTotal.max;
  // Fee brackets are determined from the combined service upper limit.
  const serviceUpperLimit = Math.max(
    totalServiceAmount,
    totalServiceMaxAmount,
  );
  const handlingFee = calculatePlatformFee(serviceUpperLimit);

  const walletAmountUsed = 0;
  const payableAmount = handlingFee;
  const bookingCode = await generateBookingCode();

  const booking = await prisma.$transaction(async (tx) => {
    return tx.booking.create({
      data: {
        userId,
        vehicleId,
        garageId: null,
        bookingCode,
        scheduledDate: scheduledDate
          ? new Date(scheduledDate)
          : null,
        startTime: startTime || null,
        endTime: endTime || null,
        requestType: "NORMAL",
        status: "PENDING_PAYMENT",

        // Payment verification starts the first two-minute garage search round.
        searchExpiresAt: null,

        customerLatitude: Number(location.latitude),
        customerLongitude: Number(location.longitude),
        customerAddress: customerAddress || null,
        customerPlaceId: location.placeId || null,
        customerNote: customerNote || null,
        handlingFee,
        totalServiceAmount,
        totalServiceMaxAmount,
        walletAmountUsed,
        payableAmount,
        services: {
          create: services.map((service) => {
            const range = getBookingServiceRange(
              service,
              priceRangeMap,
            );

            return {
              serviceId: service.id,
              quantity: 1,
              estimatedPrice: range.min,
              estimatedMinPrice: range.min,
              estimatedMaxPrice: range.max,
            };
          }),
        },
      },
      include: bookingInclude,
    });
  });

  await invalidateBookingCaches(userId);

  return prisma.booking.findUnique({
    where: { id: booking.id },
    include: bookingInclude,
  });
};

const getMyBookings = async (userId, query = {}) => {
  const statuses = normalizeStatuses(query.status);

  const searchingBookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "SEARCHING_GARAGE",
      garageId: null,
    },
    select: { id: true },
  });

  await Promise.allSettled(
    searchingBookings.map((booking) =>
      garageRequestService.ensureBookingSearchActive(booking.id),
    ),
  );

  let statusFilter = {};

  if (statuses.length > 0) {
    statusFilter =
      statuses.length > 1
        ? { status: { in: statuses } }
        : { status: statuses[0] };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      ...statusFilter,
    },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });

  return bookings;
};

const getBookingById = async (userId, bookingId) => {
  const ownedBooking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    select: {
      id: true,
      status: true,
      garageId: true,
    },
  });

  if (!ownedBooking) {
    throw new ApiError(404, "Booking not found");
  }

  if (
    ownedBooking.status === "SEARCHING_GARAGE" &&
    !ownedBooking.garageId
  ) {
    await garageRequestService.ensureBookingSearchActive(bookingId);
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: bookingInclude,
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  return booking;
};

const getBookingSuccess = async (userId, bookingId) => {
  const booking = await getBookingById(userId, bookingId);

  if (
    ![
      "GARAGE_ASSIGNED",
      "CONFIRMED",
      "IN_PROGRESS",
      "COMPLETED",
    ].includes(booking.status)
  ) {
    throw new ApiError(
      400,
      "Garage has not accepted this booking yet",
    );
  }

  if (!booking.garage) {
    throw new ApiError(400, "Garage not assigned yet");
  }

  return {
    booking: {
      ...booking,
      garage: addGarageWhatsappLink(booking.garage),
    },
    whatsappLink: createWhatsappLink(
      booking.garage.whatsappNo || booking.garage.phone,
    ),
    directionsLink: `https://www.google.com/maps?q=${booking.garage.latitude},${booking.garage.longitude}`,
  };
};

const acceptDelivery = async (userId, bookingId) => {
  const booking =
    await bookingLifecycleService.acceptDeliveredBookingByCustomer({
      userId,
      bookingId,
    });

  await invalidateBookingCaches(userId);
  return booking;
};

const regenerateHandoverOtp = async (userId, bookingId) => {
  const result =
    await bookingLifecycleService.regenerateBookingHandoverOtp({
      userId,
      bookingId,
    });

  await invalidateBookingCaches(userId);
  return result;
};

const getServiceHistory = async (userId) => {
  return prisma.booking.findMany({
    where: {
      userId,
      status: "COMPLETED",
      customerAcceptedAt: { not: null },
    },
    include: bookingInclude,
    orderBy: { customerAcceptedAt: "desc" },
  });
};

const cancelBooking = async (userId, bookingId) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: { payment: true },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (
    ![
      "PENDING_PAYMENT",
      "SEARCHING_GARAGE",
      "GARAGE_ASSIGNED",
      "CONFIRMED",
    ].includes(booking.status)
  ) {
    throw new ApiError(400, "This booking cannot be cancelled");
  }

  const result = await prisma.$transaction(async (tx) => {
    const freshBooking = await tx.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      include: { payment: true },
    });

    if (!freshBooking) {
      throw new ApiError(404, "Booking not found");
    }

    if (
      ![
        "PENDING_PAYMENT",
        "SEARCHING_GARAGE",
        "GARAGE_ASSIGNED",
        "CONFIRMED",
      ].includes(freshBooking.status)
    ) {
      throw new ApiError(400, "This booking cannot be cancelled");
    }

    const refundAmount = getPaidBookingRefundAmount(freshBooking);
    const refund = await refundPaidBookingToWallet({
      tx,
      booking: freshBooking,
      refundAmount,
    });

    await tx.garageBroadcastRequest.updateMany({
      where: {
        bookingId,
        status: "SENT",
      },
      data: {
        status: "EXPIRED",
        expiredAt: new Date(),
      },
    });

    const cancelledBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        searchExpiresAt: null,
        expiredAt: null,
        trackingEndedAt: new Date(),
      },
      include: bookingInclude,
    });

    return {
      booking: cancelledBooking,
      refund,
    };
  });

  await invalidateBookingCaches(userId);

  return {
    ...result.booking,
    refund: result.refund
      ? {
          amount: result.refund.amount,
          walletBalance: result.refund.wallet.balance,
          transactionId: result.refund.transaction.id,
        }
      : null,
  };
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  getBookingSuccess,
  acceptDelivery,
  regenerateHandoverOtp,
  getServiceHistory,
  cancelBooking,
};
