const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");

const normalizeText = (value) => String(value || "").trim();
const normalizeCity = (value) => normalizeText(value).toLowerCase();
const normalizeScopeValue = (value) => {
  const text = normalizeText(value);
  return !text || ["ALL", "ANY"].includes(text.toUpperCase()) ? null : text;
};
const encodeScopePart = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return `${Buffer.byteLength(normalized, "utf8")}:${normalized}`;
};
const getScopeKey = (payload = {}) => [
  normalizeCity(payload.city),
  payload.serviceId,
  normalizeScopeValue(payload.vehicleBrand),
  normalizeScopeValue(payload.vehicleModel),
  payload.fuelType || null,
].map(encodeScopePart).join("|");

const invalidatePricingCaches = async () => Promise.allSettled([
  deletePattern("price-ranges:*"),
  deletePattern("services:*"),
]);

const normalizeSchedulePayload = (payload = {}) => {
  const minPrice = Number(payload.minPrice);
  const maxPrice = Number(payload.maxPrice);
  const startsAt = new Date(payload.startsAt);
  const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
  if (!normalizeText(payload.city)) throw new ApiError(400, "City is required");
  if (!payload.serviceId) throw new ApiError(400, "Service is required");
  if (!normalizeText(payload.vehicleBrand)) throw new ApiError(400, "Vehicle brand is required");
  if (!Number.isInteger(minPrice) || minPrice < 0 || !Number.isInteger(maxPrice) || maxPrice < minPrice) {
    throw new ApiError(400, "Enter a valid minimum and maximum price");
  }
  if (Number.isNaN(startsAt.getTime())) throw new ApiError(400, "Valid start date is required");
  if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)) {
    throw new ApiError(400, "End date must be after the start date");
  }
  if (endsAt && endsAt <= new Date()) {
    throw new ApiError(400, "End date must be in the future");
  }
  return {
    scopeKey: getScopeKey(payload),
    city: normalizeCity(payload.city),
    serviceId: payload.serviceId,
    vehicleBrand: normalizeScopeValue(payload.vehicleBrand),
    vehicleModel: normalizeScopeValue(payload.vehicleModel),
    fuelType: payload.fuelType || null,
    minPrice,
    maxPrice,
    isActive: payload.isActive !== false,
    startsAt,
    endsAt,
  };
};

