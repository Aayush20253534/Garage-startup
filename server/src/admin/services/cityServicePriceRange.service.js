const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getCache, setCache, deletePattern } = require("../../utils/cache");

const PRICE_RANGE_CACHE_TTL_SECONDS = Number(
  process.env.PRICE_RANGE_CACHE_TTL_SECONDS || 5 * 60,
);
const SUBMISSION_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

const priceRangeInclude = {
  service: { include: { category: true } },
};

const submissionInclude = {
  service: { include: { category: true } },
  submittedBy: {
    select: { id: true, name: true, loginId: true },
  },
  reviewedBy: {
    select: { id: true, name: true, loginId: true },
  },
  approvedPriceRange: {
    select: { id: true, isActive: true },
  },
};

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

const findDuplicateScopes = async (payload = {}, db = prisma) => {
  const scope = scopeWhere(payload);
  return db.cityServicePriceRange.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
  });
};

const removeOlderDuplicates = async (duplicates = [], db = prisma) => {
  const olderIds = duplicates.slice(1).map((item) => item.id);
  if (olderIds.length === 0) return;
  await db.cityServicePriceRange.deleteMany({
    where: { id: { in: olderIds } },
  });
};

const validatePriceRangePayload = async (payload = {}, db = prisma) => {
  if (Number(payload.maxPrice) < Number(payload.minPrice)) {
    throw new ApiError(400, "maxPrice must be greater than or equal to minPrice");
  }

  const service = await db.service.findUnique({ where: { id: payload.serviceId } });
  if (!service) throw new ApiError(404, "Service not found");

  if (!normalizeScopeValue(payload.vehicleBrand)) {
    throw new ApiError(400, "Vehicle brand is required for a price range");
  }
};

const upsertLivePriceRange = async (payload = {}, db = prisma) => {
  const duplicates = await findDuplicateScopes(payload, db);
  const data = {
    minPrice: Number(payload.minPrice),
    maxPrice: Number(payload.maxPrice),
    isActive:
      payload.isActive === undefined
        ? true
        : payload.isActive === true || payload.isActive === "true",
  };

  if (duplicates.length > 0) {
    await removeOlderDuplicates(duplicates, db);
    return db.cityServicePriceRange.update({
      where: { id: duplicates[0].id },
      data,
      include: priceRangeInclude,
    });
  }

  return db.cityServicePriceRange.create({
    data: {
      ...scopeWhere(payload),
      ...data,
    },
    include: priceRangeInclude,
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
    include: priceRangeInclude,
    orderBy: [{ city: "asc" }, { createdAt: "desc" }],
  });
};

const getPriceRange = async (id) => {
  const priceRange = await prisma.cityServicePriceRange.findUnique({
    where: { id },
    include: priceRangeInclude,
  });
  if (!priceRange) throw new ApiError(404, "Price range not found");
  return priceRange;
};

const createPriceRange = async (payload) => {
  await validatePriceRangePayload(payload);
  const priceRange = await upsertLivePriceRange(payload);

  await invalidatePriceRangeCaches();
  return priceRange;
};

const createPriceRangeSubmission = async (payload, submittedBy) => {
  if (!submittedBy?.id || submittedBy.role !== "INTERN") {
    throw new ApiError(403, "Only intern accounts can submit price ranges for review");
  }

  await validatePriceRangePayload(payload);

  return prisma.priceRangeSubmission.create({
    data: {
      ...scopeWhere(payload),
      minPrice: Number(payload.minPrice),
      maxPrice: Number(payload.maxPrice),
      isActive:
        payload.isActive === undefined
          ? true
          : payload.isActive === true || payload.isActive === "true",
      status: "PENDING",
      submittedById: submittedBy.id,
    },
    include: submissionInclude,
  });
};

