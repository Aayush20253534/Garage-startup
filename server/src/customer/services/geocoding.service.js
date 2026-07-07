const axios = require("axios");
const ApiError = require("../../utils/apiError");
const { correctAddress } = require("../../utils/addressCorrection");

const GOOGLE_GEOCODING_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";

const DEFAULT_REGION_CODES = ["in"];
const SERVICE_AREA_BOUNDS = [
  {
    code: "in",
    minLatitude: 6,
    maxLatitude: 38,
    minLongitude: 68,
    maxLongitude: 98,
  },
];

const normalizePart = (value) => String(value || "").trim();

const getRegionCodes = () => {
  const configured = normalizePart(
    process.env.GOOGLE_MAPS_REGION_CODES ||
      process.env.GOOGLE_GEOCODING_REGION ||
      process.env.GOOGLE_MAPS_REGION_CODE,
  );
  const values = configured
    ? configured.split(",").map((item) => item.trim().toLowerCase())
    : DEFAULT_REGION_CODES;
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length ? unique : DEFAULT_REGION_CODES;
};

const getPrimaryRegionCode = () => getRegionCodes()[0];

const getCountryComponentFilter = () => {
  const regionCodes = getRegionCodes();
  return regionCodes.length === 1 ? `country:${regionCodes[0].toUpperCase()}` : null;
};

const uniqueParts = (parts = []) => {
  const seen = new Set();

  return parts
    .map(normalizePart)
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
};

const getGoogleApiKey = () => {
  const key = normalizePart(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_BROWSER_KEY ||
      process.env.VITE_GOOGLE_MAPS_BROWSER_KEY,
  );

  if (!key) {
    throw new ApiError(503, "Google geocoding is not configured");
  }

  return key;
};

const getGoogleTimeout = () => {
  const configured = Number(process.env.GOOGLE_GEOCODING_TIMEOUT_MS || 5000);

  if (!Number.isFinite(configured)) return 5000;
  return Math.max(2000, Math.min(configured, 15000));
};

const getGoogleLanguage = () =>
  normalizePart(process.env.GOOGLE_GEOCODING_LANGUAGE) || "en";

const getGoogleRegion = () =>
  getPrimaryRegionCode();

const getMaxCandidates = () => {
  const configured = Number(
    process.env.GOOGLE_GEOCODING_MAX_CANDIDATES || 2,
  );

  if (!Number.isFinite(configured)) return 2;
  return Math.max(1, Math.min(Math.floor(configured), 4));
};

const isWithinServiceAreaBounds = (latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  const regionCodes = new Set(getRegionCodes());
  return SERVICE_AREA_BOUNDS.filter((bounds) => regionCodes.has(bounds.code)).some(
    (bounds) =>
      latitude >= bounds.minLatitude &&
      latitude <= bounds.maxLatitude &&
      longitude >= bounds.minLongitude &&
      longitude <= bounds.maxLongitude,
  );
};

const buildQuery = ({
  address,
  area,
  city,
  state,
  pincode,
  country = "",
}) => uniqueParts([address, area, city, state, pincode, country]).join(", ");

const buildQueryCandidates = (params = {}) => {
  const address = normalizePart(params.address);
  const area = normalizePart(params.area);
  const city = normalizePart(params.city);
  const state = normalizePart(params.state);
  const pincode = normalizePart(params.pincode);
  const country = normalizePart(params.country);

  return uniqueParts([
    buildQuery({ address, area, city, state, pincode, country }),
    buildQuery({ address, area, city, pincode, country }),
    buildQuery({ address, city, state, pincode, country }),
    buildQuery({ area, city, state, pincode, country }),
    buildQuery({ address, city, pincode, country }),
    buildQuery({ area, city, country }),
    buildQuery({ city, state, pincode, country }),
  ]);
};

const getAddressComponent = (
  components = [],
  acceptedTypes = [],
  { shortName = false } = {},
) => {
  const component = components.find((item) =>
    acceptedTypes.some((type) => item.types?.includes(type)),
  );

  if (!component) return "";
  return shortName ? component.short_name || "" : component.long_name || "";
};

