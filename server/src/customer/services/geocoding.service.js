const axios = require("axios");
const ApiError = require("../../utils/apiError");
const { deleteCache, getCache, setCache } = require("../../utils/cache");
const { correctAddress, estimateIndianCoordinates } = require("../../utils/addressCorrection");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

const normalizePart = (value) => String(value || "").trim();
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

const getNominatimUserAgent = () => (
  process.env.NOMINATIM_USER_AGENT ||
  process.env.GEOCODER_USER_AGENT ||
  "Rovauto/1.0 (set-NOMINATIM_USER_AGENT@example.com)"
);

const getDefaultCountry = () => process.env.GEOCODER_DEFAULT_COUNTRY || "India";
const getDefaultCountryCodes = () => process.env.GEOCODER_COUNTRYCODES || "in";
const INDIA_COORDINATE_BOUNDS = {
  minLatitude: 6,
  maxLatitude: 38,
  minLongitude: 68,
  maxLongitude: 98,
};

const isWithinIndiaBounds = (latitude, longitude) => (
  latitude >= INDIA_COORDINATE_BOUNDS.minLatitude
  && latitude <= INDIA_COORDINATE_BOUNDS.maxLatitude
  && longitude >= INDIA_COORDINATE_BOUNDS.minLongitude
  && longitude <= INDIA_COORDINATE_BOUNDS.maxLongitude
);

const isProviderUnavailable = (error) => (
  [403, 429, 500, 502, 503, 504].includes(Number(error?.response?.status))
  || ["ECONNABORTED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"].includes(error?.code)
);

const buildQuery = ({ address, area, city, state, pincode, country = getDefaultCountry() }) =>
  uniqueParts([address, area, city, state, pincode, country]).join(", ");

const buildQueryCandidates = (params = {}) => {
  const country = params.country ?? getDefaultCountry();
  const address = normalizePart(params.address);
  const area = normalizePart(params.area);
  const city = normalizePart(params.city);
  const state = normalizePart(params.state);
  const pincode = normalizePart(params.pincode);

  return uniqueParts([
    buildQuery({ address, area, city, state, pincode, country }),
    buildQuery({ address, area, city, pincode, country }),
    buildQuery({ address, city, state, pincode, country }),
    buildQuery({ area, city, state, pincode, country }),
    buildQuery({ address, city, pincode, country }),
    buildQuery({ address, pincode, country }),
    buildQuery({ area, city, country }),
    buildQuery({ city, state, pincode, country }),
  ]);
};

const requestNominatim = (query, params = {}) =>
  axios.get(NOMINATIM_URL, {
    params: {
      q: query,
      format: "jsonv2",
      addressdetails: 1,
      limit: 5,
      countrycodes: params.countrycodes || getDefaultCountryCodes(),
    },
    headers: {
      "User-Agent": getNominatimUserAgent(),
      Accept: "application/json",
    },
    timeout: Math.min(Number(process.env.NOMINATIM_TIMEOUT_MS || 3000), 3000),
  });

const mapPlaceResult = ({
  place,
  query,
  corrected = false,
  originalQuery = null,
  correctedAddressText = null,
}) => ({
  provider: "nominatim",
  query,
  latitude: Number(place.lat),
  longitude: Number(place.lon),
  displayName: place.display_name,
  importance: place.importance ?? null,
  address: place.address || null,
  attribution: "OpenStreetMap contributors",
  corrected,
  ...(originalQuery ? { originalQuery } : {}),
  ...(correctedAddressText ? { correctedAddressText } : {}),
});

const findNominatimPlace = async (queries = [], params = {}) => {
  let lastError = null;

  const maxCandidates = Number(process.env.GEOCODER_MAX_CANDIDATES || 2);

  for (const query of queries.slice(0, maxCandidates)) {
    try {
      const response = await requestNominatim(query, params);
      const places = Array.isArray(response.data) ? response.data : [];
      const place = places.find((item) =>
        isWithinIndiaBounds(Number(item.lat), Number(item.lon))
      );
      if (place) return { place, query };
    } catch (error) {
      lastError = error;
      console.error(`Nominatim geocoding error for "${query}":`, error.message);
      if (isProviderUnavailable(error)) break;
    }
  }

  return { place: null, query: queries[0] || "", error: lastError };
};

