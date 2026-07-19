const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getCache, setCache, deletePattern } = require("../../utils/cache");

const PRICE_RANGE_CACHE_TTL_SECONDS = Number(
  process.env.PRICE_RANGE_CACHE_TTL_SECONDS || 5 * 60,
);

const normalizeText = (value) => String(value || "").trim();
const normalizeCity = (city) => normalizeText(city).toLowerCase();
const normalizeScopeValue = (value) => {
  const text = normalizeText(value);
  return !text || ["ALL", "ANY"].includes(text.toUpperCase()) ? null : text;
};
const normalizeComparable = (value) => normalizeText(value).toLowerCase();
const getTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const invalidatePriceRangeCaches = async () => {
  await Promise.allSettled([
    deletePattern("price-ranges:*"),
    deletePattern("services:*"),
  ]);
};

const getPriceRangeLookupCacheKey = ({ city, serviceIds }) =>
  `price-ranges:booking:v1:${normalizeCity(city)}:${serviceIds.join(",")}`;

const brandMatches = (rangeBrand, vehicleBrand) => {
  const rangeText = normalizeScopeValue(rangeBrand);
  const vehicleText = normalizeScopeValue(vehicleBrand);

  if (!rangeText || !vehicleText) {
    return false;
  }

  return normalizeComparable(rangeText) === normalizeComparable(vehicleText);
};

const modelMatches = (rangeModel, vehicleModel) => {
  const rangeText = normalizeScopeValue(rangeModel);

  if (!rangeText) {
    return true;
  }

  return normalizeComparable(rangeText) === normalizeComparable(vehicleModel);
};

const scopeWhere = (payload = {}) => ({
  city: normalizeCity(payload.city),
  serviceId: payload.serviceId,
  vehicleBrand: normalizeScopeValue(payload.vehicleBrand),
  vehicleModel: normalizeScopeValue(payload.vehicleModel),
  fuelType: payload.fuelType || null,
});

const findDuplicateScopes = async (payload = {}) => {
  const scope = scopeWhere(payload);
  return prisma.cityServicePriceRange.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
  });
};

const removeOlderDuplicates = async (duplicates = []) => {
  const olderIds = duplicates.slice(1).map((item) => item.id);
  if (olderIds.length === 0) return;
  await prisma.cityServicePriceRange.deleteMany({
    where: { id: { in: olderIds } },
  });
};

const listPriceRanges = async (query = {}) => {
  const where = {
    ...(query.city && { city: normalizeCity(query.city) }),
    ...(query.serviceId && { serviceId: query.serviceId }),
    ...(query.vehicleBrand && { vehicleBrand: normalizeScopeValue(query.vehicleBrand) }),
    ...(query.vehicleModel && { vehicleModel: normalizeScopeValue(query.vehicleModel) }),
    ...(query.fuelType && { fuelType: query.fuelType }),
    ...(query.isActive !== undefined && { isActive: query.isActive === "true" }),
  };

  return prisma.cityServicePriceRange.findMany({
    where,
    include: { service: { include: { category: true } } },
    orderBy: [{ city: "asc" }, { createdAt: "desc" }],
  });
};

const getPriceRange = async (id) => {
  const priceRange = await prisma.cityServicePriceRange.findUnique({
    where: { id },
    include: { service: { include: { category: true } } },
  });
  if (!priceRange) throw new ApiError(404, "Price range not found");
  return priceRange;
};

const createPriceRange = async (payload) => {
  if (Number(payload.maxPrice) < Number(payload.minPrice)) {
    throw new ApiError(400, "maxPrice must be greater than or equal to minPrice");
  }

  const service = await prisma.service.findUnique({ where: { id: payload.serviceId } });
  if (!service) throw new ApiError(404, "Service not found");

  if (!normalizeScopeValue(payload.vehicleBrand)) {
    throw new ApiError(400, "Vehicle brand is required for a price range");
  }

  const duplicates = await findDuplicateScopes(payload);
  let priceRange;

  if (duplicates.length > 0) {
    await removeOlderDuplicates(duplicates);
    priceRange = await prisma.cityServicePriceRange.update({
      where: { id: duplicates[0].id },
      data: {
        minPrice: Number(payload.minPrice),
        maxPrice: Number(payload.maxPrice),
        isActive: payload.isActive === undefined ? true : payload.isActive === true || payload.isActive === "true",
      },
      include: { service: { include: { category: true } } },
    });
  } else {
    priceRange = await prisma.cityServicePriceRange.create({
      data: {
        ...scopeWhere(payload),
        minPrice: Number(payload.minPrice),
        maxPrice: Number(payload.maxPrice),
        isActive: payload.isActive === undefined ? true : payload.isActive === true || payload.isActive === "true",
      },
      include: { service: { include: { category: true } } },
    });
  }

  await invalidatePriceRangeCaches();
  return priceRange;
};

