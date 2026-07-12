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

const PLUS_CODE_REGEX =
  /^(?:[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})(?:\s|$)/i;

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

const removePincode = (value = "", pincode = "") => {
  const clean = String(value || "").trim();
  if (!clean) return "";

  if (pincode) {
    return clean.replace(new RegExp(`\\b${String(pincode)}\\b`, "g"), "").trim();
  }

  return clean.replace(/\b\d{5,6}\b/g, "").trim();
};

const isAdministrativeAddressPart = (part = "", structuredAddress = {}) => {
  const key = normalizeKey(part);
  if (!key) return true;

  const administrativeParts = [
    structuredAddress.area,
    structuredAddress.city,
    structuredAddress.state,
    structuredAddress.country,
  ]
    .map(normalizeKey)
    .filter(Boolean);

  return (
    ["india", "bharat"].includes(key) || administrativeParts.includes(key)
  );
};

/**
 * Returns a useful first address line for Google places that do not provide a
 * street number/route (campuses, landmarks, apartment complexes and plus-code
 * locations are common examples). A meaningful landmark is preferred over a
 * bare plus code, while the plus code remains the final fallback.
 */
export const getAddressLineFromPlace = ({
  address = "",
  formattedAddress = "",
  displayName = "",
  fallback = "",
  structuredAddress = {},
} = {}) => {
  const explicitAddress = String(address || "").trim();
  if (explicitAddress) return explicitAddress;

  const cleanDisplayName = String(displayName || "").trim();
  const cleanFormattedAddress = String(formattedAddress || "").trim();
  if (
    cleanDisplayName &&
    cleanDisplayName !== cleanFormattedAddress &&
    !cleanDisplayName.includes(",") &&
    !PLUS_CODE_REGEX.test(cleanDisplayName) &&
    !isAdministrativeAddressPart(cleanDisplayName, structuredAddress)
  ) {
    return cleanDisplayName;
  }

  const formattedParts = compactParts(cleanFormattedAddress.split(","))
    .map((part) => removePincode(part, structuredAddress.pincode))
    .filter(Boolean)
    .filter((part) => !isAdministrativeAddressPart(part, structuredAddress));

  const descriptiveParts = formattedParts.filter(
    (part) => !PLUS_CODE_REGEX.test(part),
  );

  if (descriptiveParts.length) {
    return uniqueParts(descriptiveParts).join(", ");
  }

  const cleanFallback = String(fallback || "").trim();
  if (
    cleanFallback &&
    !isAdministrativeAddressPart(cleanFallback, structuredAddress)
  ) {
    return cleanFallback;
  }

  return uniqueParts(formattedParts).join(", ");
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

  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng);

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
    address: getAddressLineFromPlace({
      address: structuredAddress.address,
      formattedAddress: result.fullAddress || result.displayName || "",
      displayName: result.displayName || "",
      fallback: fallback.address,
      structuredAddress: {
        ...fallback,
        ...structuredAddress,
      },
    }),
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
