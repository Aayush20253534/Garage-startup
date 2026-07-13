const crypto = require("crypto");
const { Resend } = require("resend");

const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const invalidateCustomerCache = require("../utils/invalidateCustomerCache");
const { deletePattern } = require("../utils/cache");
const BOOKING_STATUS = require("../constants/bookingStatus");
const BROADCAST_STATUS = require("../constants/broadcastStatus");
const notificationService = require("../customer/services/notification.service");
const activityService = require("../customer/services/activity.service");
const {
  sendCustomerVehicleDeliveredWhatsapp,
} = require("./garageWhatsapp.service");
const {
  deleteFromCloudinary,
  uploadToCloudinary,
} = require("../utils/cloudinaryUpload");
const { REQUIRED_BOOKING_INSPECTION_IMAGES } = require("../garage/constants");

const DEFAULT_SEARCH_TIMEOUT_SECONDS = 120;
const DEFAULT_HANDOVER_OTP_TTL_MINUTES = 120;
const DEFAULT_HANDOVER_OTP_RESEND_COOLDOWN_SECONDS = 60;
const HANDOVER_OTP_MAX_ATTEMPTS = 5;
const HANDOVER_OTP_CLAIM_TIMEOUT_MS = 3 * 60 * 1000;
const OTP_CONCURRENCY_RETRIES = 8;
const REQUIRED_INSPECTION_PHOTO_COUNT = REQUIRED_BOOKING_INSPECTION_IMAGES;
const MAX_INSPECTION_PHOTO_SIZE_BYTES = 1024 * 1024;
const INSPECTION_IMAGE_FOLDER = "project-x/bookings/inspection-images";
let resendClient = null;
let activeResendApiKey = null;

const invalidateBookingReadCaches = async (userId, bookingId) => {
  if (!userId) return;

  await Promise.allSettled([
    invalidateCustomerCache(userId),
    deletePattern(`customer:${userId}:bookings:*`),
    bookingId
      ? deletePattern(`customer:${userId}:booking:${bookingId}*`)
      : deletePattern(`customer:${userId}:booking:*`),
  ]);
};

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

const getEmailSender = () =>
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM_EMAIL ||
  "Rovauto <onboarding@resend.dev>";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getResendClient = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return null;

  if (!resendClient || activeResendApiKey !== apiKey) {
    resendClient = new Resend(apiKey);
    activeResendApiKey = apiKey;
  }

  return resendClient;
};

const sendCustomerHandoverOtpEmail = async ({
  customer,
  garage,
  booking,
  otp,
  otpExpiresAt,
  isRegenerated = false,
}) => {
  const email = String(customer?.email || "").trim().toLowerCase();
  if (!email || !otp) return { sent: false, reason: "missing-recipient" };

  const resend = getResendClient();
  const from = getEmailSender();

  if (!resend || !from) {
    console.warn("[handover-email] skipped; Resend is not configured");
    return { sent: false, reason: "email-not-configured" };
  }

  const subject = isRegenerated
    ? "New Rovauto vehicle handover OTP"
    : "Your Rovauto vehicle handover OTP";
  const expiryText = otpExpiresAt
    ? new Date(otpExpiresAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "soon";
  const garageName = garage?.name || "your assigned garage";
  const bookingCode = booking?.bookingCode || booking?.id || "your booking";
  const safeSubject = escapeHtml(subject);
  const safeGarageName = escapeHtml(garageName);
  const safeBookingCode = escapeHtml(bookingCode);
  const safeExpiryText = escapeHtml(expiryText);
  const safeOtp = escapeHtml(otp);
  const text = [
    `Your Rovauto handover OTP is ${otp}.`,
    `Booking: ${bookingCode}`,
    `Garage: ${garageName}`,
    `Expires: ${expiryText}`,
    "Share this OTP only when physically handing over your vehicle.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h2>${safeSubject}</h2>
      <p>Your OTP for booking <strong>${safeBookingCode}</strong> is:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${safeOtp}</div>
      <p>Garage: <strong>${safeGarageName}</strong></p>
      <p>Expires: <strong>${safeExpiryText}</strong></p>
      <p>Share this OTP only when physically handing over your vehicle.</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject,
    html,
    text,
    tags: [{ name: "type", value: "handover_otp" }],
  });

  if (error) {
    throw new ApiError(502, error.message || "Unable to send handover OTP email");
  }

  return { sent: true, emailId: data?.id || null };
};

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

