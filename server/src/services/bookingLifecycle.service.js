const crypto = require("crypto");

const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const BOOKING_STATUS = require("../constants/bookingStatus");
const BROADCAST_STATUS = require("../constants/broadcastStatus");
const notificationService = require("../customer/services/notification.service");
const {
  sendCustomerGarageDetailsWhatsapp,
  sendCustomerVehicleDeliveredWhatsapp,
} = require("./garageWhatsapp.service");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { REQUIRED_BOOKING_INSPECTION_IMAGES } = require("../garage/constants");

const DEFAULT_SEARCH_TIMEOUT_SECONDS = 120;
const DEFAULT_HANDOVER_OTP_TTL_MINUTES = 120;
const DEFAULT_HANDOVER_OTP_RESEND_COOLDOWN_SECONDS = 60;
const REQUIRED_INSPECTION_PHOTO_COUNT = REQUIRED_BOOKING_INSPECTION_IMAGES;
const MAX_INSPECTION_PHOTO_SIZE_BYTES = 1024 * 1024;
const INSPECTION_IMAGE_FOLDER = "project-x/bookings/inspection-images";

const getGarageSearchTimeoutMs = () => {
  const seconds = Number(
    process.env.GARAGE_SEARCH_TIMEOUT_SECONDS ||
      DEFAULT_SEARCH_TIMEOUT_SECONDS,
  );

  return (
    (Number.isFinite(seconds) && seconds > 0
      ? seconds
      : DEFAULT_SEARCH_TIMEOUT_SECONDS) * 1000
  );
};

const getSearchExpiresAt = () =>
  new Date(Date.now() + getGarageSearchTimeoutMs());

const getOtpHash = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

const getHandoverOtpTtlMinutes = () => {
  const ttlMinutes = Number(
    process.env.HANDOVER_OTP_TTL_MINUTES ||
      DEFAULT_HANDOVER_OTP_TTL_MINUTES,
  );

  return Number.isFinite(ttlMinutes) && ttlMinutes > 0
    ? ttlMinutes
    : DEFAULT_HANDOVER_OTP_TTL_MINUTES;
};

const getHandoverOtpResendCooldownSeconds = () => {
  const cooldownSeconds = Number(
    process.env.HANDOVER_OTP_RESEND_COOLDOWN_SECONDS ||
      DEFAULT_HANDOVER_OTP_RESEND_COOLDOWN_SECONDS,
  );

  return Number.isFinite(cooldownSeconds) && cooldownSeconds >= 0
    ? cooldownSeconds
    : DEFAULT_HANDOVER_OTP_RESEND_COOLDOWN_SECONDS;
};

const createHandoverOtp = () => {
  const otp = String(crypto.randomInt(100000, 1000000));
  const ttlMinutes = getHandoverOtpTtlMinutes();

  return {
    otp,
    otpHash: getOtpHash(otp),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  };
};

const validateInspectionImages = (files) => {
  if (
    !Array.isArray(files) ||
    files.length !== REQUIRED_INSPECTION_PHOTO_COUNT
  ) {
    throw new ApiError(
      400,
      `Exactly ${REQUIRED_INSPECTION_PHOTO_COUNT} car inspection photos are required`,
    );
  }

  for (const file of files) {
    if (!file.mimetype?.startsWith("image/")) {
      throw new ApiError(
        400,
        "Only image files are allowed for car inspection photos",
      );
    }

    if (file.size > MAX_INSPECTION_PHOTO_SIZE_BYTES) {
      throw new ApiError(
        400,
        "Each car inspection photo must be less than or equal to 1 MB",
      );
    }
  }
};

const uploadInspectionImages = async ({
  bookingId,
  garageId,
  phase,
  files,
}) => {
  validateInspectionImages(files);

  const existingImages = await prisma.bookingInspectionImage.findMany({
    where: { bookingId, phase },
    orderBy: { order: "asc" },
  });

  if (existingImages.length > 0) {
    if (existingImages.length === REQUIRED_INSPECTION_PHOTO_COUNT) {
      return existingImages;
    }

    throw new ApiError(
      400,
      `Existing ${phase.toLowerCase()} inspection photos are incomplete`,
    );
  }

  const uploadedImages = [];

  for (const file of files) {
    const uploaded = await uploadToCloudinary(
      file.buffer,
      INSPECTION_IMAGE_FOLDER,
      "image",
    );
    uploadedImages.push(uploaded);
  }

  await prisma.bookingInspectionImage.createMany({
    data: uploadedImages.map((image, index) => ({
      bookingId,
      garageId,
      phase,
      imageUrl: image.secure_url,
      publicId: image.public_id,
      order: index,
    })),
    skipDuplicates: true,
  });

  return prisma.bookingInspectionImage.findMany({
    where: { bookingId, phase },
    orderBy: { order: "asc" },
  });
};