const listPriceRangeSubmissions = async (query = {}, staff) => {
  if (!staff?.id || !["ADMIN", "INTERN"].includes(staff.role)) {
    throw new ApiError(403, "Staff access is required");
  }

  const normalizedStatus = normalizeText(query.status).toUpperCase();
  const where = {
    ...(staff.role === "INTERN" && { submittedById: staff.id }),
    ...(normalizedStatus && SUBMISSION_STATUSES.has(normalizedStatus) && {
      status: normalizedStatus,
    }),
    ...(query.city && { city: normalizeCity(query.city) }),
  };

  return prisma.priceRangeSubmission.findMany({
    where,
    include: submissionInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 250,
  });
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

const reviewPriceRangeSubmission = async (
  id,
  { decision, rejectionReason },
  reviewedBy,
) => {
  if (!reviewedBy?.id || reviewedBy.role !== "ADMIN") {
    throw new ApiError(403, "Only admins can review price range submissions");
  }

  const nextStatus = normalizeText(decision).toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(nextStatus)) {
    throw new ApiError(400, "Decision must be APPROVED or REJECTED");
  }

  const reviewedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.priceRangeSubmission.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: nextStatus,
        reviewedById: reviewedBy.id,
        reviewedAt,
        rejectionReason:
          nextStatus === "REJECTED"
            ? normalizeText(rejectionReason) || "Not approved by admin"
            : null,
      },
    });

    if (claimed.count !== 1) {
      const existing = await tx.priceRangeSubmission.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) throw new ApiError(404, "Price range submission not found");
      throw new ApiError(409, `Submission is already ${existing.status.toLowerCase()}`);
    }

    const submission = await tx.priceRangeSubmission.findUnique({
      where: { id },
    });

    if (nextStatus === "REJECTED") {
      return tx.priceRangeSubmission.findUnique({
        where: { id },
        include: submissionInclude,
      });
    }

    await validatePriceRangePayload(submission, tx);
    const approvedPriceRange = await upsertLivePriceRange(submission, tx);

    await tx.priceRangeSubmission.updateMany({
      where: {
        id: { not: id },
        status: "PENDING",
        ...scopeWhere(submission),
      },
      data: {
        status: "REJECTED",
        reviewedById: reviewedBy.id,
        reviewedAt,
        rejectionReason:
          "Superseded by an approved submission for the same price scope",
      },
    });

    return tx.priceRangeSubmission.update({
      where: { id },
      data: { approvedPriceRangeId: approvedPriceRange.id },
      include: submissionInclude,
    });
  });

  if (nextStatus === "APPROVED") {
    await invalidatePriceRangeCaches();
  }

  return result;
};

const deletePriceRange = async (id) => {
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.cityServicePriceRange.findUnique({
      where: { id },
      include: priceRangeInclude,
    });
    if (!existing) throw new ApiError(404, "Price range not found");

    await tx.priceRangeSubmission.deleteMany({
      where: { approvedPriceRangeId: id },
    });

    return tx.cityServicePriceRange.delete({ where: { id } });
  });

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

  const rangeWhere = deleteAll === true ? {} : { id: { in: uniqueIds } };
  const result = await prisma.$transaction(async (tx) => {
    const matchedRanges = await tx.cityServicePriceRange.findMany({
      where: rangeWhere,
      select: { id: true },
    });
    const matchedIds = matchedRanges.map((range) => range.id);

    if (deleteAll !== true && matchedIds.length === 0) {
      throw new ApiError(404, "No matching price ranges were found");
    }

    const removedSubmissions = matchedIds.length
      ? await tx.priceRangeSubmission.deleteMany({
          where: { approvedPriceRangeId: { in: matchedIds } },
        })
      : { count: 0 };
    const deleted = await tx.cityServicePriceRange.deleteMany({
      where: rangeWhere,
    });

    return {
      deleted: deleted.count,
      removedSubmissions: removedSubmissions.count,
      deleteAll: deleteAll === true,
    };
  });

  await invalidatePriceRangeCaches();
  return result;
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
  createPriceRangeSubmission,
  deletePriceRange,
  deletePriceRanges,
  findBestPriceRangesForBooking,
  getPriceRange,
  invalidatePriceRangeCaches,
  listPriceRanges,
  listPriceRangeSubmissions,
  reviewPriceRangeSubmission,
  updatePriceRange,
};
