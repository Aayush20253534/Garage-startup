const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getCache, setCache, deletePattern } = require("../../utils/cache");

const CACHE_TTL_SECONDS = Number(
  process.env.CITY_PRICE_DISCOUNT_CACHE_TTL_SECONDS || 5 * 60,
);

const normalizeText = (value) => String(value || "").trim();
const normalizeCity = (value) => normalizeText(value).toLowerCase();
const cacheKeyForCity = (city) => `city-price-discount:${normalizeCity(city)}`;

const actorSelect = {
  id: true,
  name: true,
  loginId: true,
  email: true,
  role: true,
};

const include = {
  city: {
    select: {
      id: true,
      name: true,
      normalizedName: true,
      state: true,
      isActive: true,
    },
  },
  createdBy: { select: actorSelect },
  updatedBy: { select: actorSelect },
};

const invalidateCityPriceDiscountCaches = async () => {
  await Promise.allSettled([
    deletePattern("city-price-discount:*"),
    deletePattern("price-ranges:*"),
    deletePattern("services:*"),
  ]);
};

const listCityPriceDiscounts = async () =>
  prisma.cityPriceDiscount.findMany({
    include,
    orderBy: [{ city: { name: "asc" } }],
  });

const getActiveCityPriceDiscount = async (cityName) => {
  const normalizedCity = normalizeCity(cityName);
  if (!normalizedCity) return null;

  const cacheKey = cacheKeyForCity(normalizedCity);
  const cached = await getCache(cacheKey);
  if (cached !== null && cached !== undefined) return cached || null;

  const discount = await prisma.cityPriceDiscount.findFirst({
    where: {
      isActive: true,
      city: {
        isActive: true,
        OR: [
          { normalizedName: normalizedCity },
          { name: { equals: normalizeText(cityName), mode: "insensitive" } },
        ],
      },
    },
    include: {
      city: { select: { id: true, name: true, normalizedName: true } },
    },
  });

  await setCache(cacheKey, discount || false, CACHE_TTL_SECONDS);
  return discount || null;
};

const upsertCityPriceDiscount = async (payload = {}, actor = null) => {
  if (!actor?.id || !["ADMIN", "SUB_ADMIN"].includes(actor.role)) {
    throw new ApiError(403, "Only admin accounts can manage city discounts");
  }

  const cityId = normalizeText(payload.cityId);
  const discountPercent = Number(payload.discountPercent);
  const isActive = payload.isActive !== false && payload.isActive !== "false";

  if (!cityId) throw new ApiError(400, "City is required");
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 1 ||
    discountPercent > 90
  ) {
    throw new ApiError(400, "Discount percentage must be between 1 and 90");
  }

  const city = await prisma.city.findFirst({
    where: { id: cityId, isActive: true },
    select: { id: true, name: true },
  });
  if (!city) throw new ApiError(404, "Active city not found");

  const existing = await prisma.cityPriceDiscount.findUnique({
    where: { cityId },
    select: { id: true, createdById: true },
  });

  const discount = await prisma.cityPriceDiscount.upsert({
    where: { cityId },
    create: {
      cityId,
      discountPercent,
      isActive,
      createdById: actor.id,
      updatedById: actor.id,
    },
    update: {
      discountPercent,
      isActive,
      updatedById: actor.id,
      ...(!existing?.createdById && { createdById: actor.id }),
    },
    include,
  });

  await invalidateCityPriceDiscountCaches();
  return discount;
};

const applyCityDiscountToRange = (range, discount) => {
  const percent = Number(discount?.discountPercent);
  if (
    !range ||
    !discount?.isActive ||
    !Number.isInteger(percent) ||
    percent < 1 ||
    percent > 90
  ) {
    return range;
  }

  const regularMinPrice = Math.max(0, Number(range.minPrice) || 0);
  const regularMaxPrice = Math.max(
    regularMinPrice,
    Number(range.maxPrice) || regularMinPrice,
  );
  const multiplier = (100 - percent) / 100;
  const minPrice = Math.max(0, Math.round(regularMinPrice * multiplier));
  const maxPrice = Math.max(minPrice, Math.round(regularMaxPrice * multiplier));

  return {
    ...range,
    minPrice,
    maxPrice,
    regularMinPrice,
    regularMaxPrice,
    discountPercent: percent,
    discountCityId: discount.cityId,
  };
};

module.exports = {
  applyCityDiscountToRange,
  getActiveCityPriceDiscount,
  invalidateCityPriceDiscountCaches,
  listCityPriceDiscounts,
  upsertCityPriceDiscount,
};