const updatePriceRange = async (id, payload) => {
  const existing = await getPriceRange(id);

  if (payload.minPrice !== undefined && payload.maxPrice !== undefined && Number(payload.maxPrice) < Number(payload.minPrice)) {
    throw new ApiError(400, "maxPrice must be greater than or equal to minPrice");
  }

  const nextScope = {
    city: payload.city !== undefined ? payload.city : existing.city,
    serviceId: payload.serviceId !== undefined ? payload.serviceId : existing.serviceId,
    vehicleBrand:
      payload.vehicleBrand !== undefined ? payload.vehicleBrand : existing.vehicleBrand,
    vehicleModel:
      payload.vehicleModel !== undefined ? payload.vehicleModel : existing.vehicleModel,
    fuelType: payload.fuelType !== undefined ? payload.fuelType : existing.fuelType,
  };

  if (!normalizeScopeValue(nextScope.vehicleBrand)) {
    throw new ApiError(400, "Vehicle brand is required for a price range");
  }

  const duplicates = await findDuplicateScopes(nextScope);
  const conflictingDuplicate = duplicates.find((item) => item.id !== id);
  let priceRange;

  if (conflictingDuplicate) {
    await prisma.cityServicePriceRange.deleteMany({
      where: {
        id: {
          in: duplicates
            .filter((item) => item.id !== id && item.id !== conflictingDuplicate.id)
            .map((item) => item.id),
        },
      },
    });

    await prisma.cityServicePriceRange.delete({ where: { id } });
    priceRange = await prisma.cityServicePriceRange.update({
      where: { id: conflictingDuplicate.id },
      data: {
        ...scopeWhere(nextScope),
        ...(payload.minPrice !== undefined && { minPrice: Number(payload.minPrice) }),
        ...(payload.maxPrice !== undefined && { maxPrice: Number(payload.maxPrice) }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive === true || payload.isActive === "true" }),
      },
      include: { service: { include: { category: true } } },
    });
  } else {
    priceRange = await prisma.cityServicePriceRange.update({
      where: { id },
      data: {
        ...(payload.city !== undefined && { city: normalizeCity(payload.city) }),
        ...(payload.serviceId !== undefined && { serviceId: payload.serviceId }),
        ...(payload.vehicleBrand !== undefined && { vehicleBrand: normalizeScopeValue(payload.vehicleBrand) }),
        ...(payload.vehicleModel !== undefined && { vehicleModel: normalizeScopeValue(payload.vehicleModel) }),
        ...(payload.fuelType !== undefined && { fuelType: payload.fuelType || null }),
        ...(payload.minPrice !== undefined && { minPrice: Number(payload.minPrice) }),
        ...(payload.maxPrice !== undefined && { maxPrice: Number(payload.maxPrice) }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive === true || payload.isActive === "true" }),
      },
      include: { service: { include: { category: true } } },
    });
  }

  await invalidatePriceRangeCaches();
  return priceRange;
};

const deletePriceRange = async (id) => {
  await getPriceRange(id);
  const deleted = await prisma.cityServicePriceRange.delete({ where: { id } });
  await invalidatePriceRangeCaches();
  return deleted;
};

const deletePriceRanges = async ({ priceRangeIds = [], deleteAll = false } = {}) => {
  const uniqueIds = [
    ...new Set(
      (Array.isArray(priceRangeIds) ? priceRangeIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  ];

  if (deleteAll !== true && uniqueIds.length === 0) {
    throw new ApiError(400, "Select at least one price range to delete");
  }

  const deleted = await prisma.cityServicePriceRange.deleteMany({
    where: deleteAll === true ? {} : { id: { in: uniqueIds } },
  });

  if (deleteAll !== true && deleted.count === 0) {
    throw new ApiError(404, "No matching price ranges were found");
  }

  await invalidatePriceRangeCaches();
  return { deleted: deleted.count, deleteAll: deleteAll === true };
};

const scoreMatch = (range, vehicle) => {
  let score = 0;

  if (!brandMatches(range.vehicleBrand, vehicle?.brand)) return -1;
  if (!modelMatches(range.vehicleModel, vehicle?.model)) return -1;
  if (range.fuelType && range.fuelType !== vehicle?.fuelType) return -1;

  score += 2;
  if (normalizeScopeValue(range.vehicleModel)) score += 3;
  if (range.fuelType) score += 1;

  return score;
};

const findBestPriceRangesForBooking = async ({ city, services, vehicle }) => {
  const normalizedCity = normalizeCity(city);
  if (!normalizedCity) return new Map();

  const serviceIds = [
    ...new Set(services.map((service) => service.id).filter(Boolean)),
  ].sort();
  if (serviceIds.length === 0) return new Map();

  const cacheKey = getPriceRangeLookupCacheKey({
    city: normalizedCity,
    serviceIds,
  });

  let ranges = await getCache(cacheKey);
  if (!ranges) {
    ranges = await prisma.cityServicePriceRange.findMany({
      where: {
        city: normalizedCity,
        serviceId: { in: serviceIds },
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    await setCache(cacheKey, ranges, PRICE_RANGE_CACHE_TTL_SECONDS);
  }

  const result = new Map();
  for (const service of services) {
    const best = ranges
      .filter((range) => range.serviceId === service.id)
      .map((range) => ({ range, score: scoreMatch(range, vehicle) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return getTimestamp(b.range.createdAt) - getTimestamp(a.range.createdAt);
      })[0]?.range;

    if (best) result.set(service.id, best);
  }

  return result;
};

module.exports = {
  createPriceRange,
  deletePriceRange,
  deletePriceRanges,
  findBestPriceRangesForBooking,
  getPriceRange,
  invalidatePriceRangeCaches,
  listPriceRanges,
  updatePriceRange,
};