const applyDuePriceSchedules = async () => {
  const now = new Date();
  let changed = 0;
  const due = await prisma.priceRangeSchedule.findMany({
    where: { status: "PENDING", startsAt: { lte: now } },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  for (const schedule of due) {
    const applied = await prisma.$transaction(async (tx) => {
      const claimed = await tx.priceRangeSchedule.updateMany({
        where: { id: schedule.id, status: "PENDING" },
        data: { status: "APPLIED", appliedAt: now },
      });
      if (!claimed.count) return false;
      const previous = await tx.cityServicePriceRange.findUnique({ where: { scopeKey: schedule.scopeKey } });
      await tx.priceRangeSchedule.update({
        where: { id: schedule.id },
        data: {
          previousRange: previous
            ? {
                city: previous.city,
                serviceId: previous.serviceId,
                vehicleBrand: previous.vehicleBrand,
                vehicleModel: previous.vehicleModel,
                fuelType: previous.fuelType,
                minPrice: previous.minPrice,
                maxPrice: previous.maxPrice,
                isActive: previous.isActive,
              }
            : null,
        },
      });
      await tx.cityServicePriceRange.upsert({
        where: { scopeKey: schedule.scopeKey },
        create: {
          scopeKey: schedule.scopeKey,
          city: schedule.city,
          serviceId: schedule.serviceId,
          vehicleBrand: schedule.vehicleBrand,
          vehicleModel: schedule.vehicleModel,
          fuelType: schedule.fuelType,
          minPrice: schedule.minPrice,
          maxPrice: schedule.maxPrice,
          isActive: schedule.isActive,
        },
        update: {
          minPrice: schedule.minPrice,
          maxPrice: schedule.maxPrice,
          isActive: schedule.isActive,
        },
      });
      return true;
    });
    if (applied) changed += 1;
  }

  const expired = await prisma.priceRangeSchedule.findMany({
    where: { status: "APPLIED", endsAt: { lte: now } },
    orderBy: { endsAt: "asc" },
    take: 100,
  });
  for (const schedule of expired) {
    const reverted = await prisma.$transaction(async (tx) => {
      const claimed = await tx.priceRangeSchedule.updateMany({
        where: { id: schedule.id, status: "APPLIED" },
        data: { status: "EXPIRED", expiredAt: now },
      });
      if (!claimed.count) return false;
      const current = await tx.cityServicePriceRange.findUnique({ where: { scopeKey: schedule.scopeKey } });
      const stillScheduledValue = current &&
        current.minPrice === schedule.minPrice &&
        current.maxPrice === schedule.maxPrice &&
        current.isActive === schedule.isActive;
      if (!stillScheduledValue) return true;
      const previous = schedule.previousRange && typeof schedule.previousRange === "object"
        ? schedule.previousRange
        : null;
      if (previous) {
        await tx.cityServicePriceRange.upsert({
          where: { scopeKey: schedule.scopeKey },
          create: { scopeKey: schedule.scopeKey, ...previous },
          update: {
            minPrice: Number(previous.minPrice),
            maxPrice: Number(previous.maxPrice),
            isActive: previous.isActive !== false,
          },
        });
      } else {
        await tx.cityServicePriceRange.deleteMany({ where: { scopeKey: schedule.scopeKey } });
      }
      return true;
    });
    if (reverted) changed += 1;
  }

  if (changed) await invalidatePricingCaches();
  return changed;
};

const listSchedules = async (query = {}) => {
  await applyDuePriceSchedules();
  return prisma.priceRangeSchedule.findMany({
    where: {
      ...(query.status && { status: query.status }),
      ...(query.city && { city: normalizeCity(query.city) }),
      ...(query.serviceId && { serviceId: query.serviceId }),
    },
    include: { service: { include: { category: true } } },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 250,
  });
};

const createSchedule = async (payload, staff) => {
  const data = normalizeSchedulePayload(payload);
  const [service, city] = await Promise.all([
    prisma.service.findUnique({ where: { id: data.serviceId }, select: { id: true } }),
    prisma.city.findUnique({ where: { normalizedName: data.city }, select: { id: true, isActive: true } }),
  ]);
  if (!service) throw new ApiError(404, "Service not found");
  if (!city?.isActive) throw new ApiError(400, "Select an active Rovauto city");
  const overlap = await prisma.priceRangeSchedule.findFirst({
    where: {
      scopeKey: data.scopeKey,
      status: { in: ["PENDING", "APPLIED"] },
      startsAt: { lt: data.endsAt || new Date("9999-12-31") },
      OR: [{ endsAt: null }, { endsAt: { gt: data.startsAt } }],
    },
    select: { id: true },
  });
  if (overlap) throw new ApiError(409, "Another active schedule overlaps this price scope");
  const schedule = await prisma.priceRangeSchedule.create({
    data: {
      ...data,
      createdById: staff?.id || null,
      createdByName: staff?.name || staff?.loginId || null,
    },
    include: { service: { include: { category: true } } },
  });
  await applyDuePriceSchedules();
  return prisma.priceRangeSchedule.findUnique({
    where: { id: schedule.id },
    include: { service: { include: { category: true } } },
  });
};

const cancelSchedule = async (id) => {
  const schedule = await prisma.priceRangeSchedule.findUnique({ where: { id } });
  if (!schedule) throw new ApiError(404, "Price schedule not found");
  if (["EXPIRED", "CANCELLED"].includes(schedule.status)) return schedule;
  if (schedule.status === "APPLIED") {
    await prisma.priceRangeSchedule.update({ where: { id }, data: { endsAt: new Date() } });
    await applyDuePriceSchedules();
  }
  return prisma.priceRangeSchedule.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: { service: { include: { category: true } } },
  });
};

module.exports = {
  applyDuePriceSchedules,
  cancelSchedule,
  createSchedule,
  getScopeKey,
  listSchedules,
  normalizeSchedulePayload,
};
