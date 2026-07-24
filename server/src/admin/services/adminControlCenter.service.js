const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const notificationService = require("../../customer/services/notification.service");
const auditService = require("./adminAudit.service");
const escalationService = require("./bookingEscalation.service");
const garageOperationalService = require("./garageOperational.service");
const priceScheduleService = require("./priceSchedule.service");
const priceRangeService = require("./cityServicePriceRange.service");
const { deletePattern } = require("../../utils/cache");

const FUEL_TYPES = new Set(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "OTHER"]);
const RULE_EFFECTS = new Set(["ALLOW", "DENY"]);

const clampDays = (value) => Math.min(Math.max(Number(value) || 30, 1), 365);
const percent = (value, total) => (total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0);
const average = (values) => values.length
  ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  : 0;

const invalidateAvailabilityCaches = async () => Promise.allSettled([
  deletePattern("services:*"),
  deletePattern("garages:list:*"),
  deletePattern("garages:public:*"),
]);

const getOverview = async () => {
  await Promise.all([
    garageOperationalService.reactivateExpiredGarageSuspensions(),
    priceScheduleService.applyDuePriceSchedules(),
    escalationService.refreshEscalations(),
  ]);
  const [openEscalations, suspendedGarages, scheduledPrices, activeAvailabilityRules, recentAuditLogs] = await Promise.all([
    prisma.bookingEscalation.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    prisma.garage.count({ where: { operationalStatus: { not: "ACTIVE" } } }),
    prisma.priceRangeSchedule.count({ where: { status: { in: ["PENDING", "APPLIED"] } } }),
    prisma.serviceAvailabilityRule.count({ where: { isActive: true } }),
    prisma.adminAuditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
  return { openEscalations, suspendedGarages, scheduledPrices, activeAvailabilityRules, recentAuditLogs };
};

const listSupportBookings = async (query = {}) => {
  const search = String(query.search || "").trim();
  if (!search) return [];
  return prisma.booking.findMany({
    where: {
      OR: [
        { bookingCode: { contains: search, mode: "insensitive" } },
        { user: { is: { name: { contains: search, mode: "insensitive" } } } },
        { user: { is: { email: { contains: search, mode: "insensitive" } } } },
        { user: { is: { phone: { contains: search, mode: "insensitive" } } } },
        { vehicle: { is: { registrationNumber: { contains: search, mode: "insensitive" } } } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      vehicle: true,
      garage: { select: { id: true, name: true, city: true, phone: true, operationalStatus: true } },
      payment: true,
      services: { include: { service: true } },
      escalations: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

const resendBookingNotification = async ({ bookingId, target = "BOTH", message = "", staff }) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true } },
      garage: {
        include: {
          owner: { select: { id: true } },
          controllers: { where: { isActive: true, deletedAt: null }, select: { id: true } },
        },
      },
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  const normalizedTarget = String(target || "BOTH").toUpperCase();
  if (!["CUSTOMER", "GARAGE", "BOTH"].includes(normalizedTarget)) {
    throw new ApiError(400, "Select customer, garage, or both");
  }
  const note = String(message || "").trim().slice(0, 500);
  const defaultMessage = `Booking ${booking.bookingCode} is currently ${booking.status.replaceAll("_", " ").toLowerCase()}.`;
  const body = note || defaultMessage;
  const sent = { customer: 0, garage: 0 };
  if (["CUSTOMER", "BOTH"].includes(normalizedTarget)) {
    await notificationService.createNotification({
      userId: booking.userId,
      title: `Booking ${booking.bookingCode} update`,
      message: body,
      type: "BOOKING",
      link: `/dashboard/bookings/${booking.id}`,
      metadata: { bookingId: booking.id, resentByAdmin: true },
    });
    sent.customer += 1;
  }
  if (["GARAGE", "BOTH"].includes(normalizedTarget)) {
    if (!booking.garage) throw new ApiError(400, "This booking has no assigned garage");
    if (booking.garage.owner?.id) {
      await notificationService.createNotification({
        garageOwnerId: booking.garage.owner.id,
        title: `Booking ${booking.bookingCode} update`,
        message: body,
        type: "BOOKING",
        link: `/garage/bookings/${booking.id}`,
        metadata: { bookingId: booking.id, resentByAdmin: true },
      });
      sent.garage += 1;
    }
    for (const controller of booking.garage.controllers || []) {
      await notificationService.createNotification({
        garageControllerId: controller.id,
        title: `Booking ${booking.bookingCode} update`,
        message: body,
        type: "BOOKING",
        link: `/garage/bookings/${booking.id}`,
        metadata: { bookingId: booking.id, resentByAdmin: true },
      });
      sent.garage += 1;
    }
  }
  const staffName = staff.name || staff.loginId || "Admin";
  await prisma.$transaction(async (tx) => {
    const adminEvent = await tx.adminBookingEvent.create({
      data: {
        bookingId,
        staffId: staff.id,
        staffName,
        action: "NOTIFICATION_RESENT",
        note: body,
        metadata: { target: normalizedTarget, sent },
      },
    });
    await tx.bookingEvent.create({
      data: {
        bookingId,
        actorType: "STAFF",
        actorId: staff.id,
        actorName: staffName,
        actorRole: staff.role,
        eventType: "NOTIFICATION_RESENT",
        title: "Booking notification resent",
        detail: body,
        metadata: { target: normalizedTarget, sent, adminEventId: adminEvent.id },
      },
    });
  });
  return sent;
};

const listGaragePerformance = async (query = {}) => {
  await garageOperationalService.reactivateExpiredGarageSuspensions();
  const days = clampDays(query.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const garages = await prisma.garage.findMany({
    where: {
      ...(query.city && { city: { contains: query.city, mode: "insensitive" } }),
      ...(query.status && { operationalStatus: query.status }),
    },
    include: {
      owner: { select: { id: true, name: true, phone: true, email: true } },
      wallet: true,
    },
    orderBy: { name: "asc" },
    take: 300,
  });
  const garageIds = garages.map((garage) => garage.id);
  if (!garageIds.length) return [];
  const [bookings, broadcasts] = await Promise.all([
    prisma.booking.findMany({
      where: { garageId: { in: garageIds }, createdAt: { gte: since } },
      select: {
        id: true,
        garageId: true,
        userId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        acceptedAt: true,
        totalServiceAmount: true,
        complaints: { select: { id: true } },
      },
    }),
    prisma.garageBroadcastRequest.findMany({
      where: { garageId: { in: garageIds }, sentAt: { gte: since } },
      select: { garageId: true, status: true, sentAt: true, acceptedAt: true },
    }),
  ]);

  return garages.map((garage) => {
    const garageBookings = bookings.filter((item) => item.garageId === garage.id);
    const garageBroadcasts = broadcasts.filter((item) => item.garageId === garage.id);
    const acceptedBroadcasts = garageBroadcasts.filter((item) => item.status === "ACCEPTED");
    const completed = garageBookings.filter((item) => item.status === "COMPLETED");
    const cancelled = garageBookings.filter((item) => item.status === "CANCELLED");
    const responseMinutes = acceptedBroadcasts
      .filter((item) => item.acceptedAt)
      .map((item) => Math.max(0, (new Date(item.acceptedAt) - new Date(item.sentAt)) / 60000));
    const completionMinutes = completed.map((item) => Math.max(0, (new Date(item.updatedAt) - new Date(item.acceptedAt || item.createdAt)) / 60000));
    const customerCounts = new Map();
    completed.forEach((item) => customerCounts.set(item.userId, (customerCounts.get(item.userId) || 0) + 1));
    const repeatCustomers = [...customerCounts.values()].filter((count) => count > 1).length;
    return {
      id: garage.id,
      name: garage.name,
      city: garage.city,
      operationalStatus: garage.operationalStatus,
      suspensionReason: garage.suspensionReason,
      suspendedUntil: garage.suspendedUntil,
      owner: garage.owner,
      walletBalance: garage.wallet?.balance || 0,
      ratingAvg: garage.ratingAvg,
      ratingCount: garage.ratingCount,
      receivedRequests: garageBroadcasts.length,
      acceptedRequests: acceptedBroadcasts.length,
      acceptanceRate: percent(acceptedBroadcasts.length, garageBroadcasts.length),
      assignedBookings: garageBookings.length,
      completedBookings: completed.length,
      completionRate: percent(completed.length, garageBookings.length),
      cancelledBookings: cancelled.length,
      cancellationRate: percent(cancelled.length, garageBookings.length),
      avgResponseMinutes: average(responseMinutes),
      avgCompletionMinutes: average(completionMinutes),
      complaintCount: garageBookings.reduce((sum, item) => sum + item.complaints.length, 0),
      repeatCustomerRate: percent(repeatCustomers, customerCounts.size),
      serviceRevenue: completed.reduce((sum, item) => sum + Number(item.totalServiceAmount || 0), 0),
      periodDays: days,
    };
  });
};

const getPricingCoverage = async () => {
  await priceScheduleService.applyDuePriceSchedules();
  const [cities, services, brands, models, ranges] = await Promise.all([
    prisma.city.findMany({ where: { isActive: true }, select: { id: true, name: true, normalizedName: true } }),
    prisma.service.findMany({ where: { isActive: true, category: { isActive: true } }, include: { category: true } }),
    prisma.vehicleBrand.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.vehicleModel.findMany({ where: { isActive: true, brand: { isActive: true } }, include: { brand: { select: { id: true, name: true } } } }),
    prisma.cityServicePriceRange.findMany({ where: { isActive: true }, select: { city: true, serviceId: true, vehicleBrand: true, vehicleModel: true } }),
  ]);
  const cityServiceKeys = new Set(ranges.map((range) => `${range.city}|${range.serviceId}`));
  const serviceIdsWithRange = new Set(ranges.map((range) => range.serviceId));
  const brandsWithRange = new Set(ranges.map((range) => String(range.vehicleBrand || "").toLowerCase()).filter(Boolean));
  const missingCityServices = [];
  for (const city of cities) {
    for (const service of services) {
      if (!cityServiceKeys.has(`${city.normalizedName}|${service.id}`)) {
        missingCityServices.push({ city: city.name, serviceId: service.id, serviceName: service.name, category: service.category?.name });
      }
    }
  }
  const missingModels = models.filter((model) => {
    const brandName = model.brand.name.toLowerCase();
    const modelName = model.name.toLowerCase();
    return !ranges.some((range) => {
      const rangeBrand = String(range.vehicleBrand || "").toLowerCase();
      const rangeModel = String(range.vehicleModel || "").toLowerCase();
      return rangeBrand === brandName && (!rangeModel || rangeModel === modelName);
    });
  });
  return {
    totals: {
      activeRanges: ranges.length,
      activeCities: cities.length,
      activeServices: services.length,
      activeBrands: brands.length,
      activeModels: models.length,
      missingCityServicePairs: missingCityServices.length,
      servicesWithoutAnyRange: services.filter((service) => !serviceIdsWithRange.has(service.id)).length,
      brandsWithoutAnyRange: brands.filter((brand) => !brandsWithRange.has(brand.name.toLowerCase())).length,
      modelsWithoutCoverage: missingModels.length,
    },
    servicesWithoutAnyRange: services
      .filter((service) => !serviceIdsWithRange.has(service.id))
      .map((service) => ({ id: service.id, name: service.name, category: service.category?.name })),
    brandsWithoutAnyRange: brands.filter((brand) => !brandsWithRange.has(brand.name.toLowerCase())),
    missingCityServices: missingCityServices.slice(0, 500),
    missingModels: missingModels.slice(0, 500).map((model) => ({ id: model.id, name: model.name, brand: model.brand.name })),
  };
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const exportPriceRangesCsv = async () => {
  await priceScheduleService.applyDuePriceSchedules();
  const rows = await prisma.cityServicePriceRange.findMany({
    include: { service: { include: { category: true } } },
    orderBy: [{ city: "asc" }, { service: { name: "asc" } }, { vehicleBrand: "asc" }],
  });
  const headers = ["id", "city", "serviceId", "category", "serviceName", "vehicleBrand", "vehicleModel", "fuelType", "minPrice", "maxPrice", "isActive"];
  const lines = [headers.join(",")];
  rows.forEach((row) => lines.push([
    row.id,
    row.city,
    row.serviceId,
    row.service.category?.name || "",
    row.service.name,
    row.vehicleBrand || "ALL",
    row.vehicleModel || "ALL",
    row.fuelType || "",
    row.minPrice,
    row.maxPrice,
    row.isActive,
  ].map(csvEscape).join(",")));
  return lines.join("\n");
};

const normalizeImportRow = (row = {}) => ({
  city: String(row.city || "").trim(),
  serviceId: String(row.serviceId || "").trim(),
  vehicleBrand: String(row.vehicleBrand || "").trim(),
  vehicleModel: String(row.vehicleModel || "").trim() || null,
  fuelType: String(row.fuelType || "").trim().toUpperCase() || null,
  minPrice: Number(row.minPrice),
  maxPrice: Number(row.maxPrice),
  isActive: row.isActive === undefined || row.isActive === "" ? true : [true, "true", "1", 1, "yes"].includes(row.isActive),
});

const importPriceRanges = async ({ rows = [], dryRun = false }) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(400, "Add at least one CSV row");
  if (rows.length > 2000) throw new ApiError(400, "Import is limited to 2,000 rows at a time");
  const normalizedRows = rows.map(normalizeImportRow);
  const errors = [];
  const serviceIds = [...new Set(normalizedRows.map((row) => row.serviceId).filter(Boolean))];
  const [services, cities] = await Promise.all([
    prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true } }),
    prisma.city.findMany({ select: { normalizedName: true, isActive: true } }),
  ]);
  const validServiceIds = new Set(services.map((service) => service.id));
  const activeCities = new Set(cities.filter((city) => city.isActive).map((city) => city.normalizedName));
  const seenScopes = new Map();
  normalizedRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const normalizedCity = String(row.city || "").trim().toLowerCase();
    if (!row.city) errors.push({ row: rowNumber, message: "City is required" });
    else if (!activeCities.has(normalizedCity)) errors.push({ row: rowNumber, message: "City is not active in Rovauto" });
    if (!row.serviceId || !validServiceIds.has(row.serviceId)) errors.push({ row: rowNumber, message: "Valid serviceId is required" });
    if (!row.vehicleBrand) errors.push({ row: rowNumber, message: "Vehicle brand is required" });
    if (row.fuelType && !FUEL_TYPES.has(row.fuelType)) errors.push({ row: rowNumber, message: "Invalid fuel type" });
    if (!Number.isInteger(row.minPrice) || !Number.isInteger(row.maxPrice) || row.minPrice < 0 || row.maxPrice < row.minPrice) {
      errors.push({ row: rowNumber, message: "Invalid minPrice/maxPrice" });
    }
    if (row.city && row.serviceId && row.vehicleBrand) {
      const scopeKey = priceRangeService.getScopeKey(row);
      if (seenScopes.has(scopeKey)) {
        errors.push({ row: rowNumber, message: `Duplicate price scope also appears on row ${seenScopes.get(scopeKey)}` });
      } else {
        seenScopes.set(scopeKey, rowNumber);
      }
    }
  });
  if (errors.length || dryRun) return { valid: errors.length === 0, rows: normalizedRows.length, errors };
  await prisma.$transaction(async (tx) => {
    for (const row of normalizedRows) {
      await priceRangeService.validatePriceRangePayload(row, tx);
      await priceRangeService.upsertLivePriceRange(row, tx);
    }
  });
  await priceRangeService.invalidatePriceRangeCaches();
  return { valid: true, imported: normalizedRows.length, errors: [] };
};

const listAvailabilityRules = async (query = {}) => prisma.serviceAvailabilityRule.findMany({
  where: {
    ...(query.serviceId && { serviceId: query.serviceId }),
    ...(query.cityId && { cityId: query.cityId }),
    ...(query.garageId && { garageId: query.garageId }),
    ...(query.isActive !== undefined && { isActive: query.isActive === true || query.isActive === "true" }),
  },
  include: {
    service: { include: { category: true } },
    city: true,
    garage: { select: { id: true, name: true, city: true } },
  },
  orderBy: { createdAt: "desc" },
  take: 500,
});

const normalizeAvailabilityRule = (payload = {}, staff = null) => {
  const effect = String(payload.effect || "DENY").toUpperCase();
  if (!RULE_EFFECTS.has(effect)) throw new ApiError(400, "Effect must be ALLOW or DENY");
  const dayOfWeek = payload.dayOfWeek === "" || payload.dayOfWeek === null || payload.dayOfWeek === undefined
    ? null
    : Number(payload.dayOfWeek);
  if (dayOfWeek !== null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
    throw new ApiError(400, "Day of week must be between 0 and 6");
  }
  const validateTime = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validateTime(payload.startTime) || !validateTime(payload.endTime)) throw new ApiError(400, "Time must use HH:mm format");
  const fuelType = String(payload.fuelType || "").toUpperCase() || null;
  if (fuelType && !FUEL_TYPES.has(fuelType)) throw new ApiError(400, "Invalid fuel type");
  return {
    serviceId: String(payload.serviceId || "").trim(),
    cityId: payload.cityId || null,
    garageId: payload.garageId || null,
    vehicleBrand: String(payload.vehicleBrand || "").trim() || null,
    vehicleModel: String(payload.vehicleModel || "").trim() || null,
    fuelType,
    dayOfWeek,
    startTime: payload.startTime || null,
    endTime: payload.endTime || null,
    effect,
    reason: String(payload.reason || "").trim().slice(0, 500) || null,
    isActive: payload.isActive !== false,
    createdById: staff?.id || null,
    createdByName: staff?.name || staff?.loginId || null,
  };
};

