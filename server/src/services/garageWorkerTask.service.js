const crypto = require("crypto");

const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { normalizePhone } = require("../utils/phone");
const { bookingUsesSelfDropOff } = require("../constants/serviceFulfillmentType");
const bookingTrackingService = require("../maps/services/bookingTracking.service");
const bookingLifecycleService = require("./bookingLifecycle.service");
const { sendGarageWorkerTaskWhatsapp } = require("./garageWhatsapp.service");

const ACTIVE_TASK_STATUSES = ["ACTIVE", "IN_PROGRESS"];
const TASK_TYPES = new Set(["HANDOVER", "DELIVERY"]);
const DEFAULT_TASK_TTL_HOURS = Math.max(1, Number(process.env.WORKER_TASK_TTL_HOURS || 12));
const MAX_TASK_TTL_HOURS = 48;

const taskInclude = {
  garage: {
    select: {
      id: true,
      ownerId: true,
      name: true,
      phone: true,
      whatsappNo: true,
      address: true,
      city: true,
      area: true,
      latitude: true,
      longitude: true,
      controllerAccountsEnabled: true,
    },
  },
  booking: {
    include: {
      user: { select: { id: true, name: true, phone: true } },
      vehicle: true,
      services: {
        include: {
          service: { select: { id: true, name: true } },
        },
      },
      inspectionImages: {
        orderBy: [{ phase: "asc" }, { mediaType: "asc" }, { order: "asc" }],
      },
    },
  },
  request: { select: { id: true, status: true } },
};

const createRawToken = () => crypto.randomBytes(32).toString("base64url");
const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

const getFrontendBaseUrl = () =>
  String(
    process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "https://www.rovauto.com",
  ).replace(/\/+$/, "");

const getTaskUrl = (rawToken) =>
  `${getFrontendBaseUrl()}/worker-task/${encodeURIComponent(rawToken)}`;

const normalizeTaskType = (value) => {
  const taskType = String(value || "").trim().toUpperCase();
  if (!TASK_TYPES.has(taskType)) {
    throw new ApiError(400, "Worker task type must be HANDOVER or DELIVERY");
  }
  return taskType;
};

const normalizeWorkerName = (value) => {
  const workerName = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (workerName.length < 2) {
    throw new ApiError(400, "Worker name is required");
  }
  return workerName;
};

const normalizeTaskTtlHours = (value) => {
  const number = Number(value || DEFAULT_TASK_TTL_HOURS);
  if (!Number.isFinite(number)) return DEFAULT_TASK_TTL_HOURS;
  return Math.min(MAX_TASK_TTL_HOURS, Math.max(1, Math.round(number)));
};

const getAcceptedRequest = (booking) =>
  (booking.broadcasts || []).find(
    (request) =>
      request.garageId === booking.garageId && request.status === "ACCEPTED",
  ) || null;

const loadManagedBooking = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      garage: true,
      vehicle: true,
      user: { select: { id: true, name: true, phone: true } },
      services: { include: { service: true } },
      broadcasts: {
        where: { status: "ACCEPTED" },
        orderBy: { acceptedAt: "desc" },
      },
    },
  });

  if (!booking) throw new ApiError(404, "Booking not found");
  if (!booking.garageId || !booking.garage) {
    throw new ApiError(409, "Assign a garage before creating a worker task");
  }
  return booking;
};

const assertActorCanManage = (actor, booking) => {
  const isStaff =
    actor?.accountType === "STAFF" &&
    ["ADMIN", "SUB_ADMIN"].includes(actor?.role);
  const isGarageOwner =
    actor?.accountType === "USER" &&
    actor?.role === "GARAGE_OWNER" &&
    booking.garage?.ownerId === actor.id;

  if (!isStaff && !isGarageOwner) {
    throw new ApiError(
      403,
      "Only an admin or the assigned garage owner can manage worker task links",
    );
  }
};

const assertTaskLinkMode = (garage) => {
  if (garage?.controllerAccountsEnabled !== false) {
    throw new ApiError(
      409,
      "Disable controller accounts for this garage before using WhatsApp worker task links",
    );
  }
};

const assertTaskStage = (booking, taskType) => {
  if (taskType === "HANDOVER") {
    if (booking.status !== "CONFIRMED" || booking.handoverOtpVerifiedAt) {
      throw new ApiError(
        409,
        "A handover task can be assigned only after garage acceptance and before handover verification",
      );
    }
    return;
  }

  if (
    booking.status !== "IN_PROGRESS" ||
    !booking.handoverOtpVerifiedAt ||
    booking.deliveredAt
  ) {
    throw new ApiError(
      409,
      "A delivery task can be assigned only after service starts and before delivery is marked",
    );
  }
};

