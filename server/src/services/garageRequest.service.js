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
const {
  getGarageAcceptUrl,
  getMapsLink,
  sendCustomerGarageDetailsWhatsapp,
  sendGarageBookingRequestWhatsapp,
  sendGarageCustomerLocationWhatsapp,
} = require("./garageWhatsapp.service");
const bookingLifecycleService = require("./bookingLifecycle.service");

const SOS_CHARGE = 50;
const estimateArrivalMinutes = (distanceKm) => {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return null;

  const averageCitySpeedKmph = Number(process.env.GARAGE_ETA_SPEED_KMPH || 25);
  const pickupBufferMinutes = Number(process.env.GARAGE_ETA_BUFFER_MINUTES || 10);
  const speed = Number.isFinite(averageCitySpeedKmph) && averageCitySpeedKmph > 0 ? averageCitySpeedKmph : 25;
  const buffer = Number.isFinite(pickupBufferMinutes) && pickupBufferMinutes >= 0 ? pickupBufferMinutes : 10;

  return Math.max(5, Math.ceil((distance / speed) * 60 + buffer));
};

const getRequestDistanceKm = (request) => {
  const booking = request.booking;
  const garage = request.garage;

  if (
    !booking?.customerLatitude ||
    !booking?.customerLongitude ||
    !garage?.latitude ||
    !garage?.longitude
  ) {
    return null;
  }

  return calculateDistanceKm(
    booking.customerLatitude,
    booking.customerLongitude,
    garage.latitude,
    garage.longitude
  );
};

const redactPendingCustomerDetails = (request) => {
  if (request.status !== BROADCAST_STATUS.SENT || !request.booking) return request;

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

  return {
    ...safeRequest,
    distanceKm,
    etaMinutes: estimateArrivalMinutes(distanceKm),
    acceptUrl: getGarageAcceptUrl(request.id),
    garage: addGarageWhatsappLink(safeRequest.garage),
  };
};

const serializeGarageRequests = (requests) => requests.map(serializeGarageRequest);

const GARAGE_REQUEST_STATUS_FILTERS = {
  NEW: { status: BROADCAST_STATUS.SENT },
  SENT: { status: BROADCAST_STATUS.SENT },
  ACCEPTED: { status: BROADCAST_STATUS.ACCEPTED },
  REJECTED: { status: BROADCAST_STATUS.REJECTED },
  EXPIRED: { status: BROADCAST_STATUS.EXPIRED },
  CONFIRMED: { status: BROADCAST_STATUS.ACCEPTED, booking: { status: BOOKING_STATUS.CONFIRMED } },
  IN_PROGRESS: { status: BROADCAST_STATUS.ACCEPTED, booking: { status: BOOKING_STATUS.IN_PROGRESS } },
  COMPLETED: { status: BROADCAST_STATUS.ACCEPTED, booking: { status: BOOKING_STATUS.COMPLETED } },
};

const getGarageRequestWhere = (garageId, query = {}) => {
  const status = String(query.status || "").trim().toUpperCase();
  const statusFilter = status ? GARAGE_REQUEST_STATUS_FILTERS[status] : {};

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
      inspectionImages: { orderBy: [{ phase: "asc" }, { order: "asc" }] },
    },
  },
  garage: true,
};

const broadcastBookingToNearbyGarages = async (bookingId, options = {}) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingForWhatsappInclude,
  });

  if (!booking) throw new ApiError(404, "Booking not found");
  if (!booking.customerLatitude || !booking.customerLongitude) {
    throw new ApiError(400, "Booking location is missing");
  }

  const serviceIds = booking.services.map((item) => item.serviceId);
  const nearbyGarages = await garageService.findNearbyEligibleGarages({
    latitude: booking.customerLatitude,
    longitude: booking.customerLongitude,
    serviceIds,
    vehicle: booking.vehicle,
    maxDistance: options.maxDistance || null,
    onlyVerified: true,
    requireOpenNow: false,
    requireWalletBalance: false,
  });

  if (nearbyGarages.length === 0) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BOOKING_STATUS.EXPIRED, expiredAt: new Date() },
    });
    throw new ApiError(404, "No nearby eligible garages found");
  }

  await prisma.garageBroadcastRequest.createMany({
    data: nearbyGarages.map((garage) => ({
      bookingId,
      garageId: garage.id,
      status: BROADCAST_STATUS.SENT,
    })),
    skipDuplicates: true,
  });

  const requests = await prisma.garageBroadcastRequest.findMany({
    where: { bookingId },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });

  await Promise.allSettled(
    requests.map((request) =>
      sendGarageBookingRequestWhatsapp({ garage: request.garage, request, booking })
    )
  );

  const expiryTimer = setTimeout(
    () => bookingLifecycleService.expireBookingSearch(bookingId).catch(() => {}),
    bookingLifecycleService.getGarageSearchTimeoutMs()
  );
  if (typeof expiryTimer.unref === "function") expiryTimer.unref();

  return serializeGarageRequests(requests);
};

const getGarageRequests = async (garageId, query = {}) => {
  const requests = await prisma.garageBroadcastRequest.findMany({
    where: getGarageRequestWhere(garageId, query),
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });
  return serializeGarageRequests(requests);
};