const parseGoogleAddress = (result = {}) => {
  const components = Array.isArray(result.address_components)
    ? result.address_components
    : [];

  const streetNumber = getAddressComponent(components, ["street_number"]);
  const route = getAddressComponent(components, ["route"]);
  const premise = getAddressComponent(components, ["premise"]);
  const subpremise = getAddressComponent(components, ["subpremise"]);

  const area = getAddressComponent(components, [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_3",
  ]);

  const city = getAddressComponent(components, [
    "locality",
    "postal_town",
    "administrative_area_level_2",
  ]);

  const state = getAddressComponent(components, [
    "administrative_area_level_1",
  ]);

  const pincode = getAddressComponent(components, ["postal_code"]);
  const country = getAddressComponent(components, ["country"]);
  const countryCode = getAddressComponent(
    components,
    ["country"],
    { shortName: true },
  );

  const street = uniqueParts([
    premise,
    subpremise,
    uniqueParts([streetNumber, route]).join(" "),
  ]).join(", ");

  return {
    address: street,
    area,
    city,
    state,
    pincode,
    country,
    countryCode,
  };
};

const isServiceAreaGoogleResult = (result = {}) => {
  const latitude = Number(result.geometry?.location?.lat);
  const longitude = Number(result.geometry?.location?.lng);
  const parsedAddress = parseGoogleAddress(result);
  const allowedCountryCodes = new Set(
    getRegionCodes().map((code) => code.toUpperCase()),
  );

  if (!isWithinServiceAreaBounds(latitude, longitude)) return false;
  if (
    parsedAddress.countryCode &&
    allowedCountryCodes.size > 0 &&
    !allowedCountryCodes.has(parsedAddress.countryCode)
  ) {
    return false;
  }

  return true;
};

const getReverseResultScore = (result = {}) => {
  const types = Array.isArray(result.types) ? result.types : [];
  const priorities = [
    "street_address",
    "premise",
    "subpremise",
    "route",
    "point_of_interest",
    "establishment",
    "neighborhood",
    "sublocality",
    "locality",
  ];

  const index = priorities.findIndex((type) => types.includes(type));
  return index === -1 ? priorities.length : index;
};

const selectBestResult = (results = [], { reverse = false } = {}) => {
  const validResults = results.filter(isServiceAreaGoogleResult);

  if (!reverse) return validResults[0] || null;

  return [...validResults].sort(
    (left, right) =>
      getReverseResultScore(left) - getReverseResultScore(right),
  )[0] || null;
};

const mapGoogleResult = ({
  result,
  query,
  corrected = false,
  originalQuery = null,
  correctedAddressText = null,
}) => {
  const parsedAddress = parseGoogleAddress(result);

  return {
    provider: "google",
    query,
    latitude: Number(result.geometry.location.lat),
    longitude: Number(result.geometry.location.lng),
    displayName: result.formatted_address || "",
    fullAddress: result.formatted_address || "",
    address: {
      address: parsedAddress.address,
      area: parsedAddress.area,
      city: parsedAddress.city,
      state: parsedAddress.state,
      pincode: parsedAddress.pincode,
      country: parsedAddress.country || "",
    },
    addressComponents: result.address_components || [],
    placeId: result.place_id || null,
    locationType: result.geometry?.location_type || null,
    partialMatch: Boolean(result.partial_match),
    attribution: "Google Maps",
    corrected,
    ...(originalQuery ? { originalQuery } : {}),
    ...(correctedAddressText ? { correctedAddressText } : {}),
  };
};

const throwGoogleStatusError = (status, errorMessage = "") => {
  const safeLogMessage = errorMessage || "No provider error message";

  switch (status) {
    case "INVALID_REQUEST":
      throw new ApiError(400, "Invalid geocoding request");

    case "OVER_QUERY_LIMIT":
      console.error("Google Geocoding quota exceeded:", safeLogMessage);
      throw new ApiError(429, "Geocoding request limit reached. Try again later.");

    case "OVER_DAILY_LIMIT":
      console.error("Google Geocoding daily limit or billing error:", safeLogMessage);
      throw new ApiError(503, "Geocoding service is temporarily unavailable");

    case "REQUEST_DENIED":
      console.error("Google Geocoding request denied:", safeLogMessage);
      throw new ApiError(502, "Geocoding provider rejected the request");

    case "UNKNOWN_ERROR":
      console.error("Google Geocoding unknown provider error:", safeLogMessage);
      throw new ApiError(503, "Geocoding service is temporarily unavailable");

    default:
      console.error(`Google Geocoding unexpected status ${status}:`, safeLogMessage);
      throw new ApiError(502, "Unable to geocode the location right now");
  }
};