const cleanupUploadedInspectionImages = async (uploadedImages = []) => {
  if (uploadedImages.length === 0) return;

  const results = await Promise.allSettled(
    uploadedImages.map((image) =>
      deleteFromCloudinary(image.public_id, "image"),
    ),
  );

  const failedCleanup = results.filter(
    (result) => result.status === "rejected",
  );

  if (failedCleanup.length > 0) {
    console.error(
      `[inspection-upload] unable to cleanup ${failedCleanup.length} uploaded image(s)`,
    );
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

  try {
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
    });
  } catch (error) {
    await cleanupUploadedInspectionImages(uploadedImages);

    const existingImagesAfterRace =
      await prisma.bookingInspectionImage.findMany({
        where: { bookingId, phase },
        orderBy: { order: "asc" },
      });

    if (
      existingImagesAfterRace.length === REQUIRED_INSPECTION_PHOTO_COUNT
    ) {
      return existingImagesAfterRace;
    }

    throw error;
  }

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

  const updatedBooking = await prisma.$transaction(async (tx) => {
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

  await invalidateBookingReadCaches(booking.userId, booking.id);
  return updatedBooking;
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
    message: `${garage.name} has accepted your service request.${etaText} Your handover OTP has been sent to your registered email address.`,
    link: "/dashboard/bookings",
    metadata: {
      bookingId: booking.id,
      garageId: garage.id,
      distanceKm,
      etaMinutes,
    },
  });
};

