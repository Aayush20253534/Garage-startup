const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getCache, setCache } = require("../../utils/cache");
const cityServicePriceRangeService = require("../../admin/services/cityServicePriceRange.service");
const cityService = require("../../services/city.service");
const {
  buildCategoryAvailabilityWhere,
  buildServiceAvailabilityWhere,
} = require("../../services/serviceCityRestriction.service");
const { filterServicesByAvailabilityRules } = require("../../services/serviceAvailabilityRule.service");

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
  [location?.city, location?.formattedAddress, location?.address]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";

const stripServicePrice = (
  service,
  { pricingStatus = null, priceUnavailableMessage = null } = {},
) => {
  const { basePrice, minPrice, maxPrice, priceRange, ...rest } = service;

  return {
    ...rest,
    ...(priceRange && { priceRange }),
    hasPrice: Boolean(priceRange),
    ...(pricingStatus && { pricingStatus }),
    ...(priceUnavailableMessage && { priceUnavailableMessage }),
  };
};

const getCustomerServiceContext = async (options = {}) => {
  const explicitCity = String(options.city || "").trim();

  if (!options.userId) {
    const vehicleBrandId = String(options.vehicleBrandId || "").trim();
    const vehicleModelId = String(options.vehicleModelId || "").trim();
    const fuelType = String(options.fuelType || "").trim().toUpperCase();
    const useAllModels = vehicleModelId.toUpperCase() === "ALL";

    if (!explicitCity && !vehicleBrandId && !vehicleModelId && !fuelType) {
      return null;
    }
    if (vehicleModelId && !vehicleBrandId) {
      throw new ApiError(400, "Select a vehicle brand before choosing a model");
    }
    if (fuelType && (!vehicleBrandId || !vehicleModelId)) {
      throw new ApiError(400, "Select a vehicle brand and model before fuel type");
    }

    const [city, brand, model] = await Promise.all([
      explicitCity
        ? cityService.requireActiveCityFromLocation(explicitCity)
        : Promise.resolve(null),
      vehicleBrandId
        ? prisma.vehicleBrand.findFirst({
            where: { id: vehicleBrandId, isActive: true },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      vehicleModelId && vehicleBrandId && !useAllModels
        ? prisma.vehicleModel.findFirst({
            where: {
              id: vehicleModelId,
              brandId: vehicleBrandId,
              isActive: true,
              brand: { isActive: true },
            },
            select: {
              id: true,
              name: true,
              brand: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    if (vehicleBrandId && !brand) {
      throw new ApiError(400, "Select a valid vehicle brand");
    }

    if (vehicleModelId && !useAllModels && !model) {
      throw new ApiError(400, "Select a valid model for this vehicle brand");
    }

    return {
      city: city || null,
      vehicle: useAllModels
        ? {
            brand: brand.name,
            // The matcher normalizes model-less allocations as generic and
            // excludes model-specific rows when the requested model is ALL.
            model: "ALL",
            fuelType: fuelType || null,
          }
        : model
          ? {
              brand: model.brand.name,
              model: model.name,
              fuelType: fuelType || null,
            }
          : null,
    };
  }

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

  const cityText =
    explicitCity ||
    (await parseCityFromAddress(
      getLocationAddressText(location) || profile?.address,
    ));

  const city = explicitCity
    ? await cityService.requireActiveCityFromLocation(explicitCity)
    : cityText
      ? await cityService.findActiveCityFromLocation(cityText)
      : null;

  return {
    vehicle: vehicle || null,
    city: city || null,
  };
};

const getUnavailablePricing = (context) => {
  if (!context) return {};

  if (!context.city) {
    return {
      pricingStatus: "CITY_REQUIRED",
      priceUnavailableMessage: "Select a city to view pricing",
    };
  }

  if (!context.vehicle) {
    return {
      pricingStatus: "VEHICLE_REQUIRED",
      priceUnavailableMessage: "Select a vehicle to view pricing",
    };
  }

  return {
    pricingStatus: "NOT_ALLOCATED",
    priceUnavailableMessage: "Price not allocated for this vehicle",
  };
};

const applyContextualPriceRanges = async (services = [], context = null) => {
  if (services.length === 0) return [];

  if (!context?.vehicle || !context?.city) {
    const unavailablePricing = getUnavailablePricing(context);
    return services.map((service) =>
      stripServicePrice(service, unavailablePricing),
    );
  }

  const ranges = await cityServicePriceRangeService.findBestPriceRangesForBooking({
    city: context.city.name,
    services,
    vehicle: context.vehicle,
  });

  return services.map((service) => {
    const range = ranges.get(service.id);

    if (!range) {
      return stripServicePrice(service, getUnavailablePricing(context));
    }

    return stripServicePrice(
      {
        ...service,
        priceRange: {
          min: Number(range.minPrice) || 0,
          max: Number(range.maxPrice) || Number(range.minPrice) || 0,
        },
      },
      { pricingStatus: "AVAILABLE" },
    );
  });
};

const getServiceAvailabilityWhere = (context) =>
  buildServiceAvailabilityWhere(context?.city?.id);

const getServiceCategories = async (options = {}) => {
  const context = await getCustomerServiceContext(options);
  const cacheKey = context ? null : "services:categories:public:v4";

  const cached = cacheKey ? await getCache(cacheKey) : null;
  if (cached) return cached;

  const categories = await prisma.serviceCategory.findMany({
    where: {
      isActive: true,
      ...buildCategoryAvailabilityWhere(context?.city?.id),
    },
    include: {
      services: {
        where: {
          isActive: true,
          ...getServiceAvailabilityWhere(context),
        },
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

  const result = await Promise.all(
    categories.map(async (category) => {
      const availableServices = await filterServicesByAvailabilityRules(
        category.services,
        context || {},
      );
      return {
        ...category,
        services: await applyContextualPriceRanges(availableServices, context),
      };
    }),
  );

  const visibleCategories = context
    ? result.filter((category) => category.services.length > 0)
    : result;

  if (cacheKey) await setCache(cacheKey, visibleCategories, 30 * 60);

  return visibleCategories;
};

const getServices = async (query = {}, options = {}) => {
  const context = await getCustomerServiceContext(options);
  const { categoryId, search, minPrice, maxPrice } = query;

  const safeCategoryId =
    categoryId && categoryId !== "null" && categoryId !== "undefined"
      ? categoryId
      : null;

  const cacheKey = context
    ? null
    : `services:list:public:v4:${JSON.stringify({
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
      ...getServiceAvailabilityWhere(context),
      ...(safeCategoryId && { categoryId: safeCategoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
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

  const availableServices = await filterServicesByAvailabilityRules(services, context || {});
  const contextualServices = await applyContextualPriceRanges(availableServices, context);
  const minPriceValue = Number(minPrice);
  const maxPriceValue = Number(maxPrice);
  const hasMinPrice =
    minPrice !== undefined && minPrice !== "" && Number.isFinite(minPriceValue);
  const hasMaxPrice =
    maxPrice !== undefined && maxPrice !== "" && Number.isFinite(maxPriceValue);

  const result = context && (hasMinPrice || hasMaxPrice)
    ? contextualServices.filter((service) => {
        const range = service.priceRange;
        if (!range) return false;
        if (hasMinPrice && Number(range.min) < minPriceValue) return false;
        if (hasMaxPrice && Number(range.max) > maxPriceValue) return false;
        return true;
      })
    : contextualServices;

  if (cacheKey) await setCache(cacheKey, result, 30 * 60);

  return result;
};

const getServiceById = async (serviceId, options = {}) => {
  const context = await getCustomerServiceContext(options);
  const cacheKey = context ? null : `services:detail:public:v4:${serviceId}`;

  const cached = cacheKey ? await getCache(cacheKey) : null;
  if (cached) return cached;

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      isActive: true,
      ...getServiceAvailabilityWhere(context),
    },
    include: {
      category: true,
      media: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
      },
      garageServices: {
        where: {
          isActive: true,
          garage: { isActive: true },
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
    throw new ApiError(404, "Service not found or unavailable in this city");
  }

  const [availableService] = await filterServicesByAvailabilityRules([service], context || {});
  if (!availableService) {
    throw new ApiError(404, "Service is unavailable for this vehicle, city, or time window");
  }

  const [pricedService] = await applyContextualPriceRanges([availableService], context);

  const result = {
    ...pricedService,
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
