const argon2 = require("argon2");
const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deleteGaragesDeep } = require("../../admin/services/garageDeletion.service");
const {
  GARAGE_MINIMUM_ACTIVATION_RECHARGE,
} = require("../constants");
const geocodingService = require("../../customer/services/geocoding.service");
const {
  createDeleteAccountOtp,
  verifyDeleteAccountOtp,
} = require("../../customer/services/otp.service");

const getGarageForOwner = async (userId, options = {}) => {
  const garage = await prisma.garage.findFirst({
    where: {
      ownerId: userId,
      ...(options.requireActive ? { isActive: true } : {}),
    },
    include: options.include,
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found for this owner");
  }

  return garage;
};

const getGarageOwnerProfile = async (userId) => {
  const garage = await getGarageForOwner(userId, {
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      wallet: true,
      images: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
      },
      reviews: {
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              name: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingCode: true,
              customerAcceptedAt: true,
              createdAt: true,
              vehicle: {
                select: {
                  brand: true,
                  model: true,
                  registrationNumber: true,
                },
              },
              services: {
                include: {
                  service: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          bookings: true,
          services: true,
          reviews: true,
        },
      },
    },
  });

  return {
    ...garage,
    reviewCount: garage.ratingCount || garage._count?.reviews || 0,
    recentReviews: garage.reviews || [],
    activation: {
      minimumBalance: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      minimumActivationAmount: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      walletBalance: garage.wallet?.balance || 0,
      photoCount: garage.images?.length || 0,
      hasMinimumBalance:
        garage.isActive ||
        (garage.wallet?.balance || 0) >= GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      hasActivationBalance:
        garage.isActive ||
        (garage.wallet?.balance || 0) >= GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      isActive: garage.isActive,
    },
  };
};

const serializeGarageService = (garageService) => {
  const service = garageService.service;
  return {
    ...garageService,
    service: service
      ? {
          ...service,
          minPrice: service.minPrice ?? service.basePrice ?? null,
          maxPrice: service.maxPrice ?? service.basePrice ?? null,
        }
      : service,
  };
};

