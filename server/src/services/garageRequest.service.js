const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const garageService = require("./garage.service");

const BOOKING_STATUS = require("../constants/bookingStatus");
const BROADCAST_STATUS = require("../constants/broadcastStatus");
const REQUEST_TYPE = require("../constants/requestType");
const WALLET_TRANSACTION_TYPE = require("../constants/walletTransactionType");
const WALLET_TRANSACTION_STATUS = require("../constants/walletTransactionStatus");
const { calculatePlatformFee } = require("../garage/constants");
const { addGarageWhatsappLink } = require("../utils/whatsapp");
const calculateDistanceKm = require("../utils/distance");
const invalidateCustomerCache = require("../utils/invalidateCustomerCache");
const { deletePattern } = require("../utils/cache");
const notificationService = require("../customer/services/notification.service");
const {
  getGarageAcceptUrl,
  getMapsLink,
  sendCustomerGarageDetailsWhatsapp,
  sendCustomerHandoverOtpWhatsapp,
  sendGarageBookingRequestWhatsapp,
  sendGarageCustomerLocationWhatsapp,
} = require("./garageWhatsapp.service");
const bookingLifecycleService = require("./bookingLifecycle.service");

const SOS_CHARGE = 50;
const DEFAULT_GARAGE_SEARCH_BATCH_SIZE = 5;

const getGarageSearchBatchSize = () => {
  const configured = Number(
    process.env.GARAGE_SEARCH_BATCH_SIZE ||
      DEFAULT_GARAGE_SEARCH_BATCH_SIZE,
  );

  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_GARAGE_SEARCH_BATCH_SIZE;
};

const estimateArrivalMinutes = (distanceKm) => {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return null;

  const averageCitySpeedKmph = Number(
    process.env.GARAGE_ETA_SPEED_KMPH || 25,
  );
  const pickupBufferMinutes = Number(
    process.env.GARAGE_ETA_BUFFER_MINUTES || 10,
  );

  const speed =
    Number.isFinite(averageCitySpeedKmph) && averageCitySpeedKmph > 0
      ? averageCitySpeedKmph
      : 25;
  const buffer =
    Number.isFinite(pickupBufferMinutes) && pickupBufferMinutes >= 0
      ? pickupBufferMinutes
      : 10;

  return Math.max(5, Math.ceil((distance / speed) * 60 + buffer));
};

const invalidateBookingReadCaches = async (userId) => {
  if (!userId) return;

  await Promise.allSettled([
    invalidateCustomerCache(userId),
    deletePattern(`customer:${userId}:bookings:*`),
    deletePattern(`customer:${userId}:booking:*`),
  ]);
};

const getRequestDistanceKm = (request) => {
  const booking = request.booking;
  const garage = request.garage;

  if (
    booking?.customerLatitude === null ||
    booking?.customerLatitude === undefined ||
    booking?.customerLongitude === null ||
    booking?.customerLongitude === undefined ||
    garage?.latitude === null ||
    garage?.latitude === undefined ||
    garage?.longitude === null ||
    garage?.longitude === undefined
  ) {
    return null;
  }

  return calculateDistanceKm(
    booking.customerLatitude,
    booking.customerLongitude,
    garage.latitude,
    garage.longitude,
  );
};


const getGarageAcceptFee = (booking = {}) => {
  const storedHandlingFee = Number(booking.handlingFee);

  if (Number.isFinite(storedHandlingFee) && storedHandlingFee > 0) {
    return storedHandlingFee;
  }

  const serviceUpperLimit = Math.max(
    Number(booking.totalServiceAmount) || 0,
    Number(booking.totalServiceMaxAmount) || 0,
  );

  return calculatePlatformFee(serviceUpperLimit, booking.requestType);
};

const redactPendingCustomerDetails = (request) => {
  if (
    request.status !== BROADCAST_STATUS.SENT ||
    !request.booking
  ) {
    return request;
  }

  return {
    ...request,
    booking: {
      ...request.booking,
      customerAddress: null,
      customerLatitude: null,
      customerLongitude: null,
      user: request.booking.user
        ? {
            id: request.booking.user.id,
            name: "Customer",
            email: null,
            phone: null,
          }
        : null,
    },
  };
};

