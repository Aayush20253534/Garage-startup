const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const generateBookingCode = require("../../utils/bookingCode");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { getCache, setCache, deletePattern } = require("../../utils/cache");
const { addGarageWhatsappLink, createWhatsappLink } = require("../../utils/whatsapp");
const bookingLifecycleService = require("../../services/bookingLifecycle.service");
const cityServicePriceRangeService = require("../../admin/services/cityServicePriceRange.service");

const BOOKINGS_CACHE_TTL = 60;

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
      createdAt: "desc",
    },
  },
  review: true,
  complaints: true,
  inspectionImages: { orderBy: [{ phase: "asc" }, { order: "asc" }] },
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

const getBookingCity = (location = {}) => {
  if (location.city) return location.city;
  const addressParts = String(location.address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return addressParts.length >= 2 ? addressParts[addressParts.length - 2] : null;
};

const getBookingServiceRange = (service, priceRangeMap = new Map()) => {
  const adminRange = priceRangeMap.get(service.id);
  if (adminRange) {
    return {
      min: Number(adminRange.minPrice) || 0,
      max: Number(adminRange.maxPrice) || Number(adminRange.minPrice) || 0,
    };
  }

  return null;
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
    { min: 0, max: 0 }
  );
};

const calculateHandlingFee = (totalServiceAmount) => {
  if (totalServiceAmount >= 300 && totalServiceAmount < 1000) return 30;
  if (totalServiceAmount >= 1000 && totalServiceAmount < 5000) return 99;
  if (totalServiceAmount >= 5000 && totalServiceAmount < 20000) return 249;
  if (totalServiceAmount >= 20000) return 500;

  return 99;
};

const getServiceEstimatedPrice = (service) => {
  return service.basePrice || service.minPrice || 0;
};

const normalizeStatuses = (status) => {
  if (!status) return [];

  const statuses = String(status)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const invalidStatus = statuses.find(
    (item) => !ALLOWED_BOOKING_STATUSES.includes(item)
  );

  if (invalidStatus) {
    throw new ApiError(400, `Invalid booking status: ${invalidStatus}`);
  }

  return [...new Set(statuses)].sort();
};

const getBookingsCacheKey = (userId, query = {}) => {
  const statuses = normalizeStatuses(query.status);

  if (statuses.length === 0) {
    return `customer:${userId}:bookings:all`;
  }

  return `customer:${userId}:bookings:${statuses.join(",")}`;
};

const invalidateBookingCaches = async (userId) => {
  await Promise.all([
    deletePattern(`customer:${userId}:bookings:*`),
    invalidateCustomerCache(userId),
  ]);
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
    useWalletCoins = 0,
  } = data;

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new ApiError(400, "At least one service is required");
  }

  if (!location?.latitude || !location?.longitude) {
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
      id: {
        in: uniqueServiceIds,
      },
      isActive: true,
    },
  });

  if (services.length !== uniqueServiceIds.length) {
    throw new ApiError(404, "One or more services are invalid");
  }

  const priceRangeMap = await cityServicePriceRangeService.findBestPriceRangesForBooking({
    city: getBookingCity(location),
    services,
    vehicle,
  });
  const serviceRangeTotal = sumServiceRanges(services, priceRangeMap);
  const totalServiceAmount = serviceRangeTotal.min;
  const totalServiceMaxAmount = serviceRangeTotal.max;

  const handlingFee = calculateHandlingFee(totalServiceMaxAmount || totalServiceAmount);

  let walletAmountUsed = 0;

  if (Number(useWalletCoins) > 0) {
    const wallet = await prisma.wallet.findUnique({
      where: {
        userId,
      },
    });

    if (!wallet) {
      throw new ApiError(404, "Wallet not found");
    }

    if (wallet.balance < Number(useWalletCoins)) {
      throw new ApiError(400, "Insufficient wallet balance");
    }

    walletAmountUsed = Math.min(Number(useWalletCoins), handlingFee);
  }

  const payableAmount = handlingFee - walletAmountUsed;
  const bookingCode = await generateBookingCode();

  const booking = await prisma.$transaction(async (tx) => {
    if (walletAmountUsed > 0) {
      const wallet = await tx.wallet.findUnique({
        where: {
          userId,
        },
      });

      if (!wallet || wallet.balance < walletAmountUsed) {
        throw new ApiError(400, "Insufficient wallet balance");
      }

      const balanceAfter = wallet.balance - walletAmountUsed;

      await tx.wallet.update({
        where: {
          id: wallet.id,
        },
        data: {
          balance: balanceAfter,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: "BOOKING_PAYMENT",
          status: "SUCCESS",
          amount: walletAmountUsed,
          balanceAfter,
          description: "Wallet coins used for booking handling fee",
        },
      });
    }

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
        status: payableAmount > 0 ? "PENDING_PAYMENT" : "SEARCHING_GARAGE",
        searchExpiresAt: payableAmount > 0 ? null : bookingLifecycleService.getSearchExpiresAt(),

        customerLatitude: Number(location.latitude),
        customerLongitude: Number(location.longitude),
        customerAddress: location.address || location.city || null,

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

        payment: {
          create: {
            amount: payableAmount,
            currency: "INR",
            status: payableAmount > 0 ? "CREATED" : "PAID",
            walletAmountUsed,
            upiAmountPaid: payableAmount,
          },
        },
      },
      include: bookingInclude,
    });
  });

  await invalidateBookingCaches(userId);

  return booking;
};

