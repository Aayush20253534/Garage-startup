const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");

const normalizeRestrictedCityIds = (values = []) => {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
};

const ensureRestrictedCitiesExist = async (cityIds = [], { tx = prisma } = {}) => {
  const normalizedIds = normalizeRestrictedCityIds(cityIds);
  if (normalizedIds.length === 0) return normalizedIds;

  const cities = await tx.city.findMany({
    where: { id: { in: normalizedIds } },
    select: { id: true },
  });

  if (cities.length !== normalizedIds.length) {
    throw new ApiError(400, "One or more restricted cities are invalid");
  }

  return normalizedIds;
};

const buildCategoryAvailabilityWhere = (cityId) => {
  const normalizedCityId = String(cityId || "").trim();
  if (!normalizedCityId) return {};

  return {
    cityRestrictions: {
      none: {
        cityId: normalizedCityId,
      },
    },
  };
};

const buildServiceAvailabilityWhere = (cityId) => {
  const normalizedCityId = String(cityId || "").trim();
  if (!normalizedCityId) return {};

  return {
    cityRestrictions: {
      none: {
        cityId: normalizedCityId,
      },
    },
    category: buildCategoryAvailabilityWhere(normalizedCityId),
  };
};

module.exports = {
  buildCategoryAvailabilityWhere,
  buildServiceAvailabilityWhere,
  ensureRestrictedCitiesExist,
  normalizeRestrictedCityIds,
};
