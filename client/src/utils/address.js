import api from "@/api/axios";

const compactParts = (parts = []) =>
  parts.map((part) => String(part || "").trim()).filter(Boolean);

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\d{5,6}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const ADMIN_AREA_HINT_REGEX =
  /\b(province|pradesh|state|district|zone|anchal|division|region)\b/i;

const looksLikeStateOrRegion = (value = "") =>
  ADMIN_AREA_HINT_REGEX.test(String(value || ""));

const getAddressComponentText = (component = {}) =>
  component.longText ||
  component.long_name ||
  component.shortText ||
  component.short_name ||
  component.text ||
  "";

const getStructuredCityFromComponents = (components = []) => {
  if (!Array.isArray(components)) return "";

  const cityComponent = components.find((component) =>
    [
      "locality",
      "postal_town",
      "administrative_area_level_3",
      "administrative_area_level_2",
    ].some((type) => component.types?.includes(type)),
  );

  return getAddressComponentText(cityComponent);
};

const uniqueParts = (parts = []) => {
  const seen = new Set();

  return compactParts(parts).filter((part) => {
    const key = normalizeKey(part);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

export const SERVICE_AREA_COORDINATE_BOUNDS = [
  {
    minLatitude: 6,
    maxLatitude: 38,
    minLongitude: 68,
    maxLongitude: 98,
  },
];

export const INDIA_COORDINATE_BOUNDS = SERVICE_AREA_COORDINATE_BOUNDS[0];

export const hasUsableIndiaCoordinates = (location = {}) => {
  if (!location || typeof location !== "object") return false;

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;

  return SERVICE_AREA_COORDINATE_BOUNDS.some(
    (bounds) =>
      latitude >= bounds.minLatitude &&
      latitude <= bounds.maxLatitude &&
      longitude >= bounds.minLongitude &&
      longitude <= bounds.maxLongitude,
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

  const lastPart = parts[parts.length - 1] || "";
  const secondLastPart = parts[parts.length - 2] || "";
  const lastPartIsState = looksLikeStateOrRegion(lastPart);
  const city = lastPartIsState ? secondLastPart : lastPart;
  const state = lastPartIsState ? lastPart : "";
  const areaIndex = lastPartIsState ? parts.length - 3 : parts.length - 2;
  const area = areaIndex >= 0 ? parts[areaIndex] : "";
  const addressEndIndex = Math.max(0, areaIndex);
  const addressParts =
    parts.length > 2 ? parts.slice(0, addressEndIndex) : parts.slice(0, 1);

  return {
    address: addressParts.join(", ") || value,
    area,
    city,
    state,
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
    throw new Error("Invalid service-area location coordinates.");
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
    city:
      structuredAddress.city ||
      getStructuredCityFromComponents(result.addressComponents) ||
      fallback.city ||
      "",
    state: structuredAddress.state || fallback.state || "",
    pincode: structuredAddress.pincode || fallback.pincode || "",
    country: structuredAddress.country || fallback.country || "",
    fullAddress:
      result.fullAddress ||
      result.displayName ||
      buildFullAddress(structuredAddress) ||
      buildFullAddress(fallback),
    latitude: Number(result.latitude ?? numericLatitude),
    longitude: Number(result.longitude ?? numericLongitude),
    placeId: result.placeId || null,
    addressComponents: result.addressComponents || [],
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
    (item) => hasUsableIndiaCoordinates(item) && Boolean(getLocationAddress(item)),
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
    location.formattedAddress ||
    location.fullAddress ||
    buildFullAddress(location) ||
    location.address ||
    ""
  );
};

export const getLocationStateFromAddress = (fullAddress = "", base = {}) => {
  const parsed = parseAddressParts(fullAddress);
  const componentCity = getStructuredCityFromComponents(base?.addressComponents);
  const addressText = fullAddress || buildFullAddress(parsed);

  return {
    ...parsed,
    city: componentCity || parsed.city,
    fullAddress: addressText,
    latitude: base?.latitude ?? null,
    longitude: base?.longitude ?? null,
    placeId: base?.placeId || null,
    addressComponents: base?.addressComponents || null,
    source: base?.source || "MANUAL",
  };
};

export const getLocationStateFromUser = (user, fallbackLocation = null) => {
  const defaultLocation = getDefaultUserLocation(user);
  const addressText =
    getLocationAddress(defaultLocation) ||
    getProfileAddress(user) ||
    getLocationAddress(fallbackLocation);

  if (!addressText) return fallbackLocation || null;

  return getLocationStateFromAddress(addressText, {
    latitude: defaultLocation?.latitude ?? fallbackLocation?.latitude,
    longitude: defaultLocation?.longitude ?? fallbackLocation?.longitude,
    placeId: defaultLocation?.placeId ?? fallbackLocation?.placeId,
    addressComponents:
      defaultLocation?.addressComponents ?? fallbackLocation?.addressComponents,
    source: defaultLocation?.source ?? fallbackLocation?.source,
  });
};