const taskStatusForBooking = (task) => {
  if (task.status === "REVOKED") return "REVOKED";
  if (task.expiresAt <= new Date() && ACTIVE_TASK_STATUSES.includes(task.status)) {
    return "EXPIRED";
  }

  if (
    task.taskType === "HANDOVER" &&
    task.booking?.handoverOtpVerifiedAt &&
    bookingUsesSelfDropOff(task.booking)
  ) {
    return "COMPLETED";
  }
  if (task.taskType === "DELIVERY" && task.booking?.deliveredAt) {
    return "COMPLETED";
  }
  return task.status;
};

const syncTaskStatus = async (task) => {
  const nextStatus = taskStatusForBooking(task);
  if (nextStatus === task.status) return task;

  const now = new Date();
  return prisma.garageWorkerTask.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      ...(nextStatus === "COMPLETED" && { completedAt: task.completedAt || now }),
      ...(nextStatus === "EXPIRED" && { revokedAt: task.revokedAt || now }),
    },
    include: taskInclude,
  });
};

const toPublicTask = (task) => {
  const booking = task.booking || {};
  const isSelfDropOff = bookingUsesSelfDropOff(booking);
  const returningToGarage =
    task.taskType === "HANDOVER" &&
    !isSelfDropOff &&
    Boolean(booking.handoverOtpVerifiedAt);
  const useGarageDestination = isSelfDropOff || returningToGarage;
  const activeDestination = useGarageDestination
    ? {
        type: "GARAGE",
        label: task.garage?.name || "Assigned garage",
        address: task.garage?.address || null,
        latitude: task.garage?.latitude ?? null,
        longitude: task.garage?.longitude ?? null,
      }
    : {
        type: "CUSTOMER",
        label: booking.customerAddress || "Customer location",
        address: booking.customerAddress || null,
        latitude: booking.customerLatitude ?? null,
        longitude: booking.customerLongitude ?? null,
      };
  const destination =
    task.status === "COMPLETED"
      ? { type: activeDestination.type, label: "Task completed", address: null, latitude: null, longitude: null }
      : activeDestination;

  return {
    id: task.id,
    taskType: task.taskType,
    status: task.status,
    workerName: task.workerName,
    expiresAt: task.expiresAt,
    openedAt: task.openedAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    lastLocationAt: task.lastLocationAt,
    isSelfDropOff,
    stage:
      task.taskType === "DELIVERY"
        ? isSelfDropOff
          ? "READY_FOR_SELF_PICKUP"
          : "DELIVER_TO_CUSTOMER"
        : isSelfDropOff
          ? "HANDOVER_AT_GARAGE"
          : returningToGarage
            ? "RETURN_TO_GARAGE"
            : "PICKUP_FROM_CUSTOMER",
    canTrack:
      !isSelfDropOff &&
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      ["CONFIRMED", "IN_PROGRESS"].includes(booking.status),
    canCompleteReturnJourney:
      returningToGarage && ACTIVE_TASK_STATUSES.includes(task.status),
    mediaRequirements: {
      minimumImages: 5,
      maximumImages: 15,
      imageMaxMb: 1,
      requiredVideos: 1,
      videoMaxMb: 50,
    },
    destination,
    garage: task.garage,
    booking: {
      id: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      fulfillmentType: booking.fulfillmentType,
      handoverOtpExpiresAt: booking.handoverOtpExpiresAt,
      handoverOtpVerifiedAt: booking.handoverOtpVerifiedAt,
      deliveredAt: booking.deliveredAt,
      vehicle: booking.vehicle,
      customer: booking.user
        ? {
            name: booking.user.name,
            phone: null,
          }
        : null,
      services: (booking.services || []).map((item) => ({
        id: item.serviceId || item.service?.id,
        name: item.service?.name || "Service",
      })),
      inspectionImages: booking.inspectionImages || [],
    },
  };
};

const toManagerTask = (task) => ({
  id: task.id,
  bookingId: task.bookingId,
  requestId: task.requestId,
  taskType: task.taskType,
  status: task.status,
  workerName: task.workerName,
  workerPhone: task.workerPhone,
  expiresAt: task.expiresAt,
  openedAt: task.openedAt,
  startedAt: task.startedAt,
  completedAt: task.completedAt,
  revokedAt: task.revokedAt,
  lastLocationAt: task.lastLocationAt,
  createdAt: task.createdAt,
  createdByName: task.createdByName,
});

const sendTaskLink = async ({ task, rawToken }) => {
  const taskUrl = getTaskUrl(rawToken);
  const delivery = await sendGarageWorkerTaskWhatsapp({ task, taskUrl, rawToken });
  return { taskUrl, delivery };
};