const validateAvailabilityRuleReferences = async (data) => {
  const [service, city, garage] = await Promise.all([
    prisma.service.findUnique({ where: { id: data.serviceId }, select: { id: true } }),
    data.cityId ? prisma.city.findUnique({ where: { id: data.cityId }, select: { id: true, normalizedName: true } }) : null,
    data.garageId ? prisma.garage.findUnique({ where: { id: data.garageId }, select: { id: true, city: true } }) : null,
  ]);
  if (!service) throw new ApiError(404, "Service not found");
  if (data.cityId && !city) throw new ApiError(404, "City not found");
  if (data.garageId && !garage) throw new ApiError(404, "Garage not found");
  if (city && garage && city.normalizedName !== String(garage.city || "").trim().toLowerCase()) {
    throw new ApiError(400, "Selected garage does not belong to the selected city");
  }
};

const createAvailabilityRule = async (payload, staff) => {
  const data = normalizeAvailabilityRule(payload, staff);
  if (!data.serviceId) throw new ApiError(400, "Service is required");
  await validateAvailabilityRuleReferences(data);
  const rule = await prisma.serviceAvailabilityRule.create({ data, include: { service: { include: { category: true } }, city: true, garage: true } });
  await invalidateAvailabilityCaches();
  return rule;
};

