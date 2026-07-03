const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const {
  GARAGE_MINIMUM_ACTIVATION_RECHARGE,
} = require("../constants");
const geocodingService = require("../../customer/services/geocoding.service");

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
    },
  });

  return {
    ...garage,
    activation: {
      minimumBalance: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      walletBalance: garage.wallet?.balance || 0,
      photoCount: garage.images?.length || 0,
      hasMinimumBalance:
        (garage.wallet?.balance || 0) >= GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      isActive: garage.isActive,
    },
  };
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
  getGarageForOwner,
  getGarageOwnerProfile,
  updateGarageOwnerProfile,
};
