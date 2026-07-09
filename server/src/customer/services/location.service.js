const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const cityService = require("../../services/city.service");
const { getCache, setCache, deleteCache } = require("../../utils/cache");

const LOCATIONS_CACHE_TTL_SECONDS = Number(
  process.env.LOCATIONS_CACHE_TTL_SECONDS || 5 * 60,
);

const SERVICE_AREA_BOUNDS = [
  { minLatitude: 26, maxLatitude: 31, minLongitude: 80, maxLongitude: 89 },
  { minLatitude: 6, maxLatitude: 38, minLongitude: 68, maxLongitude: 98 },
];

const isWithinServiceArea = (latitude, longitude) =>
  SERVICE_AREA_BOUNDS.some(
    (bounds) =>
      latitude >= bounds.minLatitude &&
      latitude <= bounds.maxLatitude &&
      longitude >= bounds.minLongitude &&
      longitude <= bounds.maxLongitude,
  );

const normalizeAndValidateCoordinates = (data, fallback = {}) => {
  const latitude = Number(data.latitude !== undefined ? data.latitude : fallback.latitude);
  const longitude = Number(data.longitude !== undefined ? data.longitude : fallback.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ApiError(400, "Valid location coordinates are required");
  }

  if (latitude === 0 && longitude === 0) {
    throw new ApiError(400, "Invalid location coordinates. Please choose your location again.");
  }

  if (!isWithinServiceArea(latitude, longitude)) {
    throw new ApiError(400, "Rovauto is not available at this location yet.");
  }

  return { latitude, longitude };
};

const normalizeLocationAddress = async (data = {}, fallback = {}) => {
  const city = await cityService.requireActiveCityFromLocation({
    ...fallback,
    ...data,
    addressComponents: data.addressComponents || fallback.addressComponents,
    address:
      data.address ||
      data.formattedAddress ||
      fallback.address ||
      fallback.formattedAddress,
    formattedAddress:
      data.formattedAddress ||
      data.address ||
      fallback.formattedAddress ||
      fallback.address,
  });

  const rawAddress =
    data.formattedAddress ||
    data.address ||
    fallback.formattedAddress ||
    fallback.address ||
    city.name;
  const address = cityService.ensureAddressContainsCity(rawAddress, city.name);

  return {
    cityName: city.name,
    address,
  };
};

const syncDefaultLocationToProfile = async (tx, userId, address) => {
  await tx.customerProfile.upsert({
    where: { userId },
    update: { address: address || null },
    create: { userId, address: address || null },
  });
};

const getLocationsCacheKey = (userId) => `customer:${userId}:locations`;

const invalidateLocationCaches = async (userId) => {
  await Promise.allSettled([
    deleteCache(getLocationsCacheKey(userId)),
    invalidateCustomerCache(userId),
  ]);
};

const createLocation = async (userId, data) => {
  const coordinates = normalizeAndValidateCoordinates(data);
  const normalizedAddress = await normalizeLocationAddress(data);

  const locationCount = await prisma.customerLocation.count({
    where: { userId },
  });

  const shouldBeDefault = data.isDefault === true || locationCount === 0;

  const result = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.customerLocation.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const location = await tx.customerLocation.create({
      data: {
        userId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address: normalizedAddress.address || null,
        formattedAddress: normalizedAddress.address || null,
        placeId: data.placeId || null,
        addressComponents: data.addressComponents || undefined,
        source: data.source || "GPS",
        isDefault: shouldBeDefault,
      },
    });

    if (shouldBeDefault) {
      await syncDefaultLocationToProfile(tx, userId, location.address);
    }

    return location;
  });

  await invalidateLocationCaches(userId);

  return result;
};

const getMyLocations = async (userId) => {
  const cacheKey = getLocationsCacheKey(userId);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const locations = await prisma.customerLocation.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  await setCache(cacheKey, locations, LOCATIONS_CACHE_TTL_SECONDS);
  return locations;
};

const getLocationById = async (userId, locationId) => {
  const location = await prisma.customerLocation.findFirst({
    where: {
      id: locationId,
      userId,
    },
  });

  if (!location) {
    throw new ApiError(404, "Location not found");
  }

  return location;
};

const updateLocation = async (userId, locationId, data) => {
  const existingLocation = await prisma.customerLocation.findFirst({
    where: {
      id: locationId,
      userId,
    },
  });

  if (!existingLocation) {
    throw new ApiError(404, "Location not found");
  }

  const shouldBeDefault = data.isDefault === true;
  const coordinates = data.latitude !== undefined || data.longitude !== undefined
    ? normalizeAndValidateCoordinates(data, existingLocation)
    : null;
  const hasAddressUpdate =
    data.address !== undefined ||
    data.formattedAddress !== undefined ||
    data.city !== undefined ||
    data.addressComponents !== undefined;
  const normalizedAddress = hasAddressUpdate
    ? await normalizeLocationAddress(data, existingLocation)
    : null;

  const result = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.customerLocation.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const updatedLocation = await tx.customerLocation.update({
      where: { id: locationId },
      data: {
        ...(coordinates && { latitude: coordinates.latitude }),
        ...(coordinates && { longitude: coordinates.longitude }),
        ...(normalizedAddress && {
          address: normalizedAddress.address || null,
          formattedAddress: normalizedAddress.address || null,
        }),
        ...(data.placeId !== undefined && {
          placeId: data.placeId || null,
        }),
        ...(data.addressComponents !== undefined && {
          addressComponents: data.addressComponents || undefined,
        }),
        ...(data.source !== undefined && {
          source: data.source,
        }),
        ...(data.isDefault !== undefined && {
          isDefault: shouldBeDefault ? true : data.isDefault,
        }),
      },
    });

    if ((updatedLocation.isDefault || shouldBeDefault) && normalizedAddress) {
      await syncDefaultLocationToProfile(tx, userId, updatedLocation.address);
    }

    return updatedLocation;
  });

  await invalidateLocationCaches(userId);

  return result;
};

const deleteLocation = async (userId, locationId) => {
  const location = await prisma.customerLocation.findFirst({
    where: {
      id: locationId,
      userId,
    },
  });

  if (!location) {
    throw new ApiError(404, "Location not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerLocation.delete({
      where: { id: locationId },
    });

    if (location.isDefault) {
      const nextLocation = await tx.customerLocation.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      if (nextLocation) {
        await tx.customerLocation.update({
          where: { id: nextLocation.id },
          data: { isDefault: true },
        });
      }

      await syncDefaultLocationToProfile(tx, userId, nextLocation?.address || null);
    }
  });

  await invalidateLocationCaches(userId);

  return {
    deleted: true,
  };
};

const setDefaultLocation = async (userId, locationId) => {
  const location = await prisma.customerLocation.findFirst({
    where: {
      id: locationId,
      userId,
    },
  });

  if (!location) {
    throw new ApiError(404, "Location not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.customerLocation.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    const updatedLocation = await tx.customerLocation.update({
      where: { id: locationId },
      data: { isDefault: true },
    });

    await syncDefaultLocationToProfile(tx, userId, updatedLocation.address);

    return updatedLocation;
  });

  await invalidateLocationCaches(userId);

  return result;
};

module.exports = {
  createLocation,
  getMyLocations,
  invalidateLocationCaches,
  getLocationById,
  updateLocation,
  deleteLocation,
  setDefaultLocation,
};