const getMyBookings = async (userId, query = {}) => {
  const statuses = normalizeStatuses(query.status);
  const cacheKey = getBookingsCacheKey(userId, query);

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  let statusFilter = {};

  if (statuses.length > 0) {
    statusFilter =
      statuses.length > 1
        ? {
            status: {
              in: statuses,
            },
          }
        : {
            status: statuses[0],
          };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      ...statusFilter,
    },
    include: bookingInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  await setCache(cacheKey, bookings, BOOKINGS_CACHE_TTL);

  return bookings;
};

const getBookingById = async (userId, bookingId) => {
  const cacheKey = `customer:${userId}:booking:${bookingId}`;

  const cached = await getCache(cacheKey);
  if (cached) return cached;

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

  await setCache(cacheKey, booking, BOOKINGS_CACHE_TTL);

  return booking;
};

const getBookingSuccess = async (userId, bookingId) => {
  const booking = await getBookingById(userId, bookingId);

  if (
    !["GARAGE_ASSIGNED", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(
      booking.status
    )
  ) {
    throw new ApiError(400, "Garage has not accepted this booking yet");
  }

  if (!booking.garage) {
    throw new ApiError(400, "Garage not assigned yet");
  }

  return {
    booking: {
      ...booking,
      garage: addGarageWhatsappLink(booking.garage),
    },
    whatsappLink: createWhatsappLink(booking.garage.whatsappNo || booking.garage.phone),
    directionsLink: `https://www.google.com/maps?q=${booking.garage.latitude},${booking.garage.longitude}`,
  };
};


const acceptDelivery = async (userId, bookingId) => {
  const booking = await bookingLifecycleService.acceptDeliveredBookingByCustomer({ userId, bookingId });
  await invalidateBookingCaches(userId);
  return booking;
};

const getServiceHistory = async (userId) => {
  await bookingLifecycleService.expireStaleGarageSearchesForUser(userId);
  return prisma.booking.findMany({
    where: {
      userId,
      status: "COMPLETED",
      customerAcceptedAt: { not: null },
    },
    include: bookingInclude,
    orderBy: {
      customerAcceptedAt: "desc",
    },
  });
};
const cancelBooking = async (userId, bookingId) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: {
      payment: true,
    },
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

  const cancelledBooking = await prisma.$transaction(async (tx) => {
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

    return tx.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        status: "CANCELLED",
      },
      include: bookingInclude,
    });
  });

  await invalidateBookingCaches(userId);

  return cancelledBooking;
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  getBookingSuccess,
  acceptDelivery,
  getServiceHistory,
  cancelBooking,
};
