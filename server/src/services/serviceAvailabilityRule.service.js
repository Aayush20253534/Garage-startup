const prisma = require("../config/prisma");

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizeOptional = (value) => {
  const text = normalize(value);
  return !text || text === "all" || text === "any" ? "" : text;
};

const minutesOfDay = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getIndiaClock = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dayOfWeek: dayMap[values.weekday],
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
};

const timeMatches = (rule, now) => {
  const clock = getIndiaClock(now);
  if (rule.dayOfWeek !== null && rule.dayOfWeek !== undefined && rule.dayOfWeek !== clock.dayOfWeek) {
    return false;
  }
  const start = minutesOfDay(rule.startTime);
  const end = minutesOfDay(rule.endTime);
  if (start === null && end === null) return true;
  const current = clock.minutes;
  if (start !== null && end !== null && end < start) {
    return current >= start || current <= end;
  }
  if (start !== null && current < start) return false;
  if (end !== null && current > end) return false;
  return true;
};

const ruleContextMatches = (rule, context = {}, now = new Date()) => {
  const contextCityId = context.cityId || context.city?.id || null;
  const contextCityName = normalize(context.cityName || context.city?.name || "");
  const contextGarageId = context.garageId || null;
  const vehicle = context.vehicle || {};

  if (rule.cityId) {
    const ruleCityName = normalize(rule.city?.normalizedName || rule.city?.name || "");
    if (contextCityId ? rule.cityId !== contextCityId : !contextCityName || ruleCityName !== contextCityName) {
      return false;
    }
  }
  if (rule.garageId && rule.garageId !== contextGarageId) return false;

  const brand = normalizeOptional(rule.vehicleBrand);
  const model = normalizeOptional(rule.vehicleModel);
  if (brand && brand !== normalizeOptional(vehicle.brand)) return false;
  if (model && model !== normalizeOptional(vehicle.model)) return false;
  if (rule.fuelType && rule.fuelType !== vehicle.fuelType) return false;
  return timeMatches(rule, now);
};

const ruleIsRelevant = (rule, context = {}) => {
  const contextCityId = context.cityId || context.city?.id || null;
  const contextCityName = normalize(context.cityName || context.city?.name || "");
  const contextGarageId = context.garageId || null;
  if (rule.cityId) {
    const ruleCityName = normalize(rule.city?.normalizedName || rule.city?.name || "");
    if (contextCityId ? rule.cityId !== contextCityId : !contextCityName || ruleCityName !== contextCityName) {
      return false;
    }
  }
  if (rule.garageId && rule.garageId !== contextGarageId) return false;

  const vehicle = context.vehicle || {};
  if (normalizeOptional(rule.vehicleBrand) && !normalizeOptional(vehicle.brand)) return false;
  if (normalizeOptional(rule.vehicleModel) && !normalizeOptional(vehicle.model)) return false;
  if (rule.fuelType && !vehicle.fuelType) return false;
  return true;
};

const isServiceAllowed = ({ rules = [], context = {}, now = new Date() }) => {
  const relevant = rules.filter((rule) => rule.isActive !== false && ruleIsRelevant(rule, context));
  const matching = relevant.filter((rule) => ruleContextMatches(rule, context, now));
  if (matching.some((rule) => rule.effect === "DENY")) return false;
  const allowRules = relevant.filter((rule) => rule.effect === "ALLOW");
  return allowRules.length === 0 || matching.some((rule) => rule.effect === "ALLOW");
};

const getRules = (serviceIds) => {
  if (!prisma.serviceAvailabilityRule?.findMany) return Promise.resolve([]);
  return prisma.serviceAvailabilityRule.findMany({
    where: { serviceId: { in: serviceIds }, isActive: true },
    include: { city: true },
    orderBy: { createdAt: "desc" },
  });
};

const filterServicesByAvailabilityRules = async (services = [], context = {}, now = new Date()) => {
  const serviceIds = services.map((service) => service.id).filter(Boolean);
  if (!serviceIds.length) return services;
  const rules = await getRules(serviceIds);
  if (!rules.length) return services;
  const byService = new Map();
  rules.forEach((rule) => byService.set(rule.serviceId, [...(byService.get(rule.serviceId) || []), rule]));
  return services.filter((service) => isServiceAllowed({
    rules: byService.get(service.id) || [],
    context,
    now,
  }));
};

const filterGaragesByAvailabilityRules = async ({
  garages = [],
  serviceIds = [],
  vehicle = {},
  now = new Date(),
}) => {
  if (!garages.length || !serviceIds.length) return garages;
  if (!prisma.serviceAvailabilityRule?.findMany) return garages;
  const garageIds = garages.map((garage) => garage.id);
  const rules = await prisma.serviceAvailabilityRule.findMany({
    where: {
      serviceId: { in: serviceIds },
      isActive: true,
      OR: [{ garageId: null }, { garageId: { in: garageIds } }],
    },
    include: { city: true },
  });
  if (!rules.length) return garages;
  const byService = new Map();
  rules.forEach((rule) => byService.set(rule.serviceId, [...(byService.get(rule.serviceId) || []), rule]));
  return garages.filter((garage) => serviceIds.every((serviceId) => isServiceAllowed({
    rules: byService.get(serviceId) || [],
    context: { garageId: garage.id, cityName: garage.city, vehicle },
    now,
  })));
};

module.exports = {
  filterGaragesByAvailabilityRules,
  filterServicesByAvailabilityRules,
  isServiceAllowed,
};
