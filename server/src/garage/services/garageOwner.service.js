const argon2 = require("argon2");
const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { normalizeEmail } = require("../../utils/email");
const { deleteGaragesDeep } = require("../../admin/services/garageDeletion.service");
const {
  GARAGE_MINIMUM_ACTIVATION_RECHARGE,
} = require("../constants");
const geocodingService = require("../../customer/services/geocoding.service");
const invalidatePublicCache = require("../../utils/invalidatePublicCache");
const cityServicePriceRangeService = require("../../admin/services/cityServicePriceRange.service");
const {
  assignmentExcludesVehicle,
  assignmentMatchesVehicle,
  garageSupportsVehicleBrand,
} = require("../../utils/garageCapabilities");
const {
  createDeleteAccountOtp,
  verifyDeleteAccountOtp,
  GARAGE_EMAIL_OTP_EXPIRY_MS,
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

const serializeGarageService = (garageService) => garageService;

const GARAGE_SERVICE_FUEL_TYPES = new Set([
  "PETROL",
  "DIESEL",
  "ELECTRIC",
  "HYBRID",
  "CNG",
  "OTHER",
]);

const normalizeGarageServiceFilter = (value) =>
  String(value || "").trim();

const normalizeGarageServiceFuelType = (value) => {
  const normalized = normalizeGarageServiceFilter(value).toUpperCase();
  return GARAGE_SERVICE_FUEL_TYPES.has(normalized) ? normalized : undefined;
};

const groupGarageServicesByServiceId = (assignments = []) => {
  const grouped = new Map();

  assignments.forEach((assignment) => {
    if (!assignment?.serviceId) return;
    const current = grouped.get(assignment.serviceId) || [];
    current.push(assignment);
    grouped.set(assignment.serviceId, current);
  });

  return grouped;
};

const normalizeGarageServiceComparable = (value) =>
  normalizeGarageServiceFilter(value).toLowerCase();

const assignmentBrandMatchesFilter = (assignment, vehicle) => {
  const assignedBrand = normalizeGarageServiceComparable(
    assignment?.vehicleBrand || "ALL",
  );
  const vehicleBrand = normalizeGarageServiceComparable(vehicle?.brand);

  return assignedBrand === "all" || assignedBrand === vehicleBrand;
};

const assignmentRelevantToVehicleFilter = (assignment, vehicle) => {
  if (!assignmentBrandMatchesFilter(assignment, vehicle)) return false;
  if (!vehicle?.model) return true;

  const assignedModel = normalizeGarageServiceComparable(
    assignment?.vehicleModel || "ALL",
  );
  const vehicleModel = normalizeGarageServiceComparable(vehicle.model);
  return assignedModel === "all" || assignedModel === vehicleModel;
};

const serviceMatchesVehicleFilter = (serviceAssignments, vehicle) => {
  if (vehicle?.model) {
    const isIncluded = serviceAssignments.some((assignment) =>
      assignmentMatchesVehicle(assignment, vehicle),
    );
    const isExcluded = serviceAssignments.some((assignment) =>
      assignmentExcludesVehicle(assignment, vehicle),
    );
    return isIncluded && !isExcluded;
  }

  const isIncluded = serviceAssignments.some(
    (assignment) =>
      assignment?.isExcluded !== true &&
      assignmentBrandMatchesFilter(assignment, vehicle),
  );
  const hasWholeBrandExclusion = serviceAssignments.some((assignment) => {
    const assignedModel = normalizeGarageServiceComparable(
      assignment?.vehicleModel || "ALL",
    );
    return (
      assignment?.isExcluded === true &&
      assignedModel === "all" &&
      assignmentBrandMatchesFilter(assignment, vehicle)
    );
  });

  return isIncluded && !hasWholeBrandExclusion;
};

const getGarageOwnerServices = async (userId, filters = {}) => {
  const garage = await getGarageForOwner(userId);
  const vehicle = {
    brand: normalizeGarageServiceFilter(filters.vehicleBrand),
    model: normalizeGarageServiceFilter(filters.vehicleModel),
    fuelType: normalizeGarageServiceFuelType(filters.fuelType),
  };
  const hasVehicleFilter = Boolean(vehicle.brand);

  const assignments = await prisma.garageService.findMany({
    where: {
      garageId: garage.id,
      isActive: true,
      service: {
        isActive: true,
        category: { isActive: true },
      },
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

  if (!hasVehicleFilter) {
    return assignments.map((assignment) => ({
      ...serializeGarageService(assignment),
      service: {
        ...assignment.service,
        pricingStatus: "VEHICLE_REQUIRED",
        priceUnavailableMessage: "Select a vehicle to view the customer price range",
      },
    }));
  }

  if (!garageSupportsVehicleBrand(garage, vehicle)) return [];

  const groupedAssignments = groupGarageServicesByServiceId(assignments);
  const eligibleServiceIds = new Set();

  groupedAssignments.forEach((serviceAssignments, serviceId) => {
    if (serviceMatchesVehicleFilter(serviceAssignments, vehicle)) {
      eligibleServiceIds.add(serviceId);
    }
  });

  const eligibleAssignments = assignments.filter(
    (assignment) =>
      eligibleServiceIds.has(assignment.serviceId) &&
      assignmentRelevantToVehicleFilter(assignment, vehicle),
  );
  const uniqueServices = [
    ...new Map(
      eligibleAssignments.map((assignment) => [
        assignment.serviceId,
        assignment.service,
      ]),
    ).values(),
  ];
  const priceRanges = await cityServicePriceRangeService.findBestPriceRangesForBooking({
    city: garage.city,
    services: uniqueServices,
    vehicle,
  });

  return eligibleAssignments.map((assignment) => {
    const range = priceRanges.get(assignment.serviceId);

    return {
      ...serializeGarageService(assignment),
      service: {
        ...assignment.service,
        ...(range
          ? {
              priceRange: {
                min: Number(range.minPrice) || 0,
                max: Number(range.maxPrice) || Number(range.minPrice) || 0,
              },
              pricingStatus: "AVAILABLE",
              priceUnavailableMessage: null,
            }
          : {
              pricingStatus: "NOT_ALLOCATED",
              priceUnavailableMessage:
                "No active price range is allocated for this vehicle in your city",
            }),
      },
      matchedVehicle: {
        brand: vehicle.brand,
        model: vehicle.model || null,
        fuelType: vehicle.fuelType || null,
      },
    };
  });
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

const isValidCoordinatePair = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const updateGarageOwnerProfile = async (userId, payload = {}) => {
  const garage = await getGarageForOwner(userId);
  const nextName =
    payload.name === undefined ? garage.name : String(payload.name).trim();
  const nextDescription =
    payload.description === undefined
      ? garage.description
      : String(payload.description || "").trim() || null;
  const nextPhone =
    payload.phone === undefined ? garage.phone : String(payload.phone).trim();
  const nextWhatsappNo =
    payload.whatsappNo === undefined
      ? payload.phone === undefined
        ? garage.whatsappNo
        : nextPhone
      : String(payload.whatsappNo || "").trim() || null;
  const nextEmail =
    payload.email === undefined
      ? garage.email
      : normalizeEmail(payload.email) || null;
  const nextAddress = String(payload.address ?? garage.address).trim();
  const nextCity = String(payload.city ?? garage.city).trim();
  const nextArea = String(payload.area ?? garage.area).trim();

  if (nextName.length < 2 || nextName.length > 120) {
    throw new ApiError(400, "Garage name must be between 2 and 120 characters");
  }

  if (!/^\+91[6-9]\d{9}$/.test(nextPhone)) {
    throw new ApiError(400, "Garage phone must be a valid Indian mobile number");
  }

  if (nextWhatsappNo && !/^\+91[6-9]\d{9}$/.test(nextWhatsappNo)) {
    throw new ApiError(400, "WhatsApp number must be a valid Indian mobile number");
  }

  if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    throw new ApiError(400, "Garage email is invalid");
  }

  if (!nextAddress || !nextCity || !nextArea) {
    throw new ApiError(400, "Garage address, city and area are required");
  }

  const hasLatitude = payload.latitude !== undefined && payload.latitude !== "";
  const hasLongitude = payload.longitude !== undefined && payload.longitude !== "";

  if (hasLatitude !== hasLongitude) {
    throw new ApiError(400, "Latitude and longitude must be provided together");
  }

  const addressChanged =
    nextAddress !== garage.address ||
    nextCity !== garage.city ||
    nextArea !== garage.area;

  let latitude = hasLatitude ? Number(payload.latitude) : garage.latitude;
  let longitude = hasLongitude ? Number(payload.longitude) : garage.longitude;

  if ((addressChanged && !hasLatitude) || !isValidCoordinatePair(latitude, longitude)) {
    const geocodeResult = await geocodingService.geocodeAddress({
      address: nextAddress,
      city: nextCity,
      state: nextArea,
    });
    latitude = Number(geocodeResult.latitude);
    longitude = Number(geocodeResult.longitude);
  }

  if (!isValidCoordinatePair(latitude, longitude)) {
    throw new ApiError(400, "Could not determine valid coordinates for this garage address");
  }

  const workingRadiusKm = Number(
    payload.workingRadiusKm ?? garage.workingRadiusKm,
  );

  if (
    !Number.isInteger(workingRadiusKm) ||
    workingRadiusKm < 1 ||
    workingRadiusKm > 100
  ) {
    throw new ApiError(400, "Working radius must be between 1 and 100 km");
  }

  const garageType = normalizeGarageType(payload.garageType ?? garage.garageType);
  const supportedBrands = [
    ...new Set(
      normalizeSupportedBrands(
        payload.supportedBrands ?? garage.supportedBrands,
      ),
    ),
  ];

  if (supportedBrands.length > 25 || supportedBrands.some((brand) => brand.length > 60)) {
    throw new ApiError(400, "Supported brands are invalid");
  }

  if (garageType === "AUTHORIZED" && supportedBrands.length === 0) {
    throw new ApiError(400, "Select at least one authorized brand");
  }

  await prisma.garage.update({
    where: { id: garage.id },
    data: {
      name: nextName,
      description: nextDescription,
      phone: nextPhone,
      whatsappNo: nextWhatsappNo,
      email: nextEmail,
      address: nextAddress,
      city: nextCity,
      area: nextArea,
      latitude,
      longitude,
      workingRadiusKm,
      garageType,
      supportedBrands,
    },
  });

  await invalidatePublicCache();
  return getGarageOwnerProfile(userId);
};

const maskEmail = (email) => {
  const [local = "", domain = ""] = String(email || "").toLowerCase().split("@");
  if (!local || !domain) return "your registered email";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
};

const requestGarageAccountDeletionOtp = async (userId) => {
  const user = await prisma.garageOwner.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    throw new ApiError(400, "This garage account does not have a registered email");
  }

  await createDeleteAccountOtp(user.id, user.email);

  return {
    sent: true,
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: Math.floor(GARAGE_EMAIL_OTP_EXPIRY_MS / 1000),
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
  const owner = await prisma.garageOwner.findFirst({
    where: { id: userId, isActive: true },
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
    await prisma.garageOwner.delete({
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
