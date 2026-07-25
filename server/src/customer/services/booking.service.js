const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { buildOwnedResourceWhere } = require("../security/ownership");
const { withUniqueBookingCode } = require("../../utils/bookingCode");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { getCache, setCache, deletePattern } = require("../../utils/cache");
const {
  addGarageWhatsappLink,
  createWhatsappLink,
} = require("../../utils/whatsapp");
const bookingLifecycleService = require("../../services/bookingLifecycle.service");
const garageRequestService = require("../../services/garageRequest.service");
const activityService = require("./activity.service");
const garageControllerService = require("../../garage/services/controller.service");
const cityServicePriceRangeService = require("../../admin/services/cityServicePriceRange.service");
const cityService = require("../../services/city.service");
const { calculatePlatformFee } = require("../../utils/platformFee");
const {
  ensureVehicleHasNoActiveBooking,
  isActiveVehicleBookingConflictError,
  lockAndEnsureVehicleHasNoActiveBooking,
} = require("./vehicleBookingGuard.service");
const {
  lockBookingFinance,
} = require("./bookingFinanceLock.service");
const {
  getBookingRefundIdempotencyKey,
} = require("./bookingFinancialIdempotency");
const {
  SERVICE_FULFILLMENT_TYPE,
  getServiceFulfillmentTypes,
  hasMixedServiceFulfillmentTypes,
} = require("../../constants/serviceFulfillmentType");

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
  garage: {
    include: {
      images: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
        select: {
          id: true,
          imageUrl: true,
          order: true,
          isThumbnail: true,
        },
      },
      services: {
        where: { isActive: true, isExcluded: false },
        select: {
          serviceId: true,
          vehicleBrand: true,
          vehicleModel: true,
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  },
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
    select: {
      id: true,
      status: true,
      sentAt: true,
      acceptedAt: true,
      rejectedAt: true,
      expiredAt: true,
      searchCycle: true,
      searchRound: true,
      searchRadiusKm: true,
      createdAt: true,
      updatedAt: true,
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

const BOOKING_READ_CACHE_TTL_SECONDS = Number(
  process.env.BOOKING_READ_CACHE_TTL_SECONDS || 60,
);

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

const getBookingListCacheKey = (userId, statuses = []) =>
  `customer:${userId}:bookings:list:${statuses.join(",") || "all"}`;

const getBookingDetailCacheKey = (userId, bookingId) =>
  `customer:${userId}:booking:${bookingId}`;

const getServiceHistoryCacheKey = (userId) =>
  `customer:${userId}:bookings:history`;

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

  await ensureVehicleHasNoActiveBooking(userId, vehicleId);

  const bookingCityRecord = await cityService.requireActiveCityFromLocation(location);
  const bookingCity = bookingCityRecord.name;

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
          cityRestrictions: {
            where: { cityId: bookingCityRecord.id },
            select: { id: true },
          },
        },
      },
      cityRestrictions: {
        where: { cityId: bookingCityRecord.id },
        select: { id: true },
      },
    },
  });

  if (services.length !== uniqueServiceIds.length) {
    throw new ApiError(404, "One or more services are invalid");
  }

  const restrictedServices = services.filter(
    (service) =>
      service.cityRestrictions.length > 0 ||
      service.category?.cityRestrictions?.length > 0,
  );

  if (restrictedServices.length > 0) {
    const serviceNames = restrictedServices
      .map((service) => service.name)
      .join(", ");

    throw new ApiError(
      409,
      `${serviceNames} ${
        restrictedServices.length === 1 ? "is" : "are"
      } not available in ${bookingCity}.`,
    );
  }

  const fulfillmentTypes = getServiceFulfillmentTypes(services);

  if (hasMixedServiceFulfillmentTypes(services)) {
    throw new ApiError(
      409,
      "Pickup-and-delivery services and self drop-off services cannot be booked together. Remove one service type and create a separate booking.",
    );
  }

  const fulfillmentType =
    fulfillmentTypes[0] || SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY;

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
            scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
            startTime: startTime || null,
            endTime: endTime || null,
            requestType: "NORMAL",
            fulfillmentType,
            status: "PENDING_PAYMENT",

            // Payment verification starts the first 2-minute-30-second search round.
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
                const range = getBookingServiceRange(service, priceRangeMap);

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
      }),
    );
  } catch (error) {
    if (isActiveVehicleBookingConflictError(error)) {
      await ensureVehicleHasNoActiveBooking(userId, vehicleId);
    }

    throw error;
  }

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

  const cacheKey = getBookingListCacheKey(userId, statuses);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      ...statusFilter,
    },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });

  await setCache(cacheKey, bookings, BOOKING_READ_CACHE_TTL_SECONDS);
  return bookings;
};

const getPendingPaymentBookings = async (userId) => {
  try {
    const paymentService = require("./payment.service");
    await paymentService.syncUserPendingCashfreePayments(userId);
  } catch (error) {
    // Listing pending bookings should stay available even if Cashfree sync is
    // temporarily unavailable. The next refresh or webhook will retry.
    console.error(
      `[pending-payment] unable to sync Cashfree payments for ${userId}:`,
      error.message,
    );
  }

  return prisma.booking.findMany({
    where: {
      userId,
      status: "PENDING_PAYMENT",
    },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });
};

