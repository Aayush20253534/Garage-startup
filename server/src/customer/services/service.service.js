const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getCache, setCache } = require("../../utils/cache");
const cityServicePriceRangeService = require("../../admin/services/cityServicePriceRange.service");

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const parseCityFromAddress = async (address = "") => {
  const addressKey = normalizeText(address);
  if (!addressKey) return "";

  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { name: true, normalizedName: true },
  });

  const matchedCity = cities
    .filter((city) => {
      const keys = [city.normalizedName, city.name].map(normalizeText);
      return keys.some((key) => key && addressKey.includes(key));
    })
    .sort((a, b) => normalizeText(b.name).length - normalizeText(a.name).length)[0];

  if (matchedCity?.name) return matchedCity.name;

  const parts = String(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\b\d{5,6}\b/g, "").trim())
    .filter(Boolean);

  return parts[parts.length - 1] || "";
};

const getLocationAddressText = (location = null) =>
  [
    location?.city,
    location?.formattedAddress,
    location?.address,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";

const stripServicePrice = (service) => {
  const { basePrice, minPrice, maxPrice, priceRange, ...rest } = service;
  return {
    ...rest,
    ...(priceRange && { priceRange }),
    hasPrice: Boolean(priceRange),
  };
};

const getCustomerPricingContext = async (options = {}) => {
  if (!options.userId) return null;

  const [vehicle, location, profile] = await Promise.all([
    options.vehicleId
      ? prisma.vehicle.findFirst({
          where: { id: options.vehicleId, userId: options.userId },
        })
      : prisma.vehicle.findFirst({
          where: { userId: options.userId },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        }),
    options.city
      ? Promise.resolve({ city: options.city })
      : prisma.customerLocation.findFirst({
          where: { userId: options.userId },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        }),
    prisma.customerProfile.findUnique({
      where: { userId: options.userId },
      select: { address: true },
    }),
  ]);

  const city =
    String(options.city || "").trim() ||
    (await parseCityFromAddress(
      getLocationAddressText(location) || profile?.address,
    ));
  if (!vehicle || !city) return null;

  return {
    vehicle,
    city,
  };
};

const applyContextualPriceRanges = async (services = [], context = null) => {
  if (!context?.vehicle || !context?.city || services.length === 0) {
    return services.map((service) => stripServicePrice(service));
  }

  const ranges = await cityServicePriceRangeService.findBestPriceRangesForBooking({
    city: context.city,
    services,
    vehicle: context.vehicle,
  });

  return services.map((service) => {
    const range = ranges.get(service.id);
    if (!range) return stripServicePrice(service);

    return stripServicePrice({
      ...service,
      priceRange: {
        min: Number(range.minPrice) || 0,
        max: Number(range.maxPrice) || Number(range.minPrice) || 0,
      },
    });
  });
};

const getServiceCategories = async (options = {}) => {
  const context = await getCustomerPricingContext(options);

  if (context) {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      include: {
        services: {
          where: { isActive: true },
          include: {
            media: {
              orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
            },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return Promise.all(
      categories.map(async (category) => ({
        ...category,
        services: await applyContextualPriceRanges(category.services, context),
      })),
    );
  }

  const cacheKey = "services:categories:public:v2";

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const categories = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    include: {
      services: {
        where: { isActive: true },
        include: {
          media: {
            orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = categories.map((category) => ({
    ...category,
    services: category.services.map(stripServicePrice),
  }));

  await setCache(cacheKey, result, 30 * 60);

  return result;
};

const getServices = async (query = {}, options = {}) => {
  const context = await getCustomerPricingContext(options);
  const { categoryId, search, minPrice, maxPrice } = query;

  const safeCategoryId =
    categoryId && categoryId !== "null" && categoryId !== "undefined"
      ? categoryId
      : null;

  const cacheKey = context
    ? null
    : `services:list:public:v2:${JSON.stringify({
    categoryId: safeCategoryId,
    search: search || "",
    minPrice: minPrice || "",
    maxPrice: maxPrice || "",
  })}`;

  const cached = cacheKey ? await getCache(cacheKey) : null;
  if (cached) return cached;

  const services = await prisma.service.findMany({
    where: {
      isActive: true,

      ...(safeCategoryId && {
        categoryId: safeCategoryId,
      }),

      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),

      ...(minPrice && {
        OR: [
          { basePrice: { gte: Number(minPrice) } },
          { minPrice: { gte: Number(minPrice) } },
        ],
      }),

      ...(maxPrice && {
        OR: [
          { basePrice: { lte: Number(maxPrice) } },
          { maxPrice: { lte: Number(maxPrice) } },
        ],
      }),
    },
    include: {
      category: true,
      media: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const result = await applyContextualPriceRanges(services, context);

  if (cacheKey) await setCache(cacheKey, result, 30 * 60);

  return result;
};

const getServiceById = async (serviceId, options = {}) => {
  const context = await getCustomerPricingContext(options);
  const cacheKey = context ? null : `services:detail:public:v2:${serviceId}`;

  const cached = cacheKey ? await getCache(cacheKey) : null;
  if (cached) return cached;

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      isActive: true,
    },
    include: {
      category: true,
      media: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
      },
      garageServices: {
        where: {
          isActive: true,
          garage: {
            isActive: true,
          },
        },
        include: {
          garage: {
            select: {
              id: true,
              name: true,
              area: true,
              city: true,
              isVerified: true,
              ratingAvg: true,
              ratingCount: true,
            },
          },
        },
      },
    },
  });

  if (!service) {
    throw new ApiError(404, "Service not found");
  }

  const result = {
    ...(await applyContextualPriceRanges([service], context))[0],
    thumbnail: service.media.find((item) => item.isThumbnail) || null,
  };

  if (cacheKey) await setCache(cacheKey, result, 30 * 60);

  return result;
};

module.exports = {
  getServiceCategories,
  getServices,
  getServiceById,
};