const notifyVehicleHandoverOtp = async ({
  booking,
  garage,
  otp,
  expiresAt,
  isRegenerated = false,
}) => {
  if (!otp) return null;

  return notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: isRegenerated
      ? "New vehicle handover OTP"
      : "Vehicle handover OTP",
    message: [
      `Your handover OTP is ${otp}.`,
      garage?.name
        ? `Share it only when handing your vehicle to ${garage.name}.`
        : "Share it only during physical vehicle handover.",
      "Do not share it early or with anyone else.",
    ].join(" "),
    link: `/tracking?bookingId=${booking.id}`,
    metadata: {
      bookingId: booking.id,
      garageId: garage?.id || booking.garageId || null,
      otp,
      expiresAt: expiresAt?.toISOString?.() || expiresAt || null,
      purpose: "VEHICLE_HANDOVER",
    },
    pushMessage:
      "Your vehicle handover OTP is ready. Open Rovauto to view it securely.",
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

  if (booking.handoverOtpClaimedAt) {
    const claimAge = Date.now() - booking.handoverOtpClaimedAt.getTime();
    if (claimAge < HANDOVER_OTP_CLAIM_TIMEOUT_MS) {
      throw new ApiError(
        409,
        "Handover OTP verification is already in progress",
      );
    }
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
      handoverOtpAttempts: 0,
      handoverOtpClaimedAt: null,
    },
    include: bookingDetailInclude,
  });

  await Promise.allSettled([
    notifyVehicleHandoverOtp({
      booking,
      garage: booking.garage,
      otp: handoverOtp.otp,
      expiresAt: handoverOtp.expiresAt,
      isRegenerated: true,
    }),
    sendCustomerHandoverOtpEmail({
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

  const submittedOtp = String(otp || "").trim();
  if (!/^\d{6}$/.test(submittedOtp)) {
    throw new ApiError(400, "Handover OTP must be 6 digits");
  }

  const submittedHash = getOtpHash(submittedOtp);
  let claimedAt = null;

  for (let retry = 0; retry < OTP_CONCURRENCY_RETRIES; retry += 1) {
    const booking = await prisma.booking.findUnique({
      where: { id: request.bookingId },
    });

    if (!booking || booking.garageId !== garageId) {
      throw new ApiError(404, "Accepted garage request not found");
    }

    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw new ApiError(
        400,
        "Booking is not ready for handover OTP verification",
      );
    }

    if (booking.handoverOtpVerifiedAt) {
      throw new ApiError(400, "Handover OTP has already been used");
    }

    if (!booking.handoverOtpHash || !booking.handoverOtpExpiresAt) {
      throw new ApiError(
        400,
        "Handover OTP is not available for this booking",
      );
    }

    const now = new Date();

    if (booking.handoverOtpExpiresAt <= now) {
      throw new ApiError(400, "Handover OTP has expired");
    }

    if (booking.handoverOtpAttempts >= HANDOVER_OTP_MAX_ATTEMPTS) {
      throw new ApiError(
        429,
        "Maximum handover OTP attempts exceeded. Generate a new OTP.",
      );
    }

    if (booking.handoverOtpClaimedAt) {
      const claimAge = now.getTime() - booking.handoverOtpClaimedAt.getTime();

      if (claimAge < HANDOVER_OTP_CLAIM_TIMEOUT_MS) {
        throw new ApiError(
          409,
          "Handover OTP verification is already in progress",
        );
      }

      const released = await prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: BOOKING_STATUS.CONFIRMED,
          handoverOtpVerifiedAt: null,
          handoverOtpClaimedAt: booking.handoverOtpClaimedAt,
        },
        data: { handoverOtpClaimedAt: null },
      });

      if (released.count !== 1) continue;
      continue;
    }

    if (submittedHash !== booking.handoverOtpHash) {
      const nextAttempts = booking.handoverOtpAttempts + 1;
      const attempted = await prisma.booking.updateMany({
        where: {
          id: booking.id,
          garageId,
          status: BOOKING_STATUS.CONFIRMED,
          handoverOtpHash: booking.handoverOtpHash,
          handoverOtpVerifiedAt: null,
          handoverOtpClaimedAt: null,
          handoverOtpAttempts: booking.handoverOtpAttempts,
          handoverOtpExpiresAt: { gt: now },
        },
        data: {
          handoverOtpAttempts: nextAttempts,
          ...(nextAttempts >= HANDOVER_OTP_MAX_ATTEMPTS && {
            handoverOtpHash: null,
            handoverOtpExpiresAt: null,
          }),
        },
      });

      if (attempted.count !== 1) continue;

      if (nextAttempts >= HANDOVER_OTP_MAX_ATTEMPTS) {
        throw new ApiError(
          429,
          "Maximum handover OTP attempts exceeded. Generate a new OTP.",
        );
      }

      throw new ApiError(400, "Invalid handover OTP");
    }

    claimedAt = new Date();
    const claimed = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        garageId,
        status: BOOKING_STATUS.CONFIRMED,
        handoverOtpHash: booking.handoverOtpHash,
        handoverOtpVerifiedAt: null,
        handoverOtpClaimedAt: null,
        handoverOtpAttempts: booking.handoverOtpAttempts,
        handoverOtpExpiresAt: { gt: claimedAt },
      },
      data: { handoverOtpClaimedAt: claimedAt },
    });

    if (claimed.count === 1) break;
    claimedAt = null;
  }

  if (!claimedAt) {
    throw new ApiError(
      409,
      "Handover OTP verification is already in progress. Please retry.",
    );
  }

  try {
    await uploadInspectionImages({
      bookingId: request.bookingId,
      garageId,
      phase: "PICKUP",
      files: images,
    });

    const verifiedAt = new Date();
    const finalized = await prisma.booking.updateMany({
      where: {
        id: request.bookingId,
        garageId,
        status: BOOKING_STATUS.CONFIRMED,
        handoverOtpVerifiedAt: null,
        handoverOtpClaimedAt: claimedAt,
      },
      data: {
        status: BOOKING_STATUS.IN_PROGRESS,
        handoverOtpVerifiedAt: verifiedAt,
        handoverOtpClaimedAt: null,
      },
    });

    if (finalized.count !== 1) {
      throw new ApiError(
        409,
        "Handover OTP was already used or the booking changed",
      );
    }
  } catch (error) {
    await prisma.booking.updateMany({
      where: {
        id: request.bookingId,
        status: BOOKING_STATUS.CONFIRMED,
        handoverOtpVerifiedAt: null,
        handoverOtpClaimedAt: claimedAt,
      },
      data: { handoverOtpClaimedAt: null },
    }).catch(() => {});

    throw error;
  }

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: request.bookingId },
    include: bookingDetailInclude,
  });

  if (!updatedBooking) {
    throw new ApiError(409, "Booking changed during handover verification");
  }

  await activityService.createActivitySafely(
    updatedBooking.userId,
    {
      type: "SERVICE_STARTED",
      title: "Vehicle handover verified",
      detail: `Booking ${updatedBooking.bookingCode || updatedBooking.id} moved to service in progress.`,
      path: `/tracking?bookingId=${updatedBooking.id}`,
      metadata: {
        bookingId: updatedBooking.id,
        bookingCode: updatedBooking.bookingCode,
        garageId,
      },
    },
    { eventKey: `booking:${updatedBooking.id}:handover-verified` },
  );

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);

  return { request, booking: updatedBooking };
};

