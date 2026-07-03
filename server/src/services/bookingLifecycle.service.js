const crypto = require("crypto");

const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const BOOKING_STATUS = require("../constants/bookingStatus");
const BROADCAST_STATUS = require("../constants/broadcastStatus");
const notificationService = require("../customer/services/notification.service");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { REQUIRED_BOOKING_INSPECTION_IMAGES } = require("../garage/constants");

const DEFAULT_SEARCH_TIMEOUT_SECONDS = 120;
const DEFAULT_HANDOVER_OTP_TTL_MINUTES = 30;
const REQUIRED_INSPECTION_PHOTO_COUNT = REQUIRED_BOOKING_INSPECTION_IMAGES;
const MAX_INSPECTION_PHOTO_SIZE_BYTES = 1024 * 1024;
const INSPECTION_IMAGE_FOLDER = "project-x/bookings/inspection-images";

const getGarageSearchTimeoutMs = () => {
  const seconds = Number(process.env.GARAGE_SEARCH_TIMEOUT_SECONDS || DEFAULT_SEARCH_TIMEOUT_SECONDS);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_SEARCH_TIMEOUT_SECONDS) * 1000;
};

const getSearchExpiresAt = () => new Date(Date.now() + getGarageSearchTimeoutMs());

const getOtpHash = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const createHandoverOtp = () => {
  const otp = String(crypto.randomInt(100000, 1000000));
  const ttlMinutes = Number(process.env.HANDOVER_OTP_TTL_MINUTES || DEFAULT_HANDOVER_OTP_TTL_MINUTES);
  const expiresAt = new Date(Date.now() + (Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : DEFAULT_HANDOVER_OTP_TTL_MINUTES) * 60 * 1000);
  return { otp, otpHash: getOtpHash(otp), expiresAt };
};


const validateInspectionImages = (files) => {
  if (!Array.isArray(files) || files.length !== REQUIRED_INSPECTION_PHOTO_COUNT) {
    throw new ApiError(400, `Exactly ${REQUIRED_INSPECTION_PHOTO_COUNT} car inspection photos are required`);
  }

  for (const file of files) {
    if (!file.mimetype?.startsWith("image/")) {
      throw new ApiError(400, "Only image files are allowed for car inspection photos");
    }

    if (file.size > MAX_INSPECTION_PHOTO_SIZE_BYTES) {
      throw new ApiError(400, "Each car inspection photo must be less than or equal to 1 MB");
    }
  }
};

const uploadInspectionImages = async ({ bookingId, garageId, phase, files }) => {
  validateInspectionImages(files);

  const existingImages = await prisma.bookingInspectionImage.findMany({
    where: { bookingId, phase },
    orderBy: { order: "asc" },
  });

  if (existingImages.length > 0) {
    if (existingImages.length === REQUIRED_INSPECTION_PHOTO_COUNT) return existingImages;
    throw new ApiError(400, `Existing ${phase.toLowerCase()} inspection photos are incomplete`);
  }

  const uploadedImages = [];
  for (const file of files) {
    const uploaded = await uploadToCloudinary(file.buffer, INSPECTION_IMAGE_FOLDER, "image");
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
  inspectionImages: { orderBy: [{ phase: "asc" }, { order: "asc" }] },
};
const notifySearchExpired = async (booking) => {
  await notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: "Please try again",
    message: "No garage accepted your service request in time. Please try again - nearby garages may be busy right now.",
    link: "/dashboard/bookings",
    metadata: { bookingId: booking.id, reason: "GARAGE_SEARCH_TIMEOUT" },
  });
};

const expireBookingSearch = async (bookingId) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== BOOKING_STATUS.SEARCHING_GARAGE || booking.garageId) return booking;
  if (!booking.searchExpiresAt || booking.searchExpiresAt > new Date()) return booking;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.garageBroadcastRequest.updateMany({
      where: { bookingId, status: BROADCAST_STATUS.SENT },
      data: { status: BROADCAST_STATUS.EXPIRED, expiredAt: new Date() },
    });

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BOOKING_STATUS.EXPIRED, expiredAt: new Date() },
    });
  });

  await notifySearchExpired(updated);
  return updated;
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
  });

  for (const booking of bookings) {
    await expireBookingSearch(booking.id);
  }
};

const notifyGarageAccepted = async ({ booking, garage, otp, distanceKm = null, etaMinutes = null }) => {
  const etaText = etaMinutes
    ? ` Estimated arrival: ${etaMinutes} min${distanceKm ? ` (${Number(distanceKm).toFixed(1)} km away)` : ""}.`
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
    metadata: { bookingId: booking.id, garageId: garage.id, action: "ACCEPT_DELIVERY" },
  });
};

const verifyBookingHandoverOtp = async ({ garageId, requestId, otp, images }) => {
  const request = await prisma.garageBroadcastRequest.findFirst({
    where: { id: requestId, garageId, status: BROADCAST_STATUS.ACCEPTED },
    include: { booking: true, garage: true },
  });

  if (!request) throw new ApiError(404, "Accepted garage request not found");
  const booking = request.booking;

  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new ApiError(400, "Booking is not ready for handover OTP verification");
  }

  if (!booking.handoverOtpHash || !booking.handoverOtpExpiresAt) {
    throw new ApiError(400, "Handover OTP is not available for this booking");
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

const markBookingDeliveredByGarage = async ({ garageId, requestId, images }) => {
  const request = await prisma.garageBroadcastRequest.findFirst({
    where: { id: requestId, garageId, status: BROADCAST_STATUS.ACCEPTED },
    include: { booking: { include: { user: true } }, garage: true },
  });

  if (!request) throw new ApiError(404, "Accepted garage request not found");
  const booking = request.booking;

  if (!booking.handoverOtpVerifiedAt) {
    throw new ApiError(400, "Verify customer handover OTP before marking delivery");
  }

  if (![BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.CONFIRMED].includes(booking.status)) {
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
    data: { deliveredAt: new Date() },
    include: bookingDetailInclude,
  });

  await notifyVehicleDelivered({ booking: updatedBooking, garage: request.garage });
  return { request, booking: updatedBooking };
};

const acceptDeliveredBookingByCustomer = async ({ userId, bookingId }) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { garage: true, payment: true },
  });

  if (!booking) throw new ApiError(404, "Booking not found");
  if (!booking.deliveredAt) throw new ApiError(400, "Garage has not marked this booking delivered yet");
  if (booking.payment && booking.payment.status !== "PAID") throw new ApiError(400, "Payment is not completed");

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
      inspectionImages: { orderBy: [{ phase: "asc" }, { order: "asc" }] },
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
  verifyBookingHandoverOtp,
  markBookingDeliveredByGarage,
  acceptDeliveredBookingByCustomer,
};