const serializeGarageRequest = (request) => {
  const safeRequest = redactPendingCustomerDetails(request);
  const distanceKm = getRequestDistanceKm(request);
  const acceptFee = getGarageAcceptFee(request.booking);

  return {
    ...safeRequest,
    distanceKm,
    etaMinutes: estimateArrivalMinutes(distanceKm),
    acceptFee,
    acceptUrl: getGarageAcceptUrl(request.id),
    garage: addGarageWhatsappLink(safeRequest.garage),
  };
};

const serializeGarageRequests = (requests) =>
  requests.map(serializeGarageRequest);

const GARAGE_REQUEST_STATUS_FILTERS = {
  NEW: { status: BROADCAST_STATUS.SENT },
  SENT: { status: BROADCAST_STATUS.SENT },
  ACCEPTED: { status: BROADCAST_STATUS.ACCEPTED },
  REJECTED: { status: BROADCAST_STATUS.REJECTED },
  EXPIRED: { status: BROADCAST_STATUS.EXPIRED },
  CONFIRMED: {
    status: BROADCAST_STATUS.ACCEPTED,
    booking: { status: BOOKING_STATUS.CONFIRMED },
  },
  IN_PROGRESS: {
    status: BROADCAST_STATUS.ACCEPTED,
    booking: {
      status: BOOKING_STATUS.IN_PROGRESS,
      deliveredAt: null,
    },
  },
  DELIVERED: {
    status: BROADCAST_STATUS.ACCEPTED,
    booking: {
      status: BOOKING_STATUS.IN_PROGRESS,
      deliveredAt: { not: null },
      customerAcceptedAt: null,
    },
  },
  COMPLETED: {
    status: BROADCAST_STATUS.ACCEPTED,
    booking: { status: BOOKING_STATUS.COMPLETED },
  },
};

const getGarageRequestWhere = (garageId, query = {}) => {
  const status = String(query.status || "").trim().toUpperCase();
  const statusFilter = status
    ? GARAGE_REQUEST_STATUS_FILTERS[status]
    : {};

  if (status && !statusFilter) {
    throw new ApiError(400, "Invalid garage request status filter");
  }

  return {
    garageId,
    ...statusFilter,
  };
};

const bookingForWhatsappInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  vehicle: true,
  services: {
    include: {
      service: {
        include: {
          category: true,
        },
      },
    },
  },
};

const requestInclude = {
  booking: {
    include: {
      ...bookingForWhatsappInclude,
      payment: true,
      review: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      inspectionImages: {
        orderBy: [{ phase: "asc" }, { order: "asc" }],
      },
    },
  },
  garage: true,
};

const getCurrentRoundRequests = async (bookingId) => {
  return prisma.garageBroadcastRequest.findMany({
    where: {
      bookingId,
      status: BROADCAST_STATUS.SENT,
    },
    include: requestInclude,
    orderBy: { sentAt: "desc" },
  });
};

const getGarageRequestById = async (garageId, requestId) => {
  const request = await prisma.garageBroadcastRequest.findFirst({
    where: {
      garageId,
      OR: [{ id: requestId }, { bookingId: requestId }],
    },
    include: requestInclude,
  });

  if (!request) {
    throw new ApiError(404, "Garage booking request not found");
  }

  return serializeGarageRequest(request);
};

