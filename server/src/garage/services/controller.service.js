const argon2 = require("argon2");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const generateOtp = require("../../utils/generateOtp");
const hashOtp = require("../../utils/hashOtp");
const { normalizeEmail } = require("../../utils/email");
const { normalizePhone } = require("../../utils/phone");
const { sendEmailOtp } = require("../../customer/services/otp.service");
const {
  consumeGarageControllerOtp,
  throwOtpResult,
} = require("../../customer/security/otpVerification");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
const TERMINAL_BOOKING_STATUSES = ["COMPLETED", "CANCELLED", "EXPIRED"];
const OTP_EXPIRY_MS = 5 * 60 * 1000;

const controllerSelect = {
  id: true,
  garageId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  availability: true,
  passwordChangedAt: true,
  lastLoginAt: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  _count: {
    select: {
      bookings: true,
      dispatches: true,
      sessions: true,
    },
  },
};

const cleanName = (value) => String(value || "").trim().slice(0, 120);

const resolveOwnerGarage = async (ownerId) => {
  const garage = await prisma.garage.findFirst({
    where: { ownerId },
    select: { id: true, name: true, controllerLimit: true, controllerAccountsEnabled: true },
  });
  if (!garage) throw new ApiError(404, "Garage not found for this owner");
  return garage;
};

const resolveManagedGarage = async (actor, requestedGarageId = null) => {
  if (["ADMIN", "SUB_ADMIN"].includes(actor?.role) && actor?.accountType === "STAFF") {
    if (!requestedGarageId) throw new ApiError(400, "Garage ID is required");
    const garage = await prisma.garage.findUnique({
      where: { id: requestedGarageId },
      select: { id: true, name: true, controllerLimit: true, controllerAccountsEnabled: true },
    });
    if (!garage) throw new ApiError(404, "Garage not found");
    return garage;
  }

  if (actor?.role === "GARAGE_OWNER" && actor?.accountType === "USER") {
    return resolveOwnerGarage(actor.id);
  }

  throw new ApiError(403, "Only an admin or garage owner can manage controllers");
};

const assertControllerInGarage = async (controllerId, garageId) => {
  const controller = await prisma.garageController.findFirst({
    where: { id: controllerId, garageId, deletedAt: null },
  });
  if (!controller) throw new ApiError(404, "Garage controller not found");
  return controller;
};