const geocodeWithCorrection = async ({ params, originalQuery }) => {
  const correctedAddressText = await correctAddress(
    params.address,
    params.city,
    params.state,
    params.area,
    params.pincode
  );
  const correctedParams = {
    address: correctedAddressText,
    area: params.area,
    city: params.city,
    state: params.state,
    pincode: params.pincode,
    country: params.country,
  };
  const correctedQueries = buildQueryCandidates(correctedParams);
  const { place: correctedPlace, query: correctedQuery } = await findNominatimPlace(correctedQueries, params);

  if (!correctedPlace) {
    throw new ApiError(404, "No location found even after address correction");
  }

  return mapPlaceResult({
    place: correctedPlace,
    query: correctedQuery,
    corrected: true,
    originalQuery,
    correctedAddressText,
  });
};

const geocodeWithGroqCoordinates = async (params = {}) => {
  const result = await estimateIndianCoordinates(params);

  if (!isWithinIndiaBounds(result.latitude, result.longitude)) {
    throw new ApiError(404, "No valid Indian coordinates found for this address");
  }

  return {
    provider: "groq",
    query: buildQuery({
      address: params.address,
      area: params.area,
      city: params.city,
      state: params.state,
      pincode: params.pincode,
      country: params.country,
    }),
    latitude: result.latitude,
    longitude: result.longitude,
    displayName: result.displayName,
    importance: null,
    address: null,
    attribution: "Groq coordinate fallback",
    corrected: true,
    correctedAddressText: result.displayName,
    confidence: result.confidence,
  };
};

const geocodeAddress = async (params = {}) => {
  const queries = buildQueryCandidates(params);
  const query = queries[0];
  if (!query) throw new ApiError(400, "Address or city is required for geocoding");

  const cacheKey = `geocode:nominatim:${query.toLowerCase()}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    if (isWithinIndiaBounds(Number(cached.latitude), Number(cached.longitude))) {
      return { ...cached, cached: true };
    }

    await deleteCache(cacheKey);
  }

  const { place, query: matchedQuery, error: providerError } = await findNominatimPlace(queries, params);
  if (place) {
    const result = mapPlaceResult({ place, query: matchedQuery });
    await setCache(cacheKey, result, GEOCODE_CACHE_TTL_SECONDS);
    return result;
  }

  if (process.env.GROQ_API_KEY) {
    try {
      if (providerError) {
        console.log("Nominatim unavailable, attempting Groq coordinate fallback...");
        const result = await geocodeWithGroqCoordinates(params);
        await setCache(cacheKey, result, GEOCODE_CACHE_TTL_SECONDS);
        return result;
      }

      console.log("Nominatim failed, attempting Groq address correction...");
      const result = await geocodeWithCorrection({ params, originalQuery: query });
      await setCache(cacheKey, result, GEOCODE_CACHE_TTL_SECONDS);
      return result;
    } catch (correctionError) {
      console.error("Groq address correction failed:", correctionError.message);
      try {
        console.log("Attempting Groq coordinate fallback...");
        const result = await geocodeWithGroqCoordinates(params);
        await setCache(cacheKey, result, GEOCODE_CACHE_TTL_SECONDS);
        return result;
      } catch (coordinateError) {
        console.error("Groq coordinate fallback failed:", coordinateError.message);
        if (coordinateError.status) throw coordinateError;
        throw new ApiError(404, "No location found for this address");
      }
    }
  }

  if (providerError) {
    throw new ApiError(providerError.response?.status || 502, "Unable to geocode address right now");
  }

  console.warn("Address not found and Groq not configured");
  throw new ApiError(404, "No location found for this address");
};

module.exports = {
  geocodeAddress,
};