const bookingDetailInclude = {
  user: true,
  vehicle: true,
  garage: true,
  services: { include: { service: true } },
  payment: true,
  inspectionImages: {
    orderBy: [{ phase: "asc" }, { order: "asc" }],
  },
};

/**
 * Expires only the current two-minute broadcast round.
 *
 * The booking deliberately stays SEARCHING_GARAGE. The next customer tracking
 * poll will claim and start another round. This avoids relying on an in-memory
 * setTimeout, which disappears whenever the server sleeps or restarts.
 */
const expireBookingSearch = async (bookingId) => {
  if (!bookingId) return null;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (
    !booking ||
    booking.status !== BOOKING_STATUS.SEARCHING_GARAGE ||
    booking.garageId
  ) {
    return booking;
  }

  const now = new Date();

  if (booking.searchExpiresAt && booking.searchExpiresAt > now) {
    return booking;
  }

  return prisma.$transaction(async (tx) => {
    await tx.garageBroadcastRequest.updateMany({
      where: {
        bookingId,
        status: BROADCAST_STATUS.SENT,
      },
      data: {
        status: BROADCAST_STATUS.EXPIRED,
        expiredAt: now,
      },
    });

    return tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BOOKING_STATUS.SEARCHING_GARAGE,
        searchExpiresAt: null,
        expiredAt: null,
      },
    });
  });
};

const expireStaleGarageSearchesForUser = async (userId) => {
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: BOOKING_STATUS.SEARCHING_GARAGE,
      garageId: null,
      searchExpiresAt: { lte: now },
    },
    select: { id: true },
  });

  for (const booking of bookings) {
    await expireBookingSearch(booking.id);
  }
};

const notifyGarageAccepted = async ({
  booking,
  garage,
  otp,
  distanceKm = null,
  etaMinutes = null,
}) => {
  const etaText = etaMinutes
    ? ` Estimated arrival: ${etaMinutes} min${
        distanceKm ? ` (${Number(distanceKm).toFixed(1)} km away)` : ""
      }.`
    : "";

  return notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: "Garage accepted your request",
    message: `${garage.name} has accepted your service request.${etaText} Your handover OTP is ${otp}. Share it with the garage only when handing over the vehicle.`,
    link: "/dashboard/bookings",
    metadata: {
      bookingId: booking.id,
      garageId: garage.id,
      otp,
      distanceKm,
      etaMinutes,
      purpose: "VEHICLE_HANDOVER",
    },
  });
};

const notifyVehicleDelivered = async ({ booking, garage }) => {
  return notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: "Vehicle marked delivered",
    message: `${garage.name} has marked your vehicle as delivered. Please review and accept delivery to move it to service history.`,
    link: "/dashboard/bookings",
    metadata: {
      bookingId: booking.id,
      garageId: garage.id,
      action: "ACCEPT_DELIVERY",
    },
  });
};

const regenerateBookingHandoverOtp = async ({ userId, bookingId }) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      user: true,
      garage: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (!booking.garageId || !booking.garage) {
    throw new ApiError(400, "A garage has not accepted this booking yet");
  }

  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new ApiError(
      400,
      "A new handover OTP can be generated only before service starts",
    );
  }

  if (booking.handoverOtpVerifiedAt) {
    throw new ApiError(400, "Vehicle handover is already verified");
  }

  if (booking.handoverOtpExpiresAt) {
    const ttlMilliseconds = getHandoverOtpTtlMinutes() * 60 * 1000;
    const previousGeneratedAt = new Date(
      booking.handoverOtpExpiresAt.getTime() - ttlMilliseconds,
    );
    const cooldownMilliseconds =
      getHandoverOtpResendCooldownSeconds() * 1000;
    const retryAt = new Date(
      previousGeneratedAt.getTime() + cooldownMilliseconds,
    );

    if (retryAt > new Date()) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil((retryAt.getTime() - Date.now()) / 1000),
      );
      throw new ApiError(
        429,
        `Please wait ${remainingSeconds} seconds before generating another OTP`,
      );
    }
  }

  const handoverOtp = createHandoverOtp();

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      handoverOtpHash: handoverOtp.otpHash,
      handoverOtpExpiresAt: handoverOtp.expiresAt,
    },
    include: bookingDetailInclude,
  });

  await Promise.allSettled([
    notificationService.createNotification({
      userId: booking.userId,
      type: "BOOKING",
      title: "New vehicle handover OTP",
      message: `Your new handover OTP is ${handoverOtp.otp}. Share it only when handing the vehicle to ${booking.garage.name}.`,
      link: `/tracking?bookingId=${booking.id}`,
      metadata: {
        bookingId: booking.id,
        garageId: booking.garage.id,
        otp: handoverOtp.otp,
        expiresAt: handoverOtp.expiresAt.toISOString(),
        purpose: "VEHICLE_HANDOVER",
      },
    }),
    sendCustomerGarageDetailsWhatsapp({
      customer: booking.user,
      garage: booking.garage,
      booking,
      otp: handoverOtp.otp,
      otpExpiresAt: handoverOtp.expiresAt,
      isRegenerated: true,
    }),
  ]);

  return {
    booking: updatedBooking,
    otp: handoverOtp.otp,
    expiresAt: handoverOtp.expiresAt,
  };
};