const getGarageOwnerServices = async (userId) => {
  const garage = await getGarageForOwner(userId);

  const services = await prisma.garageService.findMany({
    where: {
      garageId: garage.id,
      isActive: true,
    },
    include: {
      service: {
        include: {
          category: true,
          media: {
            orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return services.map(serializeGarageService);
};

const normalizeGarageType = (value) =>
  String(value || "MULTI_BRAND").trim().toUpperCase() === "AUTHORIZED"
    ? "AUTHORIZED"
    : "MULTI_BRAND";

const normalizeSupportedBrands = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    }
  } catch {
    // Form submissions may send a comma-separated string.
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const updateGarageOwnerProfile = async (userId, payload = {}) => {
  const garage = await getGarageForOwner(userId);
  const nextAddress = String(payload.address ?? garage.address).trim();
  const nextCity = String(payload.city ?? garage.city).trim();
  const nextArea = String(payload.area ?? garage.area).trim();
  const addressChanged =
    nextAddress !== garage.address ||
    nextCity !== garage.city ||
    nextArea !== garage.area;

  if (!nextAddress || !nextCity || !nextArea) {
    throw new ApiError(400, "Garage address, city and area are required");
  }

  let latitude =
    payload.latitude === undefined || payload.latitude === ""
      ? garage.latitude
      : Number(payload.latitude);
  let longitude =
    payload.longitude === undefined || payload.longitude === ""
      ? garage.longitude
      : Number(payload.longitude);

  if (addressChanged || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const geocodeResult = await geocodingService.geocodeAddress({
      address: nextAddress,
      city: nextCity,
      state: nextArea,
    });
    latitude = Number(geocodeResult.latitude);
    longitude = Number(geocodeResult.longitude);
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ApiError(400, "Could not determine coordinates for this garage address");
  }

  const garageType = normalizeGarageType(payload.garageType ?? garage.garageType);
  const supportedBrands = normalizeSupportedBrands(payload.supportedBrands ?? garage.supportedBrands);

  if (garageType === "AUTHORIZED" && supportedBrands.length === 0) {
    throw new ApiError(400, "Select at least one authorized brand");
  }

  await prisma.garage.update({
    where: { id: garage.id },
    data: {
      name: payload.name === undefined ? garage.name : String(payload.name).trim(),
      description:
        payload.description === undefined
          ? garage.description
          : String(payload.description || "").trim() || null,
      phone: payload.phone === undefined ? garage.phone : String(payload.phone).trim(),
      whatsappNo:
        payload.whatsappNo === undefined
          ? payload.phone === undefined
            ? garage.whatsappNo
            : String(payload.phone).trim()
          : String(payload.whatsappNo).trim(),
      email: payload.email === undefined ? garage.email : String(payload.email).trim().toLowerCase(),
      address: nextAddress,
      city: nextCity,
      area: nextArea,
      latitude,
      longitude,
      workingRadiusKm: Number(payload.workingRadiusKm || garage.workingRadiusKm) || 15,
      garageType,
      supportedBrands,
    },
  });

  return getGarageOwnerProfile(userId);
};

const maskEmail = (email) => {
  const [local = "", domain = ""] = String(email || "").toLowerCase().split("@");
  if (!local || !domain) return "your registered email";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
};

const requestGarageAccountDeletionOtp = async (userId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "GARAGE_OWNER", isActive: true },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    throw new ApiError(400, "This garage account does not have a registered email");
  }

  await createDeleteAccountOtp(user.id, user.email);

  return {
    sent: true,
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: 300,
  };
};

const verifyDeletionConfirmation = async (user, payload = {}) => {
  const currentPassword = String(payload.currentPassword || "");
  const otp = String(payload.otp || "").trim();

  if (currentPassword) {
    let valid = false;
    try {
      valid = await argon2.verify(user.password, currentPassword);
    } catch {
      valid = false;
    }

    if (!valid) {
      throw new ApiError(401, "Current password is incorrect");
    }

    return true;
  }

  if (otp) {
    await verifyDeleteAccountOtp(user.id, otp);
    return true;
  }

  throw new ApiError(400, "Enter your current password or email OTP");
};

const deleteGarageOwnerAccount = async (userId, confirmation = {}) => {
  const owner = await prisma.user.findFirst({
    where: { id: userId, role: "GARAGE_OWNER", isActive: true },
    select: { id: true, password: true },
  });

  if (!owner) {
    throw new ApiError(404, "Garage owner account not found");
  }

  await verifyDeletionConfirmation(owner, confirmation);

  const garages = await prisma.garage.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  if (!garages.length) {
    await prisma.user.delete({
      where: { id: userId },
    });

    return {
      deletedGarages: 0,
      deletedApplications: 0,
      deletedBookings: 0,
      deletedOwnerUsers: 1,
    };
  }

  const result = await deleteGaragesDeep({
    garageIds: garages.map((garage) => garage.id),
  });

  return result;
};

const activateGarageIfEligible = async (tx, garageId) => {
  const garage = await tx.garage.findUnique({
    where: { id: garageId },
    include: { wallet: true, images: true },
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found");
  }

  if (
    !garage.isVerified ||
    !garage.wallet ||
    garage.wallet.balance < GARAGE_MINIMUM_ACTIVATION_RECHARGE
  ) {
    return garage;
  }

  if (garage.isActive) return garage;

  return tx.garage.update({
    where: { id: garageId },
    data: { isActive: true },
    include: { wallet: true, images: true },
  });
};

module.exports = {
  activateGarageIfEligible,
  deleteGarageOwnerAccount,
  requestGarageAccountDeletionOtp,
  getGarageForOwner,
  getGarageOwnerProfile,
  getGarageOwnerServices,
  updateGarageOwnerProfile,
};