const updateAvailabilityRule = async (id, payload, staff) => {
  const existing = await prisma.serviceAvailabilityRule.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Availability rule not found");
  const merged = normalizeAvailabilityRule({ ...existing, ...payload }, staff);
  delete merged.createdById;
  delete merged.createdByName;
  await validateAvailabilityRuleReferences(merged);
  const rule = await prisma.serviceAvailabilityRule.update({
    where: { id },
    data: merged,
    include: { service: { include: { category: true } }, city: true, garage: true },
  });
  await invalidateAvailabilityCaches();
  return rule;
};

const deleteAvailabilityRule = async (id) => {
  const existing = await prisma.serviceAvailabilityRule.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Availability rule not found");
  const rule = await prisma.serviceAvailabilityRule.delete({ where: { id } });
  await invalidateAvailabilityCaches();
  return rule;
};

module.exports = {
  cancelPriceSchedule: priceScheduleService.cancelSchedule,
  createAvailabilityRule,
  createPriceSchedule: priceScheduleService.createSchedule,
  deleteAvailabilityRule,
  exportPriceRangesCsv,
  getAuditLogs: auditService.listAuditLogs,
  getOverview,
  getPricingCoverage,
  importPriceRanges,
  listAvailabilityRules,
  listEscalationRules: escalationService.listRules,
  listEscalations: escalationService.listEscalations,
  listGaragePerformance,
  listPriceSchedules: priceScheduleService.listSchedules,
  listSupportBookings,
  resendBookingNotification,
  setGarageOperationalStatus: garageOperationalService.setGarageOperationalStatus,
  updateAvailabilityRule,
  updateEscalation: escalationService.updateEscalation,
  updateEscalationRule: escalationService.updateRule,
};