const verifyBookingHandoverOtp = async ({
  garageId,
  requestId,
  otp,
  images,
}) => {
  const request = await prisma.garageBroadcastRequest.findFirst({
    where: {
      id: requestId,
      garageId,
      status: BROADCAST_STATUS.ACCEPTED,
    },
    include: { booking: true, garage: true },
  });

  if (!request) {
    throw new ApiError(404, "Accepted garage request not found");
  }

  const booking = request.booking;

  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new ApiError(
      400,
      "Booking is not ready for handover OTP verification",
    );
  }

  if (!booking.handoverOtpHash || !booking.handoverOtpExpiresAt) {
    throw new ApiError(
      400,
      "Handover OTP is not available for this booking",
    );
  }

  if (booking.handoverOtpExpiresAt < new Date()) {
    throw new ApiError(400, "Handover OTP has expired");
  }

  if (getOtpHash(otp) !== booking.handoverOtpHash) {
    throw new ApiError(400, "Invalid handover OTP");
  }

  await uploadInspectionImages({
    bookingId: booking.id,
    garageId,
    phase: "PICKUP",
    files: images,
  });

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BOOKING_STATUS.IN_PROGRESS,
      handoverOtpVerifiedAt: new Date(),
    },
    include: bookingDetailInclude,
  });

  return { request, booking: updatedBooking };
};

const markBookingDeliveredByGarage = async ({
  garageId,
  requestId,
  images,
  finalAmount,
}) => {
  const parsedFinalAmount = Math.round(Number(finalAmount));

  if (!Number.isFinite(parsedFinalAmount) || parsedFinalAmount <= 0) {
    throw new ApiError(400, "Final service amount is required");
  }

  const request = await prisma.garageBroadcastRequest.findFirst({
    where: {
      id: requestId,
      garageId,
      status: BROADCAST_STATUS.ACCEPTED,
    },
    include: {
      booking: { include: { user: true } },
      garage: true,
    },
  });

  if (!request) {
    throw new ApiError(404, "Accepted garage request not found");
  }

  const booking = request.booking;

  if (!booking.handoverOtpVerifiedAt) {
    throw new ApiError(
      400,
      "Verify customer handover OTP before marking delivery",
    );
  }

  if (
    ![
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.CONFIRMED,
    ].includes(booking.status)
  ) {
    throw new ApiError(400, "Booking cannot be marked delivered now");
  }

  if (booking.deliveredAt) {
    throw new ApiError(400, "Booking is already marked delivered");
  }

  await uploadInspectionImages({
    bookingId: booking.id,
    garageId,
    phase: "DELIVERY",
    files: images,
  });

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      deliveredAt: new Date(),
      totalServiceAmount: parsedFinalAmount,
      totalServiceMaxAmount: parsedFinalAmount,
    },
    include: bookingDetailInclude,
  });

  await Promise.allSettled([
    notifyVehicleDelivered({
      booking: updatedBooking,
      garage: request.garage,
    }),
    sendCustomerVehicleDeliveredWhatsapp({
      customer: request.booking.user,
      garage: request.garage,
      booking: updatedBooking,
    }),
  ]);

  return { request, booking: updatedBooking };
};

const acceptDeliveredBookingByCustomer = async ({ userId, bookingId }) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { garage: true, payment: true },
  });

  if (!booking) throw new ApiError(404, "Booking not found");

  if (!booking.deliveredAt) {
    throw new ApiError(
      400,
      "Garage has not marked this booking delivered yet",
    );
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BOOKING_STATUS.COMPLETED,
      customerAcceptedAt: new Date(),
    },
    include: {
      garage: true,
      vehicle: true,
      services: { include: { service: true } },
      payment: true,
      review: true,
      inspectionImages: {
        orderBy: [{ phase: "asc" }, { order: "asc" }],
      },
    },
  });
};

module.exports = {
  createHandoverOtp,
  expireBookingSearch,
  expireStaleGarageSearchesForUser,
  getGarageSearchTimeoutMs,
  getSearchExpiresAt,
  notifyGarageAccepted,
  regenerateBookingHandoverOtp,
  verifyBookingHandoverOtp,
  markBookingDeliveredByGarage,
  acceptDeliveredBookingByCustomer,
};