const sendGarageRequestAlerts = async ({ requests, booking }) => {
  const alertJobs = [];
  const acceptFee = getGarageAcceptFee(booking);
  const feeMessage = acceptFee > 0
    ? ` Acceptance requires Rs. ${acceptFee} in garage wallet.`
    : "";

  for (const request of requests) {
    alertJobs.push({
      channel: "whatsapp",
      garageId: request.garage.id,
      requestId: request.id,
      bookingId: booking.id,
      promise: sendGarageBookingRequestWhatsapp({
        garage: request.garage,
        request,
        booking,
        acceptFee,
      }),
    });

    if (request.garage?.ownerId) {
      alertJobs.push({
        channel: "in_app_notification",
        garageId: request.garage.id,
        requestId: request.id,
        bookingId: booking.id,
        promise: notificationService.createNotification({
          userId: request.garage.ownerId,
          type: "BOOKING",
          title: "New nearby booking request",
          message: `${booking.vehicle?.brand || "Vehicle"} ${
            booking.vehicle?.model || ""
          } needs ${booking.services
            .map((item) => item.service?.name)
            .filter(Boolean)
            .join(", ") || "garage service"}. Open the request before this two-minute round expires.${feeMessage}`,
          link: `/garage/magic/${request.id}`,
          metadata: {
            bookingId: booking.id,
            requestId: request.id,
            garageId: request.garage.id,
            action: "ACCEPT_GARAGE_REQUEST",
            acceptFee,
          },
        }),
      });
    }
  }

  const results = await Promise.allSettled(
    alertJobs.map((job) => job.promise),
  );

  if (process.env.NODE_ENV !== "test") {
    const whatsappResults = results
      .map((result, index) => ({ result, job: alertJobs[index] }))
      .filter(({ job }) => job.channel === "whatsapp");

    const summary = whatsappResults.reduce(
      (acc, { result }) => {
        if (result.status === "fulfilled" && result.value?.sent) {
          acc.sent += 1;
        } else if (result.status === "fulfilled" && result.value?.logged) {
          acc.loggedOnly += 1;
        } else {
          acc.failed += 1;
        }
        return acc;
      },
      { sent: 0, loggedOnly: 0, failed: 0 },
    );

    console.info("[garage-request:alerts] broadcast summary", {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      requestCount: requests.length,
      whatsapp: summary,
      totalJobs: alertJobs.length,
    });

    whatsappResults.forEach(({ result, job }) => {
      const value = result.status === "fulfilled" ? result.value : null;
      const failedReason =
        result.status === "rejected"
          ? result.reason?.message || String(result.reason)
          : value?.errorMessage || value?.reason || null;

      console.info("[garage-request:alerts] whatsapp result", {
        bookingId: job.bookingId,
        requestId: job.requestId,
        garageId: job.garageId,
        settled: result.status,
        sent: Boolean(value?.sent),
        loggedOnly: Boolean(value?.logged),
        failed: result.status === "rejected" || Boolean(value?.failed),
        status: value?.status || null,
        reason: failedReason,
      });
    });
  }
};

const chooseGaragesForNextRound = ({
  eligibleGarages,
  previousRequests,
  batchSize,
}) => {
  const previousByGarageId = new Map(
    previousRequests.map((request) => [request.garageId, request]),
  );

  const unattempted = eligibleGarages.filter(
    (garage) => !previousByGarageId.has(garage.id),
  );

  const reusable = eligibleGarages
    .filter((garage) => previousByGarageId.has(garage.id))
    .sort((a, b) => {
      const requestA = previousByGarageId.get(a.id);
      const requestB = previousByGarageId.get(b.id);
      const sentAtA = requestA?.sentAt
        ? new Date(requestA.sentAt).getTime()
        : 0;
      const sentAtB = requestB?.sentAt
        ? new Date(requestB.sentAt).getTime()
        : 0;

      if (sentAtA !== sentAtB) return sentAtA - sentAtB;
      return Number(a.distanceKm || 0) - Number(b.distanceKm || 0);
    });

  const selected = unattempted.slice(0, batchSize);

  if (selected.length < batchSize) {
    selected.push(...reusable.slice(0, batchSize - selected.length));
  }

  return selected;
};

/**
 * Claims and starts exactly one two-minute search round.
 *
 * The compare-and-set update on searchExpiresAt prevents two simultaneous
 * tracking polls from creating the same round twice.
 */