const createTask = async ({ actor, bookingId, input = {} }) => {
  const booking = await loadManagedBooking(bookingId);
  assertActorCanManage(actor, booking);
  assertTaskLinkMode(booking.garage);

  const taskType = normalizeTaskType(input.taskType);
  assertTaskStage(booking, taskType);

  const request = getAcceptedRequest(booking);
  if (!request) {
    throw new ApiError(409, "Accepted garage request not found for this booking");
  }

  const workerName = normalizeWorkerName(input.workerName);
  const workerPhone = normalizePhone(input.workerPhone);
  const ttlHours = normalizeTaskTtlHours(input.expiresInHours);
  const rawToken = createRawToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  const task = await prisma.$transaction(async (tx) => {
    await tx.garageWorkerTask.updateMany({
      where: {
        bookingId: booking.id,
        taskType,
        status: { in: ACTIVE_TASK_STATUSES },
      },
      data: { status: "REVOKED", revokedAt: now },
    });

    return tx.garageWorkerTask.create({
      data: {
        garageId: booking.garageId,
        bookingId: booking.id,
        requestId: request.id,
        taskType,
        workerName,
        workerPhone,
        tokenHash: hashToken(rawToken),
        expiresAt,
        createdByType: actor.accountType || "UNKNOWN",
        createdById: actor.id,
        createdByName: actor.name || actor.loginId || actor.email || null,
      },
      include: taskInclude,
    });
  });

  const sent = await sendTaskLink({ task, rawToken });
  return { task: toManagerTask(task), ...sent };
};

