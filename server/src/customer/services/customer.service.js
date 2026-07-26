const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const argon2 = require("argon2");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { getCache, setCache, deleteCache } = require("../../utils/cache");
const { normalizePhone } = require("../../utils/phone");
const cityService = require("../../services/city.service");
const {
  deleteCloudinaryImagesIfUnreferenced,
} = require("../../utils/cloudinaryCleanup");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinaryUpload");

const PROFILE_CACHE_TTL = 5 * 60;
const AVATAR_MAX_BYTES = 7 * 1024 * 1024;
const AVATAR_FOLDER = "rovauto/customer-avatars";

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

  const locationCity = await cityService.requireActiveCityFromLocation(location);
  const locationAddress = cityService.ensureAddressContainsCity(
    location.address || location.city || "",
    locationCity.name,
  );

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
        address: locationAddress || null,
        formattedAddress: locationAddress || null,
        source: "GPS",
        isDefault: true,
      },
    });

    await tx.customerProfile.upsert({
      where: { userId },
      update: {
        address: locationAddress || null,
      },
      create: {
        userId,
        address: locationAddress || null,
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
      where: {
        phone_role: {
          phone: nextPhone,
          role: existingUser.role,
        },
      },
      select: { id: true },
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

const uploadProfileAvatar = async (userId, file) => {
  if (!file) {
    throw new ApiError(400, "Profile picture is required");
  }

  if (!file.mimetype?.startsWith("image/")) {
    throw new ApiError(400, "Profile picture must be an image");
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new ApiError(400, "Profile picture must be 7 MB or smaller");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      customerProfile: {
        select: { avatarPublicId: true },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const uploaded = await uploadToCloudinary(
    file.buffer,
    AVATAR_FOLDER,
    "image",
  );

  try {
    await prisma.customerProfile.upsert({
      where: { userId },
      update: {
        avatarUrl: uploaded.secure_url,
        avatarPublicId: uploaded.public_id,
      },
      create: {
        userId,
        avatarUrl: uploaded.secure_url,
        avatarPublicId: uploaded.public_id,
      },
    });
  } catch (error) {
    await deleteCloudinaryImagesIfUnreferenced([uploaded.public_id]);
    throw error;
  }

  await invalidateProfileCaches(userId);

  if (
    user.customerProfile?.avatarPublicId &&
    user.customerProfile.avatarPublicId !== uploaded.public_id
  ) {
    await deleteCloudinaryImagesIfUnreferenced([
      user.customerProfile.avatarPublicId,
    ]);
  }

  return getProfile(userId);
};

const deleteAccount = async (userId, { password }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      password: true,
      customerProfile: {
        select: { avatarPublicId: true },
      },
      bookings: {
        select: {
          inspectionImages: { select: { publicId: true, mediaType: true } },
        },
      },
      complaints: {
        select: { images: { select: { publicId: true } } },
      },
      supportTickets: {
        select: { attachments: { select: { publicId: true } } },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await argon2.verify(user.password, password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password is incorrect");
  }

  const inspectionMedia = user.bookings.flatMap(
    (booking) => booking.inspectionImages,
  );
  const publicIds = [
    user.customerProfile?.avatarPublicId,
    ...inspectionMedia
      .filter((item) => item.mediaType !== "VIDEO")
      .map((item) => item.publicId),
    ...user.complaints.flatMap((complaint) =>
      complaint.images.map((image) => image.publicId),
    ),
    ...user.supportTickets.flatMap((ticket) =>
      ticket.attachments.map((attachment) => attachment.publicId),
    ),
  ].filter(Boolean);
  const inspectionVideoPublicIds = inspectionMedia
    .filter((item) => item.mediaType === "VIDEO")
    .map((item) => item.publicId)
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    // These records intentionally have no User foreign key, so remove them
    // explicitly before the account row. All normal customer relations,
    // including notifications, sessions, bookings, wallet, vehicles and
    // support tickets, are then deleted by their database cascades.
    await tx.emailOtp.deleteMany({ where: { email: user.email } });

    if (user.phone) {
      await tx.phoneOtp.deleteMany({ where: { phone: user.phone } });
    }

    await tx.pendingSignup.deleteMany({
      where: {
        role: "CUSTOMER",
        OR: [
          { email: user.email },
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
      },
    });
    await tx.staffLoginChallenge.deleteMany({ where: { accountId: userId } });
    await tx.systemIssue.deleteMany({ where: { userId } });
    await tx.customerSupportEmailLog.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await invalidateProfileCaches(userId);
  await Promise.all([
    deleteCloudinaryImagesIfUnreferenced(publicIds),
    Promise.allSettled(
      [...new Set(inspectionVideoPublicIds)].map((publicId) =>
        deleteFromCloudinary(publicId, "video"),
      ),
    ),
  ]);

  return {
    deleted: true,
  };
};

module.exports = {
  completeOnboarding,
  getProfile,
  updateProfile,
  uploadProfileAvatar,
  deleteAccount,
};