const startNextGarageSearchCycle = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingForWhatsappInclude,
  });

  if (!booking) throw new ApiError(404, "Booking not found");

  if (
    booking.status !== BOOKING_STATUS.SEARCHING_GARAGE ||
    booking.garageId
  ) {
    return [];
  }

  if (
    booking.customerLatitude === null ||
    booking.customerLatitude === undefined ||
    booking.customerLongitude === null ||
    booking.customerLongitude === undefined
  ) {
    throw new ApiError(400, "Booking location is missing");
  }

  const now = new Date();
  const activeRequests = await getCurrentRoundRequests(bookingId);

  if (booking.searchExpiresAt && booking.searchExpiresAt > now) {
    return serializeGarageRequests(activeRequests);
  }

  const nextExpiry = bookingLifecycleService.getSearchExpiresAt();

  const claimed = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BOOKING_STATUS.SEARCHING_GARAGE,
      garageId: null,
      searchExpiresAt: booking.searchExpiresAt || null,
    },
    data: {
      searchExpiresAt: nextExpiry,
      expiredAt: null,
    },
  });

  if (claimed.count === 0) {
    return serializeGarageRequests(
      await getCurrentRoundRequests(bookingId),
    );
  }

  await prisma.garageBroadcastRequest.updateMany({
    where: {
      bookingId,
      status: BROADCAST_STATUS.SENT,
    },
    data: {
      status: BROADCAST_STATUS.EXPIRED,
      expiredAt: now,
    },
  });

  const garageAcceptFee = getGarageAcceptFee(booking);

  const serviceIds = booking.services.map((item) => item.serviceId);
  const eligibleGarages = await garageService.findNearbyEligibleGarages({
    latitude: booking.customerLatitude,
    longitude: booking.customerLongitude,
    serviceIds,
    vehicle: booking.vehicle,
    maxDistance: null,
    onlyVerified: true,
    requireOpenNow: false,
    // Do not filter nearby garages by wallet balance. Garages should still
    // receive nearby booking alerts, but acceptance remains blocked below
    // unless their wallet has enough balance for the acceptance fee.
    requireWalletBalance: false,
    minGarageWalletBalance: 0,
  });

  if (eligibleGarages.length === 0) {
    // Keep SEARCHING_GARAGE. When this round expires, the next poll checks again.
    return [];
  }

  const previousRequests = await prisma.garageBroadcastRequest.findMany({
    where: { bookingId },
    select: {
      id: true,
      garageId: true,
      status: true,
      sentAt: true,
      rejectedAt: true,
      expiredAt: true,
    },
  });

  const selectedGarages = chooseGaragesForNextRound({
    eligibleGarages,
    previousRequests,
    batchSize: getGarageSearchBatchSize(),
  });

  const sentAt = new Date();

  await prisma.$transaction(
    selectedGarages.map((garage) =>
      prisma.garageBroadcastRequest.upsert({
        where: {
          bookingId_garageId: {
            bookingId,
            garageId: garage.id,
          },
        },
        update: {
          status: BROADCAST_STATUS.SENT,
          sentAt,
          acceptedAt: null,
          rejectedAt: null,
          expiredAt: null,
          garageResponseNote: null,
        },
        create: {
          bookingId,
          garageId: garage.id,
          status: BROADCAST_STATUS.SENT,
          sentAt,
        },
      }),
    ),
  );

  const requests = await prisma.garageBroadcastRequest.findMany({
    where: {
      bookingId,
      garageId: { in: selectedGarages.map((garage) => garage.id) },
      status: BROADCAST_STATUS.SENT,
    },
    include: requestInclude,
    orderBy: { sentAt: "desc" },
  });

  await sendGarageRequestAlerts({ requests, booking });
  await invalidateBookingReadCaches(booking.userId);

  return serializeGarageRequests(requests);
};

const ensureBookingSearchActive = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      garageId: true,
      searchExpiresAt: true,
    },
  });

  if (
    !booking ||
    booking.status !== BOOKING_STATUS.SEARCHING_GARAGE ||
    booking.garageId
  ) {
    return [];
  }

  if (
    booking.searchExpiresAt &&
    booking.searchExpiresAt <= new Date()
  ) {
    await bookingLifecycleService.expireBookingSearch(bookingId);
  }

  return startNextGarageSearchCycle(bookingId);
};

// Backward-compatible name used by payment and older code.
const broadcastBookingToNearbyGarages = async (bookingId) =>
  startNextGarageSearchCycle(bookingId);

const getGarageRequests = async (garageId, query = {}) => {
  const requests = await prisma.garageBroadcastRequest.findMany({
    where: getGarageRequestWhere(garageId, query),
    include: requestInclude,
    orderBy: { updatedAt: "desc" },
  });

  return serializeGarageRequests(requests);
};