const listTasks = async ({ actor, bookingId }) => {
  const booking = await loadManagedBooking(bookingId);
  assertActorCanManage(actor, booking);

  const tasks = await prisma.garageWorkerTask.findMany({
    where: { bookingId, garageId: booking.garageId },
    include: taskInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const synced = await Promise.all(tasks.map(syncTaskStatus));
  return {
    controllerAccountsEnabled: booking.garage.controllerAccountsEnabled,
    tasks: synced.map(toManagerTask),
  };
};

const loadManagedTask = async ({ actor, taskId }) => {
  const task = await prisma.garageWorkerTask.findUnique({
    where: { id: taskId },
    include: taskInclude,
  });
  if (!task) throw new ApiError(404, "Worker task not found");
  assertActorCanManage(actor, { garage: task.garage, garageId: task.garageId });
  assertTaskLinkMode(task.garage);
  return syncTaskStatus(task);
};

const resendTask = async ({ actor, taskId, expiresInHours }) => {
  const current = await loadManagedTask({ actor, taskId });
  if (["COMPLETED", "REVOKED"].includes(current.status)) {
    throw new ApiError(409, "Completed or revoked worker tasks cannot be resent");
  }

  const isActiveReturnJourney =
    current.taskType === "HANDOVER" &&
    !bookingUsesSelfDropOff(current.booking) &&
    current.booking?.status === "IN_PROGRESS" &&
    Boolean(current.booking?.handoverOtpVerifiedAt) &&
    !current.booking?.deliveredAt;
  if (!isActiveReturnJourney) {
    assertTaskStage(current.booking, current.taskType);
  }
  const rawToken = createRawToken();
  const ttlHours = normalizeTaskTtlHours(expiresInHours);
  const task = await prisma.garageWorkerTask.update({
    where: { id: current.id },
    data: {
      tokenHash: hashToken(rawToken),
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      revokedAt: null,
      openedAt: null,
      startedAt: null,
      completedAt: null,
    },
    include: taskInclude,
  });

  const sent = await sendTaskLink({ task, rawToken });
  return { task: toManagerTask(task), ...sent };
};

const revokeTask = async ({ actor, taskId }) => {
  const task = await loadManagedTask({ actor, taskId });
  if (task.status === "COMPLETED") {
    throw new ApiError(409, "Completed worker tasks cannot be revoked");
  }
  const revokedAt = new Date();
  const updated = await prisma.garageWorkerTask.update({
    where: { id: task.id },
    data: { status: "REVOKED", revokedAt },
    include: taskInclude,
  });

  if (task.booking?.trackingStartedAt && !task.booking?.trackingEndedAt) {
    await prisma.booking.updateMany({
      where: { id: task.bookingId, trackingEndedAt: null },
      data: { trackingEndedAt: revokedAt },
    });
  }
  return toManagerTask(updated);
};

const getTaskByToken = async (rawToken, { markOpened = false } = {}) => {
  const token = String(rawToken || "").trim();
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    throw new ApiError(404, "Worker task link is invalid");
  }

  let task = await prisma.garageWorkerTask.findUnique({
    where: { tokenHash: hashToken(token) },
    include: taskInclude,
  });
  if (!task) throw new ApiError(404, "Worker task link is invalid");

  task = await syncTaskStatus(task);
  if (task.status === "EXPIRED") {
    throw new ApiError(410, "This worker task link has expired");
  }
  if (task.status === "REVOKED") {
    throw new ApiError(410, "This worker task link was revoked");
  }
  if (task.garage?.controllerAccountsEnabled !== false) {
    throw new ApiError(410, "Worker task link mode is no longer active for this garage");
  }

  if (markOpened && !task.openedAt && ACTIVE_TASK_STATUSES.includes(task.status)) {
    task = await prisma.garageWorkerTask.update({
      where: { id: task.id },
      data: { openedAt: new Date() },
      include: taskInclude,
    });
  }
  return task;
};

const getPublicTask = async (rawToken) =>
  toPublicTask(await getTaskByToken(rawToken, { markOpened: true }));

const startTracking = async ({ rawToken }) => {
  const task = await getTaskByToken(rawToken, { markOpened: true });
  if (!toPublicTask(task).canTrack) {
    throw new ApiError(409, "Live tracking is not available for this task");
  }

  const tracking = await bookingTrackingService.startTracking({
    bookingId: task.bookingId,
    account: null,
    workerTask: task,
  });
  await prisma.garageWorkerTask.update({
    where: { id: task.id },
    data: { status: "IN_PROGRESS", startedAt: task.startedAt || new Date() },
  });
  return tracking;
};

const addTrackingPoint = async ({ rawToken, data }) => {
  const task = await getTaskByToken(rawToken, { markOpened: true });
  if (!toPublicTask(task).canTrack) {
    throw new ApiError(409, "Live tracking is not available for this task");
  }

  const tracking = await bookingTrackingService.addTrackingPoint({
    bookingId: task.bookingId,
    account: null,
    workerTask: task,
    data,
  });
  await prisma.garageWorkerTask.update({
    where: { id: task.id },
    data: {
      status: "IN_PROGRESS",
      startedAt: task.startedAt || new Date(),
      lastLocationAt: new Date(),
    },
  });
  return tracking;
};

const stopTracking = async ({ rawToken }) => {
  const task = await getTaskByToken(rawToken, { markOpened: true });
  return bookingTrackingService.stopTracking({
    bookingId: task.bookingId,
    account: null,
    workerTask: task,
  });
};

const completeTask = async (taskId) =>
  prisma.garageWorkerTask.update({
    where: { id: taskId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

const verifyHandover = async ({ rawToken, otp, images, video }) => {
  const task = await getTaskByToken(rawToken, { markOpened: true });
  if (task.taskType !== "HANDOVER") {
    throw new ApiError(409, "This link is not a vehicle handover task");
  }

  const result = await bookingLifecycleService.verifyBookingHandoverOtp({
    garageId: task.garageId,
    requestId: task.requestId,
    otp,
    images,
    video,
  });

  if (bookingUsesSelfDropOff(task.booking)) {
    await Promise.allSettled([
      completeTask(task.id),
      bookingTrackingService.stopTracking({
        bookingId: task.bookingId,
        account: null,
        workerTask: task,
      }),
    ]);
  } else {
    await prisma.garageWorkerTask.update({
      where: { id: task.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: task.startedAt || new Date(),
      },
    });
  }
  return result;
};

const completeHandoverJourney = async ({ rawToken }) => {
  const task = await getTaskByToken(rawToken, { markOpened: true });
  if (task.taskType !== "HANDOVER") {
    throw new ApiError(409, "This link is not a vehicle handover task");
  }
  if (bookingUsesSelfDropOff(task.booking)) {
    throw new ApiError(409, "Self-drop bookings do not use a return journey");
  }
  if (!task.booking?.handoverOtpVerifiedAt || task.booking?.status !== "IN_PROGRESS") {
    throw new ApiError(
      409,
      "Verify the customer handover OTP before completing the return journey",
    );
  }

  await bookingTrackingService.stopTracking({
    bookingId: task.bookingId,
    account: null,
    workerTask: task,
  });
  await completeTask(task.id);
  return getPublicTask(rawToken);
};

const markDelivered = async ({ rawToken, images, video }) => {
  const task = await getTaskByToken(rawToken, { markOpened: true });
  if (task.taskType !== "DELIVERY") {
    throw new ApiError(409, "This link is not a delivery task");
  }

  const result = await bookingLifecycleService.markBookingDeliveredByGarage({
    garageId: task.garageId,
    requestId: task.requestId,
    images,
    video,
  });

  await Promise.allSettled([
    completeTask(task.id),
    bookingTrackingService.stopTracking({
      bookingId: task.bookingId,
      account: null,
      workerTask: task,
    }),
  ]);
  return result;
};

module.exports = {
  ACTIVE_TASK_STATUSES,
  addTrackingPoint,
  completeHandoverJourney,
  createTask,
  getPublicTask,
  getTaskByToken,
  getTaskUrl,
  hashToken,
  listTasks,
  markDelivered,
  resendTask,
  revokeTask,
  startTracking,
  stopTracking,
  verifyHandover,
};
