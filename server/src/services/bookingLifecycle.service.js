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
const garageControllerService = require("../garage/services/controller.service");
const {
  sendCustomerServiceCompletedWhatsapp,
} = require("./garageWhatsapp.service");
const {
  deleteFromCloudinary,
  uploadToCloudinary,
} = require("../utils/cloudinaryUpload");
const {
  MIN_BOOKING_INSPECTION_IMAGES,
  MAX_BOOKING_INSPECTION_IMAGES,
  REQUIRED_BOOKING_INSPECTION_VIDEOS,
  MAX_BOOKING_INSPECTION_VIDEO_SIZE_BYTES,
} = require("../garage/constants");
const {
  bookingUsesSelfDropOff,
} = require("../constants/serviceFulfillmentType");

const DEFAULT_SEARCH_TIMEOUT_SECONDS = 150;
const HANDOVER_OTP_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_HANDOVER_OTP_RESEND_COOLDOWN_SECONDS = 60;
const HANDOVER_OTP_MAX_ATTEMPTS = 5;
const HANDOVER_OTP_CLAIM_TIMEOUT_MS = 3 * 60 * 1000;
const OTP_CONCURRENCY_RETRIES = 8;
const MIN_INSPECTION_PHOTO_COUNT = MIN_BOOKING_INSPECTION_IMAGES;
const MAX_INSPECTION_PHOTO_COUNT = MAX_BOOKING_INSPECTION_IMAGES;
const REQUIRED_INSPECTION_VIDEO_COUNT = REQUIRED_BOOKING_INSPECTION_VIDEOS;
const MAX_INSPECTION_PHOTO_SIZE_BYTES = 1024 * 1024;
const MAX_INSPECTION_VIDEO_SIZE_BYTES = MAX_BOOKING_INSPECTION_VIDEO_SIZE_BYTES;
const INSPECTION_IMAGE_FOLDER = "project-x/bookings/inspection-images";
const INSPECTION_VIDEO_FOLDER = "project-x/bookings/inspection-videos";
const INSPECTION_VIDEO_EAGER_TRANSFORMATION = {
  format: "mp4",
  quality: "auto:good",
  video_codec: {
    codec: "h264",
    profile: "baseline",
    level: "3.1",
  },
};
const GARAGE_ARRIVAL_DISTANCE_METERS = Math.max(
  100,
  Number(process.env.GARAGE_ARRIVAL_DISTANCE_METERS || 300),
);
const CUSTOMER_DELIVERY_ARRIVAL_DISTANCE_METERS = Math.max(
  100,
  Number(process.env.CUSTOMER_DELIVERY_ARRIVAL_DISTANCE_METERS || 300),
);
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
  if (bookingUsesSelfDropOff(booking)) {
    return { sent: false, reason: "not-required-for-self-drop" };
  }

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
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
        timeZoneName: "short",
      })
    : "soon";
  const garageName = garage?.name || "your assigned garage";
  const bookingCode = booking?.bookingCode || booking?.id || "your booking";
  const safeSubject = escapeHtml(subject);
  const safeGarageName = escapeHtml(garageName);
  const safeBookingCode = escapeHtml(bookingCode);
  const safeExpiryText = escapeHtml(expiryText);
  const safeOtp = escapeHtml(otp);
  const handoverInstruction =
    "Share this OTP only when physically handing over your vehicle.";
  const safeHandoverInstruction = escapeHtml(handoverInstruction);
  const text = [
    `Your Rovauto handover OTP is ${otp}.`,
    `Booking: ${bookingCode}`,
    `Garage: ${garageName}`,
    `Expires: ${expiryText}`,
    "This OTP is valid for exactly 2 hours from generation.",
    handoverInstruction,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h2>${safeSubject}</h2>
      <p>Your OTP for booking <strong>${safeBookingCode}</strong> is:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${safeOtp}</div>
      <p>Garage: <strong>${safeGarageName}</strong></p>
      <p>Expires: <strong>${safeExpiryText}</strong></p>
      <p>This OTP is valid for exactly 2 hours from generation.</p>
      <p>${safeHandoverInstruction}</p>
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

const sendCustomerServiceCompletedEmail = async ({
  customer,
  garage,
  booking,
}) => {
  const email = String(customer?.email || "").trim().toLowerCase();
  if (!email) return { sent: false, reason: "missing-recipient" };

  const resend = getResendClient();
  const from = getEmailSender();
  if (!resend || !from) {
    console.warn("[service-completed-email] skipped; Resend is not configured");
    return { sent: false, reason: "email-not-configured" };
  }

  const selfDropOff = bookingUsesSelfDropOff(booking);
  const bookingCode = booking?.bookingCode || booking?.id || "your booking";
  const garageName = garage?.name || "your assigned garage";
  const vehicleName = [booking?.vehicle?.brand, booking?.vehicle?.model]
    .filter(Boolean)
    .join(" ") || "your vehicle";
  const trackingUrl = `${String(
    process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "https://www.rovauto.com",
  ).replace(/\/+$/, "")}/tracking?bookingId=${encodeURIComponent(booking.id)}`;
  const subject = selfDropOff
    ? `Your Rovauto service is complete — ${bookingCode}`
    : `Service complete: ${vehicleName} is on the way`;
  const actionText = selfDropOff
    ? `Your vehicle is ready for collection at ${garageName}.`
    : `Your vehicle has left ${garageName} and is on the way to your address.`;
  const nextStep = selfDropOff
    ? "Visit the garage, inspect the vehicle, choose Cash or UPI, and submit the final amount from your Rovauto booking page."
    : "Keep the Rovauto tracking page open to follow the return journey. After the vehicle arrives, choose Cash or UPI and submit the final amount.";
  const text = [
    `Service completed for ${vehicleName}.`,
    `Booking: ${bookingCode}`,
    `Garage: ${garageName}`,
    actionText,
    nextStep,
    `Open booking: ${trackingUrl}`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6;max-width:620px;margin:auto">
      <h2 style="margin-bottom:8px">Service completed</h2>
      <p>The selected services for <strong>${escapeHtml(vehicleName)}</strong> are complete.</p>
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Booking:</strong> ${escapeHtml(bookingCode)}</p>
        <p style="margin:0"><strong>Garage:</strong> ${escapeHtml(garageName)}</p>
      </div>
      <p><strong>${escapeHtml(actionText)}</strong></p>
      <p>${escapeHtml(nextStep)}</p>
      <p style="margin-top:24px">
        <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open live booking</a>
      </p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject,
    html,
    text,
    tags: [{ name: "type", value: "service_completed" }],
  });

  if (error) {
    throw new ApiError(
      502,
      error.message || "Unable to send service-completed email",
    );
  }

  return { sent: true, emailId: data?.id || null };
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

const createHandoverOtp = (generatedAt = new Date()) => {
  const otp = String(crypto.randomInt(100000, 1000000));
  const normalizedGeneratedAt = new Date(generatedAt);

  if (Number.isNaN(normalizedGeneratedAt.getTime())) {
    throw new TypeError("generatedAt must be a valid date");
  }

  return {
    otp,
    otpHash: getOtpHash(otp),
    generatedAt: normalizedGeneratedAt,
    expiresAt: new Date(normalizedGeneratedAt.getTime() + HANDOVER_OTP_TTL_MS),
  };
};

const validateInspectionImages = (files) => {
  if (
    !Array.isArray(files) ||
    files.length < MIN_INSPECTION_PHOTO_COUNT ||
    files.length > MAX_INSPECTION_PHOTO_COUNT
  ) {
    throw new ApiError(
      400,
      `Upload between ${MIN_INSPECTION_PHOTO_COUNT} and ${MAX_INSPECTION_PHOTO_COUNT} car inspection photos`,
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

const validateInspectionVideo = (video) => {
  if (!video || REQUIRED_INSPECTION_VIDEO_COUNT !== 1) {
    throw new ApiError(400, "Exactly one car inspection video is required");
  }

  if (!video.mimetype?.startsWith("video/")) {
    throw new ApiError(400, "Only a video file is allowed for car inspection video");
  }

  if (video.size > MAX_INSPECTION_VIDEO_SIZE_BYTES) {
    throw new ApiError(400, "The car inspection video must be 50 MB or less");
  }
};

const getUploadSource = (file) => file?.path || file?.buffer;

const cleanupUploadedInspectionMedia = async ({ images = [], video = null } = {}) => {
  const assets = [
    ...images.map((image) => ({ publicId: image.public_id, resourceType: "image" })),
    ...(video ? [{ publicId: video.public_id, resourceType: "video" }] : []),
  ].filter((asset) => asset.publicId);

  if (assets.length === 0) return;

  const results = await Promise.allSettled(
    assets.map((asset) =>
      deleteFromCloudinary(asset.publicId, asset.resourceType),
    ),
  );

  const failedCleanup = results.filter((result) => result.status === "rejected");

  if (failedCleanup.length > 0) {
    console.error(
      `[inspection-upload] unable to cleanup ${failedCleanup.length} uploaded media file(s)`,
    );
  }
};

const getExistingInspectionMedia = async ({ bookingId, phase }) => {
  const records = await prisma.bookingInspectionImage.findMany({
    where: { bookingId, phase },
    orderBy: [{ mediaType: "asc" }, { order: "asc" }],
  });

  return {
    records,
    images: records.filter((item) => item.mediaType !== "VIDEO"),
    videos: records.filter((item) => item.mediaType === "VIDEO"),
  };
};

const isCompleteInspectionMedia = ({ images, videos }) =>
  images.length >= MIN_INSPECTION_PHOTO_COUNT &&
  images.length <= MAX_INSPECTION_PHOTO_COUNT &&
  videos.length === REQUIRED_INSPECTION_VIDEO_COUNT;

const uploadInspectionMedia = async ({
  bookingId,
  garageId,
  phase,
  images,
  video,
}) => {
  validateInspectionImages(images);
  validateInspectionVideo(video);

  const existingMedia = await getExistingInspectionMedia({ bookingId, phase });

  if (existingMedia.records.length > 0) {
    if (isCompleteInspectionMedia(existingMedia)) {
      return existingMedia.records;
    }

    throw new ApiError(
      400,
      `Existing ${phase.toLowerCase()} inspection media is incomplete`,
    );
  }

  const uploadedImages = [];
  let uploadedVideo = null;

  try {
    for (const file of images) {
      const uploaded = await uploadToCloudinary(
        getUploadSource(file),
        INSPECTION_IMAGE_FOLDER,
        "image",
      );
      uploadedImages.push(uploaded);
    }

    uploadedVideo = await uploadToCloudinary(
      getUploadSource(video),
      INSPECTION_VIDEO_FOLDER,
      "video",
      {
        eager: [INSPECTION_VIDEO_EAGER_TRANSFORMATION],
        eager_async: false,
      },
    );

    await prisma.$transaction([
      prisma.bookingInspectionImage.createMany({
        data: uploadedImages.map((image, index) => ({
          bookingId,
          garageId,
          phase,
          mediaType: "IMAGE",
          imageUrl: image.secure_url,
          publicId: image.public_id,
          order: index,
        })),
      }),
      prisma.bookingInspectionImage.create({
        data: {
          bookingId,
          garageId,
          phase,
          mediaType: "VIDEO",
          imageUrl:
            uploadedVideo.eager?.[0]?.secure_url || uploadedVideo.secure_url,
          publicId: uploadedVideo.public_id,
          order: 0,
        },
      }),
    ]);
  } catch (error) {
    await cleanupUploadedInspectionMedia({
      images: uploadedImages,
      video: uploadedVideo,
    });

    const existingMediaAfterRace = await getExistingInspectionMedia({
      bookingId,
      phase,
    });

    if (isCompleteInspectionMedia(existingMediaAfterRace)) {
      return existingMediaAfterRace.records;
    }

    throw error;
  }

  return (
    await getExistingInspectionMedia({ bookingId, phase })
  ).records;
};

const bookingDetailInclude = {
  user: true,
  vehicle: true,
  garage: true,
  services: { include: { service: true } },
  payment: true,
  inspectionImages: {
    orderBy: [{ phase: "asc" }, { mediaType: "asc" }, { order: "asc" }],
  },
};

/**
 * Closes only the current two-minute-thirty-second search round.
 *
 * The booking deliberately stays SEARCHING_GARAGE and previously sent garage
 * offers remain available. The next customer tracking poll can expand the
 * radius without invalidating an older notification.
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

  const clearedRound = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BOOKING_STATUS.SEARCHING_GARAGE,
      garageId: null,
      searchExpiresAt: booking.searchExpiresAt || null,
    },
    data: {
      searchExpiresAt: null,
      expiredAt: null,
    },
  });

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (clearedRound.count > 0) {
    await invalidateBookingReadCaches(booking.userId, booking.id);
  }

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
  const isSelfDropOff =
    bookingUsesSelfDropOff(booking);
  const etaText = !isSelfDropOff && etaMinutes
    ? ` Estimated arrival: ${etaMinutes} min${
        distanceKm ? ` (${Number(distanceKm).toFixed(1)} km away)` : ""
      }.`
    : "";
  const instruction = isSelfDropOff
    ? ` Take your vehicle to ${garage.name}; pickup and return are not included for this booking.`
    : "";

  return notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: isSelfDropOff
      ? "Garage assigned for self drop-off"
      : "Garage accepted your request",
    message: isSelfDropOff
      ? `${garage.name} has accepted your service request.${instruction} Open the booking to start the one-time route to the garage.`
      : `${garage.name} has accepted your service request.${etaText} Your handover OTP has been sent to your registered email address.`,
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
  if (!otp || bookingUsesSelfDropOff(booking)) return null;

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

const notifyServiceCompleted = async ({ booking, garage }) => {
  const isSelfDropOff = bookingUsesSelfDropOff(booking);

  return notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: isSelfDropOff
      ? "Service complete — vehicle ready"
      : "Service complete — vehicle on the way",
    message: isSelfDropOff
      ? `${garage.name} completed the selected services and uploaded the post-service photos and video. Your vehicle is ready for collection.`
      : `${garage.name} completed the selected services and uploaded the post-service photos and video. Your vehicle is now on the way to your address.`,
    link: `/tracking?bookingId=${booking.id}`,
    metadata: {
      bookingId: booking.id,
      garageId: garage.id,
      action: isSelfDropOff ? "COLLECT_AND_PAY" : "TRACK_DELIVERY",
    },
  });
};

const notifyVehicleArrived = async ({ booking, garage }) =>
  notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: bookingUsesSelfDropOff(booking)
      ? "Vehicle ready for collection"
      : "Your vehicle has arrived",
    message: bookingUsesSelfDropOff(booking)
      ? `Inspect your vehicle at ${garage.name}, choose Cash or UPI, and submit the final amount.`
      : `The ${garage.name} delivery person has reached your address. Inspect the vehicle, choose Cash or UPI, and submit the final amount.`,
    link: `/tracking?bookingId=${booking.id}`,
    metadata: {
      bookingId: booking.id,
      garageId: garage.id,
      action: "SUBMIT_FINAL_PAYMENT",
    },
  });

const notifyFinalPaymentConfirmed = async ({ booking, garage }) =>
  notificationService.createNotification({
    userId: booking.userId,
    type: "PAYMENT",
    title: "Payment confirmed — booking completed",
    message: `${garage.name} confirmed your ${String(
      booking.finalPaymentMethod || "payment",
    ).toLowerCase()} payment of ₹${Number(
      booking.finalPaymentAmount || 0,
    ).toLocaleString("en-IN")}. Your warranty is now active.`,
    link: "/dashboard/history",
    metadata: {
      bookingId: booking.id,
      garageId: garage.id,
      finalPaymentMethod: booking.finalPaymentMethod,
      finalPaymentAmount: booking.finalPaymentAmount,
    },
  });

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

  if (bookingUsesSelfDropOff(booking)) {
    throw new ApiError(409, "Self drop-off bookings do not require a handover OTP");
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
    const previousGeneratedAt = new Date(
      booking.handoverOtpExpiresAt.getTime() - HANDOVER_OTP_TTL_MS,
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

  const handoverOtp = createHandoverOtp(new Date());

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

  await garageControllerService.releaseController(
    prisma,
    booking.garageControllerId,
  );

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
    generatedAt: handoverOtp.generatedAt,
    expiresAt: handoverOtp.expiresAt,
  };
};

const verifyBookingHandoverOtp = async ({
  garageId,
  requestId,
  otp,
  images,
  video,
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

  if (bookingUsesSelfDropOff(request.booking)) {
    throw new ApiError(409, "Self drop-off bookings use arrival evidence and do not require an OTP");
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
    await uploadInspectionMedia({
      bookingId: request.bookingId,
      garageId,
      phase: "PICKUP",
      images,
      video,
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
        arrivedAtGarageAt: bookingUsesSelfDropOff(request.booking) ? verifiedAt : null,
        trackingStartedAt: bookingUsesSelfDropOff(request.booking)
          ? request.booking.trackingStartedAt
          : verifiedAt,
        trackingEndedAt: bookingUsesSelfDropOff(request.booking) ? verifiedAt : null,
        routeDistanceMeters: null,
        routeDurationSeconds: null,
        routePolyline: null,
        routeUpdatedAt: null,
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

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const getDistanceMeters = (origin, destination) => {
  const lat1 = Number(origin?.latitude);
  const lon1 = Number(origin?.longitude);
  const lat2 = Number(destination?.latitude);
  const lon2 = Number(destination?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return Math.round(
    earthRadiusMeters *
      2 *
      Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)),
  );
};

const loadAcceptedLifecycleRequest = async ({ garageId, requestId }) => {
  const request = await prisma.garageBroadcastRequest.findFirst({
    where: {
      id: requestId,
      garageId,
      status: BROADCAST_STATUS.ACCEPTED,
    },
    include: {
      booking: {
        include: {
          user: true,
          vehicle: true,
          garage: true,
          payment: true,
          services: { include: { service: true } },
          inspectionImages: {
            orderBy: [
              { phase: "asc" },
              { mediaType: "asc" },
              { order: "asc" },
            ],
          },
        },
      },
      garage: true,
    },
  });

  if (!request) {
    throw new ApiError(404, "Accepted garage request not found");
  }

  return request;
};

const assertGarageLocationNear = ({
  booking,
  destination,
  maximumDistanceMeters,
  message,
}) => {
  const distanceMeters = getDistanceMeters(
    {
      latitude: booking.lastGarageLatitude,
      longitude: booking.lastGarageLongitude,
    },
    destination,
  );

  if (!Number.isFinite(distanceMeters)) {
    throw new ApiError(
      409,
      "A recent live location is required. Start live tracking and try again.",
    );
  }

  if (distanceMeters > maximumDistanceMeters) {
    throw new ApiError(
      409,
      `${message} Current distance is approximately ${distanceMeters} metres.`,
    );
  }

  return distanceMeters;
};

const confirmSelfDropArrivalByGarage = async ({
  garageId,
  requestId,
  images,
  video,
}) => {
  const request = await loadAcceptedLifecycleRequest({ garageId, requestId });
  const booking = request.booking;

  if (!bookingUsesSelfDropOff(booking)) {
    throw new ApiError(409, "This arrival action is only for self drop-off bookings");
  }
  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    if (booking.arrivedAtGarageAt && booking.status === BOOKING_STATUS.IN_PROGRESS) {
      return { request, booking };
    }
    throw new ApiError(409, "The self drop-off booking is not waiting for garage arrival");
  }

  const latestCustomerPoint = await prisma.bookingTrackingPoint.findFirst({
    where: {
      bookingId: booking.id,
      source: "CUSTOMER",
      journeyPhase: "SELF_DROP_TO_GARAGE",
    },
    orderBy: { recordedAt: "desc" },
  });

  const distanceMeters = getDistanceMeters(
    latestCustomerPoint
      ? {
          latitude: latestCustomerPoint.latitude,
          longitude: latestCustomerPoint.longitude,
        }
      : null,
    {
      latitude: request.garage.latitude,
      longitude: request.garage.longitude,
    },
  );

  if (!Number.isFinite(distanceMeters)) {
    throw new ApiError(
      409,
      "Ask the customer to start the self drop-off route and share a recent location before confirming arrival",
    );
  }
  if (distanceMeters > GARAGE_ARRIVAL_DISTANCE_METERS) {
    throw new ApiError(
      409,
      `The customer must reach the garage before arrival can be confirmed. Current distance is approximately ${distanceMeters} metres.`,
    );
  }

  await uploadInspectionMedia({
    bookingId: booking.id,
    garageId,
    phase: "PICKUP",
    images,
    video,
  });

  const arrivedAtGarageAt = new Date();
  const claimed = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      garageId,
      status: BOOKING_STATUS.CONFIRMED,
      arrivedAtGarageAt: null,
    },
    data: {
      status: BOOKING_STATUS.IN_PROGRESS,
      arrivedAtGarageAt,
      trackingEndedAt: arrivedAtGarageAt,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      routePolyline: null,
      routeUpdatedAt: null,
      handoverOtpHash: null,
      handoverOtpExpiresAt: null,
      handoverOtpClaimedAt: null,
      handoverOtpAttempts: 0,
    },
  });

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: bookingDetailInclude,
  });

  if (claimed.count !== 1) {
    if (updatedBooking?.arrivedAtGarageAt) return { request, booking: updatedBooking };
    throw new ApiError(409, "The booking changed before self drop-off arrival was saved");
  }

  await activityService.createActivitySafely(
    updatedBooking.userId,
    {
      type: "VEHICLE_REACHED_GARAGE",
      title: "Vehicle dropped off at the garage",
      detail: `Booking ${updatedBooking.bookingCode || updatedBooking.id} reached ${request.garage.name}. The arrival journey timer stopped and service started.`,
      path: `/tracking?bookingId=${updatedBooking.id}`,
      metadata: {
        bookingId: updatedBooking.id,
        garageId,
        distanceMeters,
        arrivedAtGarageAt,
      },
    },
    { eventKey: `booking:${updatedBooking.id}:self-drop-arrived` },
  );

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);
  return { request, booking: updatedBooking };
};

const markBookingArrivedAtGarageByGarage = async ({ garageId, requestId }) => {
  const request = await loadAcceptedLifecycleRequest({ garageId, requestId });
  const booking = request.booking;

  if (bookingUsesSelfDropOff(booking)) {
    throw new ApiError(409, "Self-drop bookings are already at the garage");
  }
  if (!booking.handoverOtpVerifiedAt || booking.status !== BOOKING_STATUS.IN_PROGRESS) {
    throw new ApiError(409, "Verify the customer handover before reaching the garage");
  }
  if (booking.arrivedAtGarageAt) {
    return { request, booking };
  }

  const distanceMeters = assertGarageLocationNear({
    booking,
    destination: {
      latitude: request.garage.latitude,
      longitude: request.garage.longitude,
    },
    maximumDistanceMeters: GARAGE_ARRIVAL_DISTANCE_METERS,
    message: "Reach the assigned garage before ending the pickup return journey.",
  });
  const arrivedAtGarageAt = new Date();
  const claimed = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      garageId,
      status: BOOKING_STATUS.IN_PROGRESS,
      arrivedAtGarageAt: null,
    },
    data: {
      arrivedAtGarageAt,
      trackingEndedAt: arrivedAtGarageAt,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      routePolyline: null,
      routeUpdatedAt: null,
    },
  });

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: bookingDetailInclude,
  });

  if (claimed.count !== 1) {
    if (updatedBooking?.arrivedAtGarageAt) {
      return { request, booking: updatedBooking };
    }
    throw new ApiError(409, "The booking changed before garage arrival was saved");
  }

  await activityService.createActivitySafely(
    updatedBooking.userId,
    {
      type: "VEHICLE_REACHED_GARAGE",
      title: "Vehicle reached the garage",
      detail: `Booking ${updatedBooking.bookingCode || updatedBooking.id} reached ${request.garage.name}.`,
      path: `/tracking?bookingId=${updatedBooking.id}`,
      metadata: {
        bookingId: updatedBooking.id,
        garageId,
        distanceMeters,
      },
    },
    { eventKey: `booking:${updatedBooking.id}:arrived-at-garage` },
  );

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);
  return { request, booking: updatedBooking };
};

const markBookingServiceCompletedByGarage = async ({
  garageId,
  requestId,
  images,
  video,
}) => {
  const request = await loadAcceptedLifecycleRequest({ garageId, requestId });
  const booking = request.booking;
  const selfDropOff = bookingUsesSelfDropOff(booking);

  if (selfDropOff ? !booking.arrivedAtGarageAt : !booking.handoverOtpVerifiedAt) {
    throw new ApiError(
      400,
      selfDropOff
        ? "Confirm customer arrival and upload pre-service evidence before completing service"
        : "Verify customer handover OTP before completing service",
    );
  }
  if (booking.status !== BOOKING_STATUS.IN_PROGRESS) {
    throw new ApiError(409, "This booking is not in the service stage");
  }
  if (!selfDropOff && !booking.arrivedAtGarageAt) {
    throw new ApiError(
      409,
      "Mark the vehicle as arrived at the garage before completing service",
    );
  }
  if (booking.serviceCompletedAt) {
    throw new ApiError(409, "Service completion evidence is already uploaded");
  }

  await uploadInspectionMedia({
    bookingId: booking.id,
    garageId,
    phase: "DELIVERY",
    images,
    video,
  });

  const serviceCompletedAt = new Date();
  const claimed = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      garageId,
      status: BOOKING_STATUS.IN_PROGRESS,
      serviceCompletedAt: null,
    },
    data: {
      serviceCompletedAt,
      deliveryStartedAt: selfDropOff ? null : serviceCompletedAt,
      deliveredAt: selfDropOff ? serviceCompletedAt : null,
      trackingStartedAt: selfDropOff
        ? booking.trackingStartedAt
        : serviceCompletedAt,
      trackingEndedAt: selfDropOff ? serviceCompletedAt : null,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      routePolyline: null,
      routeUpdatedAt: null,
    },
  });

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: bookingDetailInclude,
  });

  if (claimed.count !== 1) {
    if (updatedBooking?.serviceCompletedAt) {
      return { request, booking: updatedBooking };
    }
    throw new ApiError(409, "The booking changed before service completion was saved");
  }

  await Promise.allSettled([
    notifyServiceCompleted({ booking: updatedBooking, garage: request.garage }),
    sendCustomerServiceCompletedWhatsapp({
      customer: request.booking.user,
      garage: request.garage,
      booking: updatedBooking,
    }),
    sendCustomerServiceCompletedEmail({
      customer: request.booking.user,
      garage: request.garage,
      booking: updatedBooking,
    }),
    selfDropOff
      ? notifyVehicleArrived({ booking: updatedBooking, garage: request.garage })
      : Promise.resolve(null),
  ]);

  await activityService.createActivitySafely(
    updatedBooking.userId,
    {
      type: "SERVICE_COMPLETED",
      title: selfDropOff
        ? "Service completed — ready for collection"
        : "Service completed — return delivery started",
      detail: selfDropOff
        ? `Booking ${updatedBooking.bookingCode || updatedBooking.id} is ready at ${request.garage.name}.`
        : `Booking ${updatedBooking.bookingCode || updatedBooking.id} left ${request.garage.name} for customer delivery.`,
      path: `/tracking?bookingId=${updatedBooking.id}`,
      metadata: {
        bookingId: updatedBooking.id,
        bookingCode: updatedBooking.bookingCode,
        garageId,
        serviceCompletedAt,
      },
    },
    { eventKey: `booking:${updatedBooking.id}:service-completed` },
  );

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);
  return { request, booking: updatedBooking };
};

const markBookingArrivedAtCustomerByGarage = async ({
  garageId,
  requestId,
}) => {
  const request = await loadAcceptedLifecycleRequest({ garageId, requestId });
  const booking = request.booking;

  if (bookingUsesSelfDropOff(booking)) {
    throw new ApiError(409, "Self-drop bookings are collected at the garage");
  }
  if (!booking.serviceCompletedAt || booking.status !== BOOKING_STATUS.IN_PROGRESS) {
    throw new ApiError(409, "Complete the service before confirming delivery arrival");
  }
  if (booking.deliveredAt) return { request, booking };

  const distanceMeters = assertGarageLocationNear({
    booking,
    destination: {
      latitude: booking.customerLatitude,
      longitude: booking.customerLongitude,
    },
    maximumDistanceMeters: CUSTOMER_DELIVERY_ARRIVAL_DISTANCE_METERS,
    message: "Reach the customer address before confirming arrival.",
  });
  const deliveredAt = new Date();
  const claimed = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      garageId,
      status: BOOKING_STATUS.IN_PROGRESS,
      deliveredAt: null,
    },
    data: {
      deliveredAt,
      trackingEndedAt: deliveredAt,
    },
  });

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: bookingDetailInclude,
  });

  if (claimed.count !== 1) {
    if (updatedBooking?.deliveredAt) {
      return { request, booking: updatedBooking };
    }
    throw new ApiError(409, "The booking changed before delivery arrival was saved");
  }

  await Promise.allSettled([
    notifyVehicleArrived({ booking: updatedBooking, garage: request.garage }),
    activityService.createActivitySafely(
      updatedBooking.userId,
      {
        type: "VEHICLE_ARRIVED",
        title: "Vehicle arrived at your address",
        detail: `The ${request.garage.name} delivery person reached your booking address.`,
        path: `/tracking?bookingId=${updatedBooking.id}`,
        metadata: {
          bookingId: updatedBooking.id,
          garageId,
          distanceMeters,
        },
      },
      { eventKey: `booking:${updatedBooking.id}:arrived-at-customer` },
    ),
  ]);

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);
  return { request, booking: updatedBooking };
};

const submitFinalPaymentByCustomer = async ({
  userId,
  bookingId,
  finalAmount,
  paymentMethod,
}) => {
  const parsedFinalAmount = Math.round(Number(finalAmount));
  const normalizedPaymentMethod = String(paymentMethod || "").trim().toUpperCase();

  if (!Number.isFinite(parsedFinalAmount) || parsedFinalAmount <= 0) {
    throw new ApiError(400, "Final service amount is required");
  }
  if (!new Set(["CASH", "UPI"]).has(normalizedPaymentMethod)) {
    throw new ApiError(400, "Choose Cash or UPI as the final payment mode");
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { garage: true, payment: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (!booking.deliveredAt) {
    throw new ApiError(
      409,
      bookingUsesSelfDropOff(booking)
        ? "The garage has not marked the vehicle ready for collection"
        : "The delivery person has not confirmed arrival at your address",
    );
  }
  if (booking.status === BOOKING_STATUS.COMPLETED || booking.finalPaymentConfirmedAt) {
    throw new ApiError(409, "This booking is already completed");
  }
  if (booking.finalPaymentSubmittedAt) {
    throw new ApiError(
      409,
      "Final payment is already pending garage confirmation",
    );
  }

  const submittedAt = new Date();
  const claimed = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      userId,
      status: BOOKING_STATUS.IN_PROGRESS,
      finalPaymentSubmittedAt: null,
      finalPaymentConfirmedAt: null,
    },
    data: {
      finalPaymentMethod: normalizedPaymentMethod,
      finalPaymentAmount: parsedFinalAmount,
      finalPaymentSubmittedAt: submittedAt,
      totalServiceAmount: parsedFinalAmount,
      totalServiceMaxAmount: parsedFinalAmount,
    },
  });

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingDetailInclude,
  });

  if (claimed.count !== 1) {
    if (updatedBooking?.finalPaymentSubmittedAt) {
      throw new ApiError(
        409,
        "Final payment is already pending garage confirmation",
      );
    }
    throw new ApiError(409, "The booking changed before payment was submitted");
  }

  await activityService.createActivitySafely(
    updatedBooking.userId,
    {
      type: "FINAL_PAYMENT_SUBMITTED",
      title: "Payment sent for garage confirmation",
      detail: `You submitted ${normalizedPaymentMethod} payment of ₹${parsedFinalAmount.toLocaleString("en-IN")} for booking ${updatedBooking.bookingCode || updatedBooking.id}.`,
      path: `/tracking?bookingId=${updatedBooking.id}`,
      metadata: {
        bookingId: updatedBooking.id,
        garageId: updatedBooking.garageId,
        paymentMethod: normalizedPaymentMethod,
        finalAmount: parsedFinalAmount,
      },
    },
    { eventKey: `booking:${updatedBooking.id}:final-payment-submitted` },
  );

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);
  return updatedBooking;
};

const confirmFinalPaymentByGarage = async ({ garageId, requestId }) => {
  const request = await loadAcceptedLifecycleRequest({ garageId, requestId });
  const booking = request.booking;

  if (!booking.finalPaymentSubmittedAt || !booking.finalPaymentAmount) {
    throw new ApiError(409, "The customer has not submitted the final payment yet");
  }
  if (booking.status === BOOKING_STATUS.COMPLETED || booking.finalPaymentConfirmedAt) {
    return booking;
  }

  const confirmedAt = new Date();
  const updatedBooking = await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: {
        id: booking.id,
        garageId,
        status: BOOKING_STATUS.IN_PROGRESS,
        finalPaymentSubmittedAt: { not: null },
        finalPaymentConfirmedAt: null,
      },
      data: {
        status: BOOKING_STATUS.COMPLETED,
        finalPaymentConfirmedAt: confirmedAt,
        customerAcceptedAt: confirmedAt,
        totalServiceAmount: booking.finalPaymentAmount,
        totalServiceMaxAmount: booking.finalPaymentAmount,
        trackingEndedAt: confirmedAt,
      },
    });

    if (claimed.count !== 1) {
      throw new ApiError(
        409,
        "The payment or booking state changed. Refresh and try again.",
      );
    }

    await tx.garageWorkerTask.updateMany({
      where: {
        bookingId: booking.id,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      data: { status: "COMPLETED", completedAt: confirmedAt },
    });

    await garageControllerService.releaseController(
      tx,
      booking.garageControllerId,
    );

    return tx.booking.findUnique({
      where: { id: booking.id },
      include: bookingDetailInclude,
    });
  });

  await Promise.allSettled([
    notifyFinalPaymentConfirmed({ booking: updatedBooking, garage: request.garage }),
    activityService.createActivitySafely(
      updatedBooking.userId,
      {
        type: "BOOKING_COMPLETED",
        title: "Service completed and payment confirmed",
        detail: `Booking ${updatedBooking.bookingCode || updatedBooking.id} was completed after ${String(updatedBooking.finalPaymentMethod).toLowerCase()} payment confirmation.`,
        path: "/dashboard/history",
        metadata: {
          bookingId: updatedBooking.id,
          bookingCode: updatedBooking.bookingCode,
          finalAmount: updatedBooking.finalPaymentAmount,
          paymentMethod: updatedBooking.finalPaymentMethod,
        },
      },
      { eventKey: `booking:${updatedBooking.id}:completed` },
    ),
  ]);

  await invalidateBookingReadCaches(updatedBooking.userId, updatedBooking.id);
  return updatedBooking;
};

// Compatibility wrappers retained for existing imports during deployment.
const markBookingDeliveredByGarage = markBookingServiceCompletedByGarage;
const acceptDeliveredBookingByCustomer = submitFinalPaymentByCustomer;

module.exports = {
  acceptDeliveredBookingByCustomer,
  confirmFinalPaymentByGarage,
  confirmSelfDropArrivalByGarage,
  createHandoverOtp,
  expireBookingSearch,
  expireStaleGarageSearchesForUser,
  getGarageSearchTimeoutMs,
  getSearchExpiresAt,
  markBookingArrivedAtCustomerByGarage,
  markBookingArrivedAtGarageByGarage,
  markBookingDeliveredByGarage,
  markBookingServiceCompletedByGarage,
  notifyGarageAccepted,
  notifyVehicleHandoverOtp,
  regenerateBookingHandoverOtp,
  sendCustomerHandoverOtpEmail,
  sendCustomerServiceCompletedEmail,
  submitFinalPaymentByCustomer,
  verifyBookingHandoverOtp,
};