const acceptGarageRequest = async (garageId, requestId, note) => {
  const requestIdentity = await prisma.garageBroadcastRequest.findUnique({
    where: { id: requestId },
    select: { bookingId: true },
  });

  if (!requestIdentity) {
    throw new ApiError(404, "Garage request not found");
  }

  await bookingLifecycleService.expireBookingSearch(
    requestIdentity.bookingId,
  );

  const request = await prisma.garageBroadcastRequest.findFirst({
    where: { id: requestId, garageId },
    include: {
      booking: true,
      garage: { include: { wallet: true } },
    },
  });

  if (!request) throw new ApiError(404, "Garage request not found");

  if (request.status !== BROADCAST_STATUS.SENT) {
    throw new ApiError(400, "This request is no longer available");
  }

  if (
    request.booking.searchExpiresAt &&
    request.booking.searchExpiresAt < new Date()
  ) {
    throw new ApiError(400, "This two-minute request round has expired");
  }

  if (
    ![
      BOOKING_STATUS.SEARCHING_GARAGE,
      BOOKING_STATUS.GARAGE_ASSIGNED,
    ].includes(request.booking.status)
  ) {
    throw new ApiError(400, "Booking is no longer accepting garages");
  }

  const result = await prisma.$transaction(async (tx) => {
    const freshRequest = await tx.garageBroadcastRequest.findFirst({
      where: { id: requestId, garageId },
      include: {
        booking: true,
        garage: { include: { wallet: true } },
      },
    });

    if (!freshRequest) {
      throw new ApiError(404, "Garage request not found");
    }

    if (freshRequest.status !== BROADCAST_STATUS.SENT) {
      throw new ApiError(400, "This request is no longer available");
    }

    const freshBooking = freshRequest.booking;

    if (!freshBooking) throw new ApiError(404, "Booking not found");

    if (
      ![
        BOOKING_STATUS.SEARCHING_GARAGE,
        BOOKING_STATUS.GARAGE_ASSIGNED,
      ].includes(freshBooking.status)
    ) {
      throw new ApiError(400, "Booking is no longer available");
    }

    if (
      freshBooking.searchExpiresAt &&
      freshBooking.searchExpiresAt < new Date()
    ) {
      throw new ApiError(400, "This two-minute request round has expired");
    }

    const garageAcceptFee = getGarageAcceptFee(freshBooking);

    const garageWallet = await tx.garageWallet.findUnique({
      where: { garageId },
    });

    if (!garageWallet) {
      throw new ApiError(
        400,
        `Insufficient garage wallet balance. Recharge at least Rs. ${garageAcceptFee} to accept this booking.`,
      );
    }

    const handoverOtp = bookingLifecycleService.createHandoverOtp();
    const acceptedAt = new Date();

    const requestClaim = await tx.garageBroadcastRequest.updateMany({
      where: {
        id: requestId,
        garageId,
        status: BROADCAST_STATUS.SENT,
      },
      data: {
        status: BROADCAST_STATUS.ACCEPTED,
        acceptedAt,
        garageResponseNote: note || null,
      },
    });

    if (requestClaim.count === 0) {
      throw new ApiError(400, "This request is no longer available");
    }

    const bookingClaim = await tx.booking.updateMany({
      where: {
        id: freshRequest.bookingId,
        garageId: null,
        status: {
          in: [
            BOOKING_STATUS.SEARCHING_GARAGE,
            BOOKING_STATUS.GARAGE_ASSIGNED,
          ],
        },
      },
      data: {
        garageId,
        status: BOOKING_STATUS.CONFIRMED,
        garageNote: note || null,
        acceptedAt,
        searchExpiresAt: null,
        expiredAt: null,
        handoverOtpHash: handoverOtp.otpHash,
        handoverOtpExpiresAt: handoverOtp.expiresAt,
      },
    });

    if (bookingClaim.count === 0) {
      throw new ApiError(
        400,
        "Another garage already accepted this booking",
      );
    }

    await tx.garageBroadcastRequest.updateMany({
      where: {
        bookingId: freshRequest.bookingId,
        id: { not: requestId },
        status: BROADCAST_STATUS.SENT,
      },
      data: {
        status: BROADCAST_STATUS.EXPIRED,
        expiredAt: acceptedAt,
      },
    });

    if (freshBooking.requestType === REQUEST_TYPE.SOS) {
      const wallet = await tx.wallet.findUnique({
        where: { userId: freshBooking.userId },
      });

      if (!wallet || wallet.balance < SOS_CHARGE) {
        throw new ApiError(
          400,
          "Customer has insufficient wallet balance for SOS",
        );
      }

      const balanceAfter = wallet.balance - SOS_CHARGE;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: freshBooking.userId,
          type: WALLET_TRANSACTION_TYPE.SOS_DEDUCTION,
          status: WALLET_TRANSACTION_STATUS.SUCCESS,
          amount: SOS_CHARGE,
          balanceAfter,
          description:
            "SOS service charge deducted after garage acceptance",
        },
      });
    }

    const garageDebit = await tx.garageWallet.updateMany({
      where: {
        id: garageWallet.id,
        balance: { gte: garageAcceptFee },
      },
      data: {
        balance: { decrement: garageAcceptFee },
      },
    });

    if (garageDebit.count === 0) {
      throw new ApiError(
        400,
        `Insufficient garage wallet balance. Recharge at least Rs. ${garageAcceptFee} to accept this booking.`,
      );
    }

    const updatedGarageWallet = await tx.garageWallet.findUnique({
      where: { id: garageWallet.id },
    });

    const garageBalanceAfter = updatedGarageWallet?.balance ?? 0;

    await tx.garageWalletTransaction.create({
      data: {
        garageWalletId: garageWallet.id,
        garageId,
        type: WALLET_TRANSACTION_TYPE.GARAGE_ACCEPT_FEE,
        status: WALLET_TRANSACTION_STATUS.SUCCESS,
        amount: garageAcceptFee,
        balanceAfter: garageBalanceAfter,
        description: "Garage request acceptance platform fee",
      },
    });

    const acceptedRequest = await tx.garageBroadcastRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });

    return { request: acceptedRequest, handoverOtp };
  });

  const distanceKm = getRequestDistanceKm(result.request);
  const etaMinutes = estimateArrivalMinutes(distanceKm);

  const sendCustomerAcceptanceWhatsapp = async () => {
    await sendCustomerGarageDetailsWhatsapp({
      customer: result.request.booking.user,
      garage: result.request.garage,
      booking: result.request.booking,
    });

    return sendCustomerHandoverOtpWhatsapp({
      customer: result.request.booking.user,
      garage: result.request.garage,
      booking: result.request.booking,
      otp: result.handoverOtp.otp,
      otpExpiresAt: result.handoverOtp.expiresAt,
    });
  };

  await Promise.allSettled([
    bookingLifecycleService.notifyGarageAccepted({
      booking: result.request.booking,
      garage: result.request.garage,
      distanceKm,
      etaMinutes,
    }),
    bookingLifecycleService.notifyVehicleHandoverOtp({
      booking: result.request.booking,
      garage: result.request.garage,
      otp: result.handoverOtp.otp,
      expiresAt: result.handoverOtp.expiresAt,
    }),
    bookingLifecycleService.sendCustomerHandoverOtpEmail({
      customer: result.request.booking.user,
      garage: result.request.garage,
      booking: result.request.booking,
      otp: result.handoverOtp.otp,
      otpExpiresAt: result.handoverOtp.expiresAt,
    }),
    sendCustomerAcceptanceWhatsapp(),
    sendGarageCustomerLocationWhatsapp({
      garage: result.request.garage,
      booking: result.request.booking,
    }),
  ]);

  await invalidateBookingReadCaches(result.request.booking.userId);

  return {
    ...serializeGarageRequest(result.request),
    customerLocationLink: getMapsLink(
      result.request.booking.customerLatitude,
      result.request.booking.customerLongitude,
    ),
  };
};

const rejectGarageRequest = async (garageId, requestId, note) => {
  const request = await prisma.garageBroadcastRequest.findFirst({
    where: { id: requestId, garageId },
  });

  if (!request) throw new ApiError(404, "Garage request not found");

  if (request.status !== BROADCAST_STATUS.SENT) {
    throw new ApiError(400, "This request cannot be rejected now");
  }

  const updatedRequest = await prisma.garageBroadcastRequest.update({
    where: { id: requestId },
    data: {
      status: BROADCAST_STATUS.REJECTED,
      rejectedAt: new Date(),
      garageResponseNote: note || null,
    },
    include: requestInclude,
  });

  return serializeGarageRequest(updatedRequest);
};

module.exports = {
  broadcastBookingToNearbyGarages,
  ensureBookingSearchActive,
  startNextGarageSearchCycle,
  getGarageRequestById,
  getGarageRequests,
  acceptGarageRequest,
  rejectGarageRequest,
};