const listControllers = async (actor, requestedGarageId = null) => {
  const garage = await resolveManagedGarage(actor, requestedGarageId);
  const controllers = await prisma.garageController.findMany({
    where: { garageId: garage.id, deletedAt: null },
    select: controllerSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return { garage, controllers };
};

const getControllerActivity = async (actor, requestedGarageId, controllerId) => {
  const garage = await resolveManagedGarage(actor, requestedGarageId);
  const controller = await assertControllerInGarage(controllerId, garage.id);
  const [bookings, dispatches] = await Promise.all([
    prisma.booking.findMany({
      where: { garageControllerId: controller.id },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        acceptedAt: true,
        updatedAt: true,
        vehicle: { select: { brand: true, model: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.garageControllerDispatch.findMany({
      where: { garageControllerId: controller.id },
      select: {
        id: true,
        channel: true,
        status: true,
        sentAt: true,
        acceptedAt: true,
        failureReason: true,
        request: { select: { id: true, bookingId: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 100,
    }),
  ]);
  return { controller: { id: controller.id, name: controller.name }, bookings, dispatches };
};

const createController = async (actor, requestedGarageId, input) => {
  const garage = await resolveManagedGarage(actor, requestedGarageId);
  if (garage.controllerAccountsEnabled === false) {
    throw new ApiError(409, "Controller accounts are disabled for this garage");
  }
  const name = cleanName(input.name);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const password = String(input.password || "");

  if (!name || !email || !phone) {
    throw new ApiError(400, "Name, email and phone are required");
  }
  if (!PASSWORD_REGEX.test(password)) throw new ApiError(400, PASSWORD_MESSAGE);

  return prisma.$transaction(async (tx) => {
    const lockedGarage = await tx.garage.update({
      where: { id: garage.id },
      data: { updatedAt: new Date() },
      select: { controllerLimit: true },
    });
    const activeCount = await tx.garageController.count({
      where: { garageId: garage.id, deletedAt: null },
    });
    if (activeCount >= lockedGarage.controllerLimit) {
      throw new ApiError(
        409,
        `This garage has reached its admin-set limit of ${lockedGarage.controllerLimit} controllers`,
      );
    }

    try {
      return await tx.garageController.create({
        data: {
          garageId: garage.id,
          name,
          email,
          phone,
          password: await argon2.hash(password),
          passwordChangedAt: new Date(),
          createdByType: actor.accountType,
          createdById: actor.id,
        },
        select: controllerSelect,
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw new ApiError(409, "That controller email or phone number is already in use");
      }
      throw error;
    }
  });
};

const updateController = async (actor, requestedGarageId, controllerId, input) => {
  const garage = await resolveManagedGarage(actor, requestedGarageId);
  const existing = await assertControllerInGarage(controllerId, garage.id);
  const data = {};

  if (Object.hasOwn(input, "name")) {
    data.name = cleanName(input.name);
    if (!data.name) throw new ApiError(400, "Name is required");
  }
  if (Object.hasOwn(input, "email")) data.email = normalizeEmail(input.email);
  if (Object.hasOwn(input, "phone")) data.phone = normalizePhone(input.phone);
  if (Object.hasOwn(input, "isActive")) data.isActive = Boolean(input.isActive);
  if (Object.hasOwn(input, "availability")) {
    if (!['AVAILABLE', 'BUSY'].includes(input.availability)) {
      throw new ApiError(400, "Availability must be AVAILABLE or BUSY");
    }
    data.availability = input.availability;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.garageController.update({
        where: { id: existing.id },
        data,
        select: controllerSelect,
      });
      if (data.isActive === false) {
        await tx.garageControllerSession.updateMany({
          where: { garageControllerId: existing.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new ApiError(409, "That controller email or phone number is already in use");
    }
    throw error;
  }
};

const resetControllerPassword = async (
  actor,
  requestedGarageId,
  controllerId,
  password,
) => {
  const garage = await resolveManagedGarage(actor, requestedGarageId);
  const controller = await assertControllerInGarage(controllerId, garage.id);
  if (!PASSWORD_REGEX.test(String(password || ""))) {
    throw new ApiError(400, PASSWORD_MESSAGE);
  }
  const changedAt = new Date();
  await prisma.$transaction([
    prisma.garageController.update({
      where: { id: controller.id },
      data: { password: await argon2.hash(password), passwordChangedAt: changedAt },
    }),
    prisma.garageControllerSession.updateMany({
      where: { garageControllerId: controller.id, revokedAt: null },
      data: { revokedAt: changedAt },
    }),
  ]);
  return { changed: true };
};

const revokeControllerSessions = async (actor, requestedGarageId, controllerId) => {
  const garage = await resolveManagedGarage(actor, requestedGarageId);
  const controller = await assertControllerInGarage(controllerId, garage.id);
  const revokedAt = new Date();
  const result = await prisma.garageControllerSession.updateMany({
    where: { garageControllerId: controller.id, revokedAt: null },
    data: { revokedAt },
  });
  return { revoked: result.count };
};

const deleteController = async (actor, requestedGarageId, controllerId) => {
  const garage = await resolveManagedGarage(actor, requestedGarageId);
  const controller = await assertControllerInGarage(controllerId, garage.id);
  const activeBooking = await prisma.booking.findFirst({
    where: {
      garageControllerId: controller.id,
      status: { notIn: TERMINAL_BOOKING_STATUSES },
    },
    select: { id: true },
  });
  if (activeBooking) {
    throw new ApiError(409, "Transfer or finish this controller's active booking before deletion");
  }
  const deletedAt = new Date();
  await prisma.$transaction([
    prisma.garageController.update({
      where: { id: controller.id },
      data: { isActive: false, availability: "BUSY", deletedAt },
    }),
    prisma.garageControllerSession.updateMany({
      where: { garageControllerId: controller.id, revokedAt: null },
      data: { revokedAt: deletedAt },
    }),
  ]);
  return { deleted: true };
};

const setControllerLimit = async (actor, garageId, limit) => {
  if (!["ADMIN", "SUB_ADMIN"].includes(actor?.role) || actor?.accountType !== "STAFF") {
    throw new ApiError(403, "Only admin accounts can set controller limits");
  }
  const value = Number(limit);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new ApiError(400, "Controller limit must be between 0 and 100");
  }
  return prisma.garage.update({
    where: { id: garageId },
    data: { controllerLimit: value },
    select: { id: true, name: true, controllerLimit: true, controllerAccountsEnabled: true },
  });
};

const setOwnAvailability = async (controllerId, availability) => {
  const controller = await prisma.garageController.findFirst({
    where: { id: controllerId, isActive: true, deletedAt: null },
  });
  if (!controller) throw new ApiError(404, "Garage controller not found");
  if (!["AVAILABLE", "BUSY"].includes(availability)) {
    throw new ApiError(400, "Availability must be AVAILABLE or BUSY");
  }
  if (availability === "AVAILABLE") {
    const activeBooking = await prisma.booking.findFirst({
      where: {
        garageControllerId: controller.id,
        status: { notIn: TERMINAL_BOOKING_STATUSES },
      },
      select: { id: true },
    });
    if (activeBooking) {
      throw new ApiError(409, "Finish the active booking before becoming available");
    }
  }
  return prisma.garageController.update({
    where: { id: controller.id },
    data: { availability, lastActiveAt: new Date() },
    select: controllerSelect,
  });
};

const getAvailableControllers = (garageId) =>
  prisma.garageController.findMany({
    where: {
      garageId,
      garage: { controllerAccountsEnabled: true },
      isActive: true,
      deletedAt: null,
      availability: "AVAILABLE",
    },
    select: { id: true, garageId: true, name: true, email: true, phone: true },
    orderBy: [{ lastActiveAt: "asc" }, { createdAt: "asc" }],
  });

const recordDispatch = async ({ requestId, controllerId, channel, result }) =>
  prisma.garageControllerDispatch.upsert({
    where: {
      requestId_garageControllerId_channel: {
        requestId,
        garageControllerId: controllerId,
        channel,
      },
    },
    update: {
      status: result?.sent === false ? "FAILED" : "SENT",
      failedAt: result?.sent === false ? new Date() : null,
      failureReason: result?.reason || result?.code || null,
    },
    create: {
      requestId,
      garageControllerId: controllerId,
      channel,
      status: result?.sent === false ? "FAILED" : "SENT",
      failedAt: result?.sent === false ? new Date() : null,
      failureReason: result?.reason || result?.code || null,
    },
  });

const transferBooking = async (actor, garageId, bookingId, targetControllerId) => {
  const garage = await resolveManagedGarage(actor, garageId);
  const target = await assertControllerInGarage(targetControllerId, garage.id);
  if (!target.isActive || target.availability !== "AVAILABLE") {
    throw new ApiError(409, "The target controller is not available");
  }
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, garageId: garage.id },
    select: { id: true, garageControllerId: true, status: true },
  });
  if (!booking || TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
    throw new ApiError(404, "Active booking not found");
  }
  await prisma.$transaction(async (tx) => {
    const targetClaim = await tx.garageController.updateMany({
      where: {
        id: target.id,
        garageId: garage.id,
        isActive: true,
        deletedAt: null,
        availability: "AVAILABLE",
      },
      data: { availability: "BUSY", lastActiveAt: new Date() },
    });
    if (!targetClaim.count) throw new ApiError(409, "Target controller was already assigned");
    const bookingClaim = await tx.booking.updateMany({
      where: {
        id: booking.id,
        garageId: garage.id,
        garageControllerId: booking.garageControllerId,
        status: { notIn: TERMINAL_BOOKING_STATUSES },
      },
      data: { garageControllerId: target.id },
    });
    if (!bookingClaim.count) {
      throw new ApiError(409, "Booking assignment changed. Refresh and try again");
    }
    if (booking.garageControllerId && booking.garageControllerId !== target.id) {
      await releaseController(tx, booking.garageControllerId);
    }
  });
  return { transferred: true, bookingId: booking.id, controllerId: target.id };
};

const releaseController = async (client, controllerId) => {
  if (!controllerId) return { released: false };
  const activeCount = await client.booking.count({
    where: {
      garageControllerId: controllerId,
      status: { notIn: TERMINAL_BOOKING_STATUSES },
    },
  });
  if (activeCount > 0) return { released: false };
  await client.garageController.updateMany({
    where: { id: controllerId, isActive: true, deletedAt: null },
    data: { availability: "AVAILABLE", lastActiveAt: new Date() },
  });
  return { released: true };
};

const sanitizeCombinedBooking = (booking, own) => ({
  ...booking,
  user: own
    ? booking.user
    : booking.user
      ? { id: booking.user.id, name: booking.user.name, phone: null, email: null }
      : null,
  customerAddress: own ? booking.customerAddress : null,
  customerLatitude: own ? booking.customerLatitude : null,
  customerLongitude: own ? booking.customerLongitude : null,
});

const getControllerDashboard = async (controllerId) => {
  const controller = await prisma.garageController.findFirst({
    where: { id: controllerId, isActive: true, deletedAt: null },
    select: { id: true, garageId: true, name: true, availability: true },
  });
  if (!controller) throw new ApiError(404, "Garage controller not found");
  const include = {
    user: { select: { id: true, name: true, phone: true, email: true } },
    vehicle: true,
    services: { include: { service: true } },
    garageController: { select: { id: true, name: true } },
  };
  const [active, ownHistory, combinedHistory, notifications] = await Promise.all([
    prisma.booking.findMany({
      where: { garageControllerId: controller.id, status: { notIn: TERMINAL_BOOKING_STATUSES } },
      include,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { garageControllerId: controller.id, status: { in: TERMINAL_BOOKING_STATUSES } },
      include,
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.booking.findMany({
      where: { garageId: controller.garageId, status: { in: TERMINAL_BOOKING_STATUSES } },
      include,
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.notification.findMany({
      where: { garageControllerId: controller.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return {
    controller,
    active,
    ownHistory,
    combinedHistory: combinedHistory.map((booking) =>
      sanitizeCombinedBooking(booking, booking.garageControllerId === controller.id),
    ),
    notifications,
  };
};

const requestPasswordReset = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const controller = await prisma.garageController.findUnique({ where: { email: normalizedEmail } });
  if (controller?.isActive && !controller.deletedAt) {
    const otp = generateOtp();
    const now = new Date();
    await prisma.garageControllerOtp.upsert({
      where: { garageControllerId_purpose: { garageControllerId: controller.id, purpose: "RESET_PASSWORD" } },
      update: { otpHash: hashOtp(otp), expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS), usedAt: null, attempts: 0, createdAt: now },
      create: { garageControllerId: controller.id, purpose: "RESET_PASSWORD", otpHash: hashOtp(otp), expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS) },
    });
    await sendEmailOtp({ to: controller.email, otp, subject: "Reset your Rovauto controller password" });
  }
  return { email: normalizedEmail, message: "If that controller account exists, a reset code was sent" };
};

const resetPasswordWithOtp = async ({ email, otp, newPassword }) => {
  if (!PASSWORD_REGEX.test(String(newPassword || ""))) throw new ApiError(400, PASSWORD_MESSAGE);
  const controller = await prisma.garageController.findUnique({ where: { email: normalizeEmail(email) } });
  if (!controller?.isActive || controller.deletedAt) throw new ApiError(400, "Invalid or expired OTP");
  const changedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const consumed = await consumeGarageControllerOtp({ client: tx, garageControllerId: controller.id, purpose: "RESET_PASSWORD", otp });
    if (!consumed.ok) return consumed;
    await tx.garageController.update({ where: { id: controller.id }, data: { password: await argon2.hash(newPassword), passwordChangedAt: changedAt } });
    await tx.garageControllerSession.updateMany({ where: { garageControllerId: controller.id, revokedAt: null }, data: { revokedAt: changedAt } });
    return consumed;
  });
  throwOtpResult(result);
  return { message: "Password reset successful" };
};

module.exports = {
  PASSWORD_MESSAGE,
  PASSWORD_REGEX,
  controllerSelect,
  createController,
  deleteController,
  getAvailableControllers,
  getControllerDashboard,
  getControllerActivity,
  listControllers,
  recordDispatch,
  releaseController,
  requestPasswordReset,
  resetControllerPassword,
  resetPasswordWithOtp,
  resolveManagedGarage,
  revokeControllerSessions,
  setControllerLimit,
  setOwnAvailability,
  transferBooking,
  updateController,
};
