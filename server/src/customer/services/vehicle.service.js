const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { getCache, setCache, deleteCache } = require("../../utils/cache");
const {
  normalizeRegistrationNumber,
  verifyRegistration,
  getRegistrationRequirement,
  getVerifiedRegistrationData,
  toVehicleVerificationFields,
  clearedVehicleVerificationFields,
} = require("./vehicleRegistration.service");

const VEHICLES_CACHE_TTL = 5 * 60;

const getVehiclesCacheKey = (userId) => {
  return `customer:${userId}:vehicles`;
};

const invalidateVehicleCaches = async (userId) => {
  await Promise.all([
    deleteCache(getVehiclesCacheKey(userId)),
    invalidateCustomerCache(userId),
  ]);
};

const ensureRegistrationForCreate = async (userId, data) => {
  const registrationRequired = await getRegistrationRequirement(prisma, userId);
  const registrationNumber = normalizeRegistrationNumber(data.registrationNumber);

  if (registrationRequired && !registrationNumber) {
    throw new ApiError(
      400,
      "Registration number verification is required for your vehicle",
    );
  }

  if (!registrationNumber) {
    return {
      registrationRequired,
      registrationNumber: null,
      verificationFields: clearedVehicleVerificationFields(),
    };
  }

  const verification = await getVerifiedRegistrationData({
    registrationNumber,
    brand: data.brand,
    model: data.model,
    fuelType: data.fuelType,
  });

  return {
    registrationRequired,
    registrationNumber,
    verificationFields: toVehicleVerificationFields(verification),
  };
};

const createVehicle = async (userId, data) => {
  const [vehicleCount, registration] = await Promise.all([
    prisma.vehicle.count({ where: { userId } }),
    ensureRegistrationForCreate(userId, data),
  ]);

  const shouldBeDefault = data.isDefault === true || vehicleCount === 0;

  const result = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.vehicle.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return tx.vehicle.create({
      data: {
        userId,
        brand: data.brand,
        model: data.model,
        year: Number(data.year),
        fuelType: data.fuelType,
        registrationNumber: registration.registrationNumber,
        ...registration.verificationFields,
        isDefault: shouldBeDefault,
      },
    });
  });

  await invalidateVehicleCaches(userId);

  return result;
};

const getMyVehicles = async (userId) => {
  const cacheKey = getVehiclesCacheKey(userId);

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const vehicles = await prisma.vehicle.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  await setCache(cacheKey, vehicles, VEHICLES_CACHE_TTL);

  return vehicles;
};

const getVehicleById = async (userId, vehicleId) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      userId,
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  return vehicle;
};

const updateVehicle = async (userId, vehicleId, data) => {
  const [existingVehicle, registrationRequired] = await Promise.all([
    prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        userId,
      },
    }),
    getRegistrationRequirement(prisma, userId),
  ]);

  if (!existingVehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  const registrationTouched = data.registrationNumber !== undefined;
  const identityTouched =
    data.brand !== undefined || data.model !== undefined || data.fuelType !== undefined;
  const effectiveRegistrationNumber = registrationTouched
    ? normalizeRegistrationNumber(data.registrationNumber)
    : normalizeRegistrationNumber(existingVehicle.registrationNumber);
  const effectiveVehicle = {
    brand: data.brand ?? existingVehicle.brand,
    model: data.model ?? existingVehicle.model,
    fuelType: data.fuelType ?? existingVehicle.fuelType,
  };

  if (registrationRequired && !effectiveRegistrationNumber) {
    throw new ApiError(
      400,
      "Registration number verification is required for your vehicle",
    );
  }

  let verificationFields = null;

  const mustVerify =
    Boolean(effectiveRegistrationNumber) &&
    (registrationTouched ||
      (existingVehicle.registrationVerified && identityTouched) ||
      (registrationRequired && !existingVehicle.registrationVerified));

  if (mustVerify) {
    const verification = await getVerifiedRegistrationData({
      registrationNumber: effectiveRegistrationNumber,
      ...effectiveVehicle,
    });
    verificationFields = toVehicleVerificationFields(verification);
  } else if (registrationTouched && !effectiveRegistrationNumber) {
    verificationFields = clearedVehicleVerificationFields();
  }

  const shouldBeDefault = data.isDefault === true;

  const result = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.vehicle.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.year !== undefined && { year: Number(data.year) }),
        ...(data.fuelType !== undefined && { fuelType: data.fuelType }),
        ...(registrationTouched && {
          registrationNumber: effectiveRegistrationNumber || null,
        }),
        ...(verificationFields || {}),
        ...(data.isDefault !== undefined && {
          isDefault: shouldBeDefault ? true : data.isDefault,
        }),
      },
    });
  });

  await invalidateVehicleCaches(userId);

  return result;
};

const verifyVehicleRegistration = async (userId, data) => {
  // Resolve the customer first so this endpoint cannot be used as an anonymous
  // registration lookup proxy even if route middleware changes later.
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "CUSTOMER", isActive: true },
    select: { id: true, vehicleRegistrationRequired: true },
  });
  if (!user) throw new ApiError(404, "Customer not found");

  return verifyRegistration({
    registrationNumber: data.registrationNumber,
    brand: data.brand,
    model: data.model,
    fuelType: data.fuelType,
  });
};

const deleteVehicle = async (userId, vehicleId) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      userId,
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  const bookingCount = await prisma.booking.count({
    where: { vehicleId },
  });

  if (bookingCount > 0) {
    throw new ApiError(
      400,
      "Vehicle cannot be deleted because it is linked to bookings",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehicle.delete({
      where: { id: vehicleId },
    });

    if (vehicle.isDefault) {
      const nextVehicle = await tx.vehicle.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      if (nextVehicle) {
        await tx.vehicle.update({
          where: { id: nextVehicle.id },
          data: { isDefault: true },
        });
      }
    }
  });

  await invalidateVehicleCaches(userId);

  return {
    deleted: true,
  };
};

const setDefaultVehicle = async (userId, vehicleId) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      userId,
    },
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.vehicle.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    return tx.vehicle.update({
      where: { id: vehicleId },
      data: { isDefault: true },
    });
  });

  await invalidateVehicleCaches(userId);

  return result;
};

module.exports = {
  createVehicle,
  getMyVehicles,
  getVehicleById,
  updateVehicle,
  verifyVehicleRegistration,
  deleteVehicle,
  setDefaultVehicle,
};