const getBookingById = async (userId, bookingId) => {
  const ownedBooking = await prisma.booking.findFirst({
    where: buildOwnedResourceWhere({ id: bookingId, userId }),
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

  const cacheKey = getBookingDetailCacheKey(userId, bookingId);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const booking = await prisma.booking.findFirst({
    where: buildOwnedResourceWhere({ id: bookingId, userId }),
    include: bookingInclude,
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  await setCache(cacheKey, booking, BOOKING_READ_CACHE_TTL_SECONDS);
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

const acceptDelivery = async (userId, bookingId, finalAmount) => {
  const booking =
    await bookingLifecycleService.acceptDeliveredBookingByCustomer({
      userId,
      bookingId,
      finalAmount,
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
  const cacheKey = getServiceHistoryCacheKey(userId);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "COMPLETED",
      customerAcceptedAt: { not: null },
    },
    include: bookingInclude,
    orderBy: { customerAcceptedAt: "desc" },
  });

  await setCache(cacheKey, bookings, BOOKING_READ_CACHE_TTL_SECONDS);
  return bookings;
};

const getRefundAmountForCancelledBooking = (booking) => {
  if (booking.payment?.status !== "PAID") return 0;

  const walletPaidAmount = Number(
    booking.payment.walletAmountUsed || booking.walletAmountUsed || 0,
  );
  const upiAmountPaid = Number(booking.payment.upiAmountPaid || 0);
  const onlinePaidAmount =
    upiAmountPaid > 0
      ? upiAmountPaid
      : walletPaidAmount > 0
        ? 0
        : Number(booking.payment.amount || 0);
  const refundAmount = onlinePaidAmount + walletPaidAmount;

  return Number.isFinite(refundAmount) && refundAmount > 0
    ? Math.round(refundAmount)
    : 0;
};

const cancelBooking = async (userId, bookingId) => {
  const cancellationResult = await prisma.$transaction(async (tx) => {
    await lockBookingFinance(bookingId, { tx });

    const booking = await tx.booking.findFirst({
      where: buildOwnedResourceWhere({ id: bookingId, userId }),
      include: { payment: true },
    });

    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    if (booking.status === "CANCELLED") {
      return {
        booking: await tx.booking.findUnique({
          where: { id: bookingId },
          include: bookingInclude,
        }),
        cancelledNow: false,
        refundAmount: 0,
      };
    }

    const cancellableStatuses = [
      "PENDING_PAYMENT",
      "SEARCHING_GARAGE",
      "GARAGE_ASSIGNED",
      "CONFIRMED",
    ];

    if (!cancellableStatuses.includes(booking.status)) {
      throw new ApiError(400, "This booking cannot be cancelled");
    }

    const claim = await tx.booking.updateMany({
      where: {
        id: bookingId,
        userId,
        status: { in: cancellableStatuses },
      },
      data: {
        status: "CANCELLED",
        searchExpiresAt: null,
      },
    });

    if (claim.count !== 1) {
      throw new ApiError(
        409,
        "This booking was changed by another request. Refresh and try again.",
      );
    }

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

    await garageControllerService.releaseController(
      tx,
      booking.garageControllerId,
    );

    const refundAmount = getRefundAmountForCancelledBooking(booking);

    if (refundAmount > 0 && booking.payment) {
      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: booking.payment.id,
          bookingId,
          status: "PAID",
        },
        data: { status: "REFUNDED" },
      });

      if (paymentClaim.count !== 1) {
        throw new ApiError(
          409,
          "This payment was already refunded or changed by another request.",
        );
      }

      const paymentReference =
        booking.payment.cashfreeOrderId || booking.payment.id;
      const idempotencyKey = getBookingRefundIdempotencyKey(
        bookingId,
        paymentReference,
      );
      const existingRefund = await tx.walletTransaction.findUnique({
        where: { idempotencyKey },
      });

      if (!existingRefund) {
        const wallet = await tx.wallet.upsert({
          where: { userId },
          update: {
            balance: { increment: refundAmount },
          },
          create: {
            userId,
            type: "CUSTOMER",
            balance: refundAmount,
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            bookingId,
            idempotencyKey,
            type: "BOOKING_REFUND",
            status: "SUCCESS",
            amount: refundAmount,
            balanceAfter: wallet.balance,
            cashfreeOrderId:
              booking.payment.cashfreeOrderId || null,
            cashfreePaymentId:
              booking.payment.cashfreePaymentId || null,
            description: `Refund for cancelled booking ${
              booking.bookingCode || booking.id
            }`,
          },
        });
      }
    }

    return {
      booking: await tx.booking.findUnique({
        where: { id: bookingId },
        include: bookingInclude,
      }),
      cancelledNow: true,
      refundAmount,
    };
  });

  if (cancellationResult.cancelledNow && cancellationResult.booking) {
    const { booking, refundAmount } = cancellationResult;

    await activityService.createActivitySafely(
      userId,
      {
        type: "BOOKING_CANCELLED",
        title: "Booking cancelled",
        detail:
          refundAmount > 0
            ? `Booking ${booking.bookingCode || booking.id} was cancelled and ₹${refundAmount} was credited to your wallet.`
            : `Booking ${booking.bookingCode || booking.id} was cancelled.`,
        path: "/dashboard/bookings",
        metadata: {
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          refundAmount,
        },
      },
      { eventKey: `booking:${booking.id}:cancelled` },
    );
  }

  await invalidateBookingCaches(userId);
  return cancellationResult.booking;
};

module.exports = {
  createBooking,
  getMyBookings,
  getPendingPaymentBookings,
  getBookingById,
  getBookingSuccess,
  acceptDelivery,
  regenerateHandoverOtp,
  getServiceHistory,
  cancelBooking,
};