const requestGoogleGeocoding = async (params, attempt = 0) => {
  try {
    const response = await axios.get(GOOGLE_GEOCODING_URL, {
      params: {
        ...params,
        key: getGoogleApiKey(),
        language: getGoogleLanguage(),
        region: getGoogleRegion(),
      },
      timeout: getGoogleTimeout(),
      headers: {
        Accept: "application/json",
      },
    });

    const status = response.data?.status;

    if (status === "OK") {
      return Array.isArray(response.data.results) ? response.data.results : [];
    }

    if (status === "ZERO_RESULTS") {
      return [];
    }

    if (status === "UNKNOWN_ERROR" && attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return requestGoogleGeocoding(params, attempt + 1);
    }

    throwGoogleStatusError(status, response.data?.error_message);
  } catch (error) {
    if (error instanceof ApiError || Number.isInteger(error?.statusCode)) {
      throw error;
    }

    const code = String(error.code || "");
    const statusCode = Number(error.response?.status || 0);

    console.error("Google Geocoding network error:", {
      code,
      statusCode,
      message: error.message,
    });

    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      throw new ApiError(504, "Geocoding provider timed out");
    }

    throw new ApiError(502, "Unable to reach the geocoding provider");
  }
};

const findGooglePlace = async (queries = []) => {
  for (const query of queries.slice(0, getMaxCandidates())) {
    const results = await requestGoogleGeocoding({
      address: query,
      ...(getCountryComponentFilter() && {
        components: getCountryComponentFilter(),
      }),
    });

    const result = selectBestResult(results);
    if (result) return { result, query };
  }

  return {
    result: null,
    query: queries[0] || "",
  };
};

const geocodeWithCorrection = async ({ params, originalQuery }) => {
  const correctedAddressText = await correctAddress(
    params.address,
    params.city,
    params.state,
    params.area,
    params.pincode,
  );

  const correctedParams = {
    ...params,
    address: correctedAddressText,
  };

  const correctedQueries = buildQueryCandidates(correctedParams);
  const { result, query } = await findGooglePlace(correctedQueries);

  if (!result) {
    throw new ApiError(404, "No location found even after address correction");
  }

  return mapGoogleResult({
    result,
    query,
    corrected: true,
    originalQuery,
    correctedAddressText,
  });
};

const geocodeAddress = async (params = {}) => {
  const queries = buildQueryCandidates(params);
  const originalQuery = queries[0];

  if (!originalQuery) {
    throw new ApiError(400, "Address or city is required for geocoding");
  }

  const { result, query } = await findGooglePlace(queries);

  if (result) {
    return mapGoogleResult({ result, query });
  }

  if (process.env.GROQ_API_KEY) {
    try {
      return await geocodeWithCorrection({
        params,
        originalQuery,
      });
    } catch (error) {
      console.error(
        "Google geocoding after address correction failed:",
        error.message,
      );

      if ([429, 502, 503, 504].includes(Number(error?.statusCode))) {
        throw error;
      }
    }
  }

  throw new ApiError(404, "No location found for this address");
};

const reverseGeocodeCoordinates = async ({ latitude, longitude }) => {
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);

  if (
    !Number.isFinite(numericLatitude) ||
    !Number.isFinite(numericLongitude) ||
    !isWithinServiceAreaBounds(numericLatitude, numericLongitude)
  ) {
    throw new ApiError(400, "Invalid service-area location coordinates");
  }

  const results = await requestGoogleGeocoding({
    latlng: `${numericLatitude},${numericLongitude}`,
  });

  const result = selectBestResult(results, { reverse: true });

  if (!result) {
    throw new ApiError(404, "Sorry The Service is not available in your location");
  }

  return mapGoogleResult({
    result,
    query: `${numericLatitude},${numericLongitude}`,
  });
};

module.exports = {
  geocodeAddress,
  reverseGeocodeCoordinates,
};