const acceptGarageRequest = async (garageId, requestId, note) => {
  await bookingLifecycleService.expireBookingSearch(
    (
      await prisma.garageBroadcastRequest.findUnique({
        where: { id: requestId },
        select: { bookingId: true },
      })
    )?.bookingId
  );

  const request = await prisma.garageBroadcastRequest.findFirst({
    where: { id: requestId, garageId },
    include: {
      booking: true,
      garage: { include: { wallet: true } },
    },
  });

  if (!request) throw new ApiError(404, "Garage request not found");
  if (request.status !== BROADCAST_STATUS.SENT) throw new ApiError(400, "This request is no longer available");
  if (request.booking.searchExpiresAt && request.booking.searchExpiresAt < new Date()) {
    throw new ApiError(400, "Garage search expired. Customer must try again.");
  }

  if (![BOOKING_STATUS.SEARCHING_GARAGE, BOOKING_STATUS.GARAGE_ASSIGNED].includes(request.booking.status)) {
    throw new ApiError(400, "Booking is no longer accepting garages");
  }

  const result = await prisma.$transaction(async (tx) => {
    const freshBooking = await tx.booking.findUnique({ where: { id: request.bookingId } });
    if (!freshBooking) throw new ApiError(404, "Booking not found");
    if (freshBooking.garageId && freshBooking.garageId !== garageId) {
      throw new ApiError(400, "Another garage already accepted this booking");
    }
    if (![BOOKING_STATUS.SEARCHING_GARAGE, BOOKING_STATUS.GARAGE_ASSIGNED].includes(freshBooking.status)) {
      throw new ApiError(400, "Booking is no longer available");
    }
    if (freshBooking.searchExpiresAt && freshBooking.searchExpiresAt < new Date()) {
      throw new ApiError(400, "Garage search expired. Customer must try again.");
    }

    const garageAcceptFee = calculatePlatformFee(
      freshBooking.totalServiceMaxAmount || freshBooking.totalServiceAmount,
      freshBooking.requestType
    );
    const garageWallet = await tx.garageWallet.findUnique({ where: { garageId } });
    if (!garageWallet || garageWallet.balance < garageAcceptFee) {
      throw new ApiError(400, `Insufficient garage wallet balance. Recharge at least Rs. ${garageAcceptFee} to accept this booking.`);
    }

    const handoverOtp = bookingLifecycleService.createHandoverOtp();

    await tx.booking.update({
      where: { id: request.bookingId },
      data: {
        garageId,
        status: BOOKING_STATUS.CONFIRMED,
        garageNote: note || null,
        acceptedAt: new Date(),
        handoverOtpHash: handoverOtp.otpHash,
        handoverOtpExpiresAt: handoverOtp.expiresAt,
      },
    });

    await tx.garageBroadcastRequest.updateMany({
      where: { bookingId: request.bookingId, id: { not: requestId }, status: BROADCAST_STATUS.SENT },
      data: { status: BROADCAST_STATUS.EXPIRED, expiredAt: new Date() },
    });

    await tx.garageBroadcastRequest.update({
      where: { id: requestId },
      data: { status: BROADCAST_STATUS.ACCEPTED, acceptedAt: new Date(), garageResponseNote: note || null },
    });

    if (request.booking.requestType === REQUEST_TYPE.SOS) {
      const wallet = await tx.wallet.findUnique({ where: { userId: request.booking.userId } });
      if (!wallet || wallet.balance < SOS_CHARGE) throw new ApiError(400, "Customer has insufficient wallet balance for SOS");
      const balanceAfter = wallet.balance - SOS_CHARGE;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: request.booking.userId,
          type: WALLET_TRANSACTION_TYPE.SOS_DEDUCTION,
          status: WALLET_TRANSACTION_STATUS.SUCCESS,
          amount: SOS_CHARGE,
          balanceAfter,
          description: "SOS service charge deducted after garage acceptance",
        },
      });
    }

    const garageBalanceAfter = garageWallet.balance - garageAcceptFee;
    await tx.garageWallet.update({ where: { id: garageWallet.id }, data: { balance: garageBalanceAfter } });
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

  await Promise.allSettled([
    bookingLifecycleService.notifyGarageAccepted({
      booking: result.request.booking,
      garage: result.request.garage,
      otp: result.handoverOtp.otp,
      distanceKm,
      etaMinutes,
    }),
    sendCustomerGarageDetailsWhatsapp({
      customer: result.request.booking.user,
      garage: result.request.garage,
      booking: result.request.booking,
    }),
    sendGarageCustomerLocationWhatsapp({
      garage: result.request.garage,
      booking: result.request.booking,
    }),
  ]);

  return {
    ...serializeGarageRequest(result.request),
    customerLocationLink: getMapsLink(result.request.booking.customerLatitude, result.request.booking.customerLongitude),
  };
};

const rejectGarageRequest = async (garageId, requestId, note) => {
  const request = await prisma.garageBroadcastRequest.findFirst({ where: { id: requestId, garageId } });
  if (!request) throw new ApiError(404, "Garage request not found");
  if (request.status !== BROADCAST_STATUS.SENT) throw new ApiError(400, "This request cannot be rejected now");

  const updatedRequest = await prisma.garageBroadcastRequest.update({
    where: { id: requestId },
    data: { status: BROADCAST_STATUS.REJECTED, rejectedAt: new Date(), garageResponseNote: note || null },
    include: requestInclude,
  });

  return serializeGarageRequest(updatedRequest);
};

module.exports = {
  broadcastBookingToNearbyGarages,
  getGarageRequests,
  acceptGarageRequest,
  rejectGarageRequest,
};
