const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");

const INDIA_COORDINATE_BOUNDS = {
  minLatitude: 6,
  maxLatitude: 38,
  minLongitude: 68,
  maxLongitude: 98,
};

const isWithinIndiaBounds = (latitude, longitude) => (
  latitude >= INDIA_COORDINATE_BOUNDS.minLatitude
  && latitude <= INDIA_COORDINATE_BOUNDS.maxLatitude
  && longitude >= INDIA_COORDINATE_BOUNDS.minLongitude
  && longitude <= INDIA_COORDINATE_BOUNDS.maxLongitude
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

  if (!isWithinIndiaBounds(latitude, longitude)) {
    throw new ApiError(400, "Rovauto is available only in India right now.");
  }

  return { latitude, longitude };
};

const syncDefaultLocationToProfile = async (tx, userId, address) => {
  await tx.customerProfile.upsert({
    where: { userId },
    update: { address: address || null },
    create: { userId, address: address || null },
  });
};

const createLocation = async (userId, data) => {
  const coordinates = normalizeAndValidateCoordinates(data);

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
        address: data.address || null,
        source: data.source || "GPS",
        isDefault: shouldBeDefault,
      },
    });

    if (shouldBeDefault) {
      await syncDefaultLocationToProfile(tx, userId, location.address);
    }

    return location;
  });

  if (shouldBeDefault) {
    await invalidateCustomerCache(userId);
  }

  return result;
};

const getMyLocations = async (userId) => {
  const locations = await prisma.customerLocation.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

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
        ...(data.address !== undefined && {
          address: data.address || null,
        }),
        ...(data.source !== undefined && {
          source: data.source,
        }),
        ...(data.isDefault !== undefined && {
          isDefault: shouldBeDefault ? true : data.isDefault,
        }),
      },
    });

    if ((updatedLocation.isDefault || shouldBeDefault) && data.address !== undefined) {
      await syncDefaultLocationToProfile(tx, userId, updatedLocation.address);
    }

    return updatedLocation;
  });

  if ((result.isDefault || shouldBeDefault) && data.address !== undefined) {
    await invalidateCustomerCache(userId);
  }

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

  if (location.isDefault) {
    await invalidateCustomerCache(userId);
  }

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

  await invalidateCustomerCache(userId);

  return result;
};

module.exports = {
  createLocation,
  getMyLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
  setDefaultLocation,
};