const markBookingDeliveredByGarage = async ({
  garageId,
  requestId,
  images,
}) => {
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

  await activityService.createActivitySafely(
    updatedBooking.userId,
    {
      type: "READY_FOR_DELIVERY",
      title: "Vehicle ready for acceptance",
      detail: `Booking ${updatedBooking.bookingCode || updatedBooking.id} was marked ready by ${request.garage.name}.`,
      path: `/tracking?bookingId=${updatedBooking.id}`,
      metadata: {
        bookingId: updatedBooking.id,
        bookingCode: updatedBooking.bookingCode,
        garageId,
      },
    },
    { eventKey: `booking:${updatedBooking.id}:delivered` },
  );

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);

  return { request, booking: updatedBooking };
};

const acceptDeliveredBookingByCustomer = async ({
  userId,
  bookingId,
  finalAmount,
}) => {
  const parsedFinalAmount = Math.round(Number(finalAmount));

  if (!Number.isFinite(parsedFinalAmount) || parsedFinalAmount <= 0) {
    throw new ApiError(400, "Final service amount is required");
  }

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

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BOOKING_STATUS.COMPLETED,
      customerAcceptedAt: new Date(),
      totalServiceAmount: parsedFinalAmount,
      totalServiceMaxAmount: parsedFinalAmount,
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

  await activityService.createActivitySafely(
    updatedBooking.userId,
    {
      type: "BOOKING_COMPLETED",
      title: "Service completed",
      detail: `Booking ${updatedBooking.bookingCode || updatedBooking.id} was completed after delivery acceptance.`,
      path: "/dashboard/history",
      metadata: {
        bookingId: updatedBooking.id,
        bookingCode: updatedBooking.bookingCode,
        finalAmount: parsedFinalAmount,
      },
    },
    { eventKey: `booking:${updatedBooking.id}:completed` },
  );

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);

  return updatedBooking;
};

module.exports = {
  createHandoverOtp,
  expireBookingSearch,
  expireStaleGarageSearchesForUser,
  getGarageSearchTimeoutMs,
  getSearchExpiresAt,
  notifyGarageAccepted,
  notifyVehicleHandoverOtp,
  sendCustomerHandoverOtpEmail,
  regenerateBookingHandoverOtp,
  verifyBookingHandoverOtp,
  markBookingDeliveredByGarage,
  acceptDeliveredBookingByCustomer,
};
