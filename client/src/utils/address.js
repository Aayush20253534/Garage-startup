import api from "@/api/axios";

const compactParts = (parts = []) =>
  parts.map((part) => String(part || "").trim()).filter(Boolean);

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const uniqueParts = (parts = []) => {
  const seen = new Set();

  return compactParts(parts).filter((part) => {
    const key = normalizeKey(part);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

export const INDIA_COORDINATE_BOUNDS = {
  minLatitude: 6,
  maxLatitude: 38,
  minLongitude: 68,
  maxLongitude: 98,
};

export const hasUsableIndiaCoordinates = (location = {}) => {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;

  return (
    latitude >= INDIA_COORDINATE_BOUNDS.minLatitude &&
    latitude <= INDIA_COORDINATE_BOUNDS.maxLatitude &&
    longitude >= INDIA_COORDINATE_BOUNDS.minLongitude &&
    longitude <= INDIA_COORDINATE_BOUNDS.maxLongitude
  );
};

export const buildFullAddress = (parts = {}) =>
  uniqueParts([
    parts.address,
    parts.area,
    parts.city,
    parts.state,
    parts.pincode,
  ]).join(", ");

export const parseAddressParts = (fullAddress = "") => {
  const value = String(fullAddress || "").trim();
  if (!value) {
    return {
      address: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
    };
  }

  const pincodeMatch = value.match(/\b\d{5,6}\b/);
  const pincode = pincodeMatch?.[0] || "";

  const parts = compactParts(value.split(","))
    .map((part) => (pincode ? part.replace(pincode, "").trim() : part))
    .filter(Boolean)
    .filter((part) => !["india", "bharat"].includes(normalizeKey(part)));

  const city = parts[parts.length - 1] || "";
  const area = parts.length > 1 ? parts[parts.length - 2] : "";
  const addressParts =
    parts.length > 2 ? parts.slice(0, -2) : parts.slice(0, 1);

  return {
    address: addressParts.join(", ") || value,
    area,
    city,
    state: "",
    pincode,
  };
};

const unwrapApiData = (response) => response?.data?.data ?? response?.data ?? {};

export const reverseGeocodeCoordinates = async ({ latitude, longitude }) => {
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);

  if (
    !hasUsableIndiaCoordinates({
      latitude: numericLatitude,
      longitude: numericLongitude,
    })
  ) {
    throw new Error("Invalid Indian location coordinates.");
  }

  const response = await api.get("/locations/reverse-geocode", {
    params: {
      latitude: numericLatitude,
      longitude: numericLongitude,
    },
  });

  const result = unwrapApiData(response);
  const structuredAddress =
    result.address && typeof result.address === "object" ? result.address : {};
  const fallback = parseAddressParts(
    result.fullAddress || result.displayName || "",
  );

  const normalized = {
    address: structuredAddress.address || fallback.address || "",
    area: structuredAddress.area || fallback.area || "",
    city: structuredAddress.city || fallback.city || "",
    state: structuredAddress.state || fallback.state || "",
    pincode: structuredAddress.pincode || fallback.pincode || "",
    country: structuredAddress.country || "India",
    fullAddress:
      result.fullAddress ||
      result.displayName ||
      buildFullAddress(structuredAddress) ||
      buildFullAddress(fallback),
    latitude: Number(result.latitude ?? numericLatitude),
    longitude: Number(result.longitude ?? numericLongitude),
    placeId: result.placeId || null,
    locationType: result.locationType || null,
    provider: result.provider || "google",
    attribution: result.attribution || "Google Maps",
  };

  if (!normalized.fullAddress) {
    throw new Error("Could not resolve address for current location.");
  }

  return normalized;
};

export const getDefaultUserLocation = (user) => {
  const locations = Array.isArray(user?.locations) ? user.locations : [];
  const validLocations = locations.filter(
    (item) => hasUsableIndiaCoordinates(item) && Boolean(item.address),
  );

  return (
    validLocations.find((item) => item.isDefault) || validLocations[0] || null
  );
};

export const getProfileAddress = (user) =>
  user?.customerProfile?.address || user?.address || "";

export const getLocationAddress = (location) => {
  if (!location) return "";

  return (
    location.fullAddress || buildFullAddress(location) || location.address || ""
  );
};

export const getLocationStateFromAddress = (fullAddress = "", base = {}) => {
  const parsed = parseAddressParts(fullAddress);
  const addressText = fullAddress || buildFullAddress(parsed);

  return {
    ...parsed,
    fullAddress: addressText,
    latitude: base?.latitude ?? null,
    longitude: base?.longitude ?? null,
  };
};

export const getLocationStateFromUser = (user, fallbackLocation = null) => {
  const defaultLocation = getDefaultUserLocation(user);
  const addressText =
    defaultLocation?.address ||
    getProfileAddress(user) ||
    getLocationAddress(fallbackLocation);

  if (!addressText) return fallbackLocation || null;

  return getLocationStateFromAddress(addressText, {
    latitude: defaultLocation?.latitude ?? fallbackLocation?.latitude,
    longitude: defaultLocation?.longitude ?? fallbackLocation?.longitude,
  });
};
