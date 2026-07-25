const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const BROADCAST_STATUS = require("../../constants/broadcastStatus");
const { deleteCache, deletePattern } = require("../../utils/cache");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");

const GARAGE_OPERATIONAL_STATUSES = new Set([
  "ACTIVE",
  "TEMPORARILY_SUSPENDED",
  "PERMANENTLY_BLOCKED",
  "UNDER_REVIEW",
  "DOCUMENTS_EXPIRED",
]);

const invalidateGarageOperationalCaches = async (garageId, customerIds = []) => {
  await Promise.allSettled([
    deleteCache(`garages:${garageId}:services`),
    deleteCache(`garages:detail:${garageId}`),
    deleteCache("public:stats:v2"),
    deletePattern("garages:list:*"),
    deletePattern("garages:public:*"),
    ...customerIds.map((userId) => invalidateCustomerCache(userId)),
  ]);
};

const reactivateExpiredGarageSuspensions = async () => {
  const now = new Date();
  const expired = await prisma.garage.findMany({
    where: {
      operationalStatus: "TEMPORARILY_SUSPENDED",
      suspendedUntil: { lte: now },
    },
    select: { id: true },
    take: 250,
  });
  if (!expired.length) return 0;

  await prisma.garage.updateMany({
    where: { id: { in: expired.map((item) => item.id) } },
    data: {
      operationalStatus: "ACTIVE",
      isActive: true,
      suspensionReason: null,
      suspendedAt: null,
      suspendedUntil: null,
    },
  });
  await Promise.allSettled(expired.map((item) => invalidateGarageOperationalCaches(item.id)));
  return expired.length;
};

const setGarageOperationalStatus = async ({
  garageId,
  status,
  reason = "",
  suspendedUntil = null,
  staff = null,
}) => {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (!GARAGE_OPERATIONAL_STATUSES.has(normalizedStatus)) {
    throw new ApiError(400, "Select a valid garage operational status");
  }
  if (normalizedStatus === "PERMANENTLY_BLOCKED" && !["ADMIN", "SUB_ADMIN"].includes(staff?.role)) {
    throw new ApiError(403, "Only an Admin or Main Admin can permanently block a garage");
  }

  const now = new Date();
  let until = null;
  if (normalizedStatus === "TEMPORARILY_SUSPENDED") {
    until = new Date(suspendedUntil);
    if (Number.isNaN(until.getTime()) || until <= now) {
      throw new ApiError(400, "Temporary suspension must end in the future");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const garage = await tx.garage.findUnique({
      where: { id: garageId },
      select: { id: true, operationalStatus: true, isActive: true },
    });
    if (!garage) throw new ApiError(404, "Garage not found");

    const isOperational = normalizedStatus === "ACTIVE";
    const updated = await tx.garage.update({
      where: { id: garageId },
      data: {
        operationalStatus: normalizedStatus,
        isActive: isOperational,
        suspensionReason: isOperational ? null : String(reason || "").trim().slice(0, 1000) || null,
        suspendedAt: isOperational ? null : now,
        suspendedUntil: normalizedStatus === "TEMPORARILY_SUSPENDED" ? until : null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        wallet: true,
      },
    });

    let customerIds = [];
    if (!isOperational) {
      const pendingRequests = await tx.garageBroadcastRequest.findMany({
        where: { garageId, status: BROADCAST_STATUS.SENT },
        select: { booking: { select: { userId: true } } },
      });
      customerIds = [...new Set(pendingRequests.map((item) => item.booking?.userId).filter(Boolean))];
      await tx.garageBroadcastRequest.updateMany({
        where: { garageId, status: BROADCAST_STATUS.SENT },
        data: { status: BROADCAST_STATUS.EXPIRED, expiredAt: now },
      });
    }

    return { updated, customerIds };
  });

  await invalidateGarageOperationalCaches(garageId, result.customerIds);
  return result.updated;
};

module.exports = {
  GARAGE_OPERATIONAL_STATUSES,
  reactivateExpiredGarageSuspensions,
  setGarageOperationalStatus,
};
