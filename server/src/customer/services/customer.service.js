const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const argon2 = require("argon2");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { getCache, setCache, deleteCache } = require("../../utils/cache");
const { normalizePhone } = require("../../utils/phone");

const PROFILE_CACHE_TTL = 5 * 60;

const withUserAccountType = (user) =>
  user
    ? {
        ...user,
        accountType: "USER",
      }
    : user;

const getProfileCacheKey = (userId) => {
  return `customer:${userId}:profile`;
};

const invalidateProfileCaches = async (userId) => {
  await Promise.all([
    deleteCache(getProfileCacheKey(userId)),
    invalidateCustomerCache(userId),
  ]);
};

const completeOnboarding = async (userId, { vehicle, location }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(403, "Please verify email before onboarding");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.vehicle.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    await tx.customerLocation.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    const createdVehicle = await tx.vehicle.create({
      data: {
        userId,
        brand: vehicle.brand,
        model: vehicle.model,
        year: Number(vehicle.year),
        fuelType: vehicle.fuelType,
        registrationNumber: vehicle.registrationNumber || null,
        isDefault: true,
      },
    });

    const createdLocation = await tx.customerLocation.create({
      data: {
        userId,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        address: location.address || null,
        source: "GPS",
        isDefault: true,
      },
    });

    await tx.customerProfile.upsert({
      where: { userId },
      update: {
        address: location.address || null,
      },
      create: {
        userId,
        address: location.address || null,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        isOnboarded: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        isOnboarded: true,
      },
    });

    return {
      user: withUserAccountType(updatedUser),
      vehicle: createdVehicle,
      location: createdLocation,
    };
  });

  await invalidateProfileCaches(userId);

  return result;
};

const getProfile = async (userId) => {
  const cacheKey = getProfileCacheKey(userId);

  const cached = await getCache(cacheKey);
  if (cached) return withUserAccountType(cached);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      isOnboarded: true,
      isActive: true,

      customerProfile: true,

      vehicles: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },

      locations: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },

      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const profile = withUserAccountType(user);

  await setCache(cacheKey, profile, PROFILE_CACHE_TTL);

  return profile;
};

const updateProfile = async (userId, data) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customerProfile: true,
    },
  });

  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  const nextPhone =
    data.phone !== undefined && String(data.phone).trim()
      ? normalizePhone(data.phone)
      : data.phone === ""
        ? null
        : undefined;

  if (nextPhone && nextPhone !== existingUser.phone) {
    const phoneExists = await prisma.user.findUnique({
      where: { phone: nextPhone },
    });

    if (phoneExists && phoneExists.id !== userId) {
      throw new ApiError(409, "Phone number already in use");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(nextPhone !== undefined && {
          phone: nextPhone,
          isPhoneVerified: false,
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isOnboarded: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const updatedProfile = await tx.customerProfile.upsert({
      where: { userId },
      update: {
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.avatarUrl !== undefined && {
          avatarUrl: data.avatarUrl || null,
        }),
      },
      create: {
        userId,
        address: data.address || null,
        avatarUrl: data.avatarUrl || null,
      },
    });

    if (data.address !== undefined) {
      await tx.customerLocation.updateMany({
        where: { userId, isDefault: true },
        data: { address: data.address || null },
      });
    }

    return withUserAccountType({
      ...updatedUser,
      customerProfile: updatedProfile,
    });
  });

  await invalidateProfileCaches(userId);

  return result;
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await argon2.verify(user.password, currentPassword);

  if (!isPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const isSamePassword = await argon2.verify(user.password, newPassword);

  if (isSamePassword) {
    throw new ApiError(400, "New password cannot be same as current password");
  }

  const hashedPassword = await argon2.hash(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
    },
  });

  await invalidateProfileCaches(userId);

  return {
    changed: true,
  };
};

const deleteAccount = async (userId, { password }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await argon2.verify(user.password, password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password is incorrect");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
    },
  });

  await invalidateProfileCaches(userId);

  return {
    deleted: true,
  };
};

module.exports = {
  completeOnboarding,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
