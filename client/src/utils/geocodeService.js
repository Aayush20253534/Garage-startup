import api from "@/api/axios";
import { hasUsableIndiaCoordinates } from "@/utils/address";

/**
 * Geocoding service with rate limiting and caching.
 * Server handles provider fallback, including Groq address correction.
 */

// Cache configuration
const geocodeCache = new Map();
const GEOCODE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const geocodeRequestQueue = [];

// Geocoding state
let isGeocoding = false;
const MAX_RETRIES = 3;
const RETRY_BACKOFF = [1000, 3000, 5000]; // Exponential backoff in ms

const getCachedGeocode = (key) => {
  const cached = geocodeCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > GEOCODE_CACHE_TTL) {
    geocodeCache.delete(key);
    return null;
  }

  return cached.data;
};

const setCachedGeocode = (key, data) => {
  geocodeCache.set(key, {
    data,
    timestamp: Date.now(),
  });
};

const getCacheKey = (address, city, area, pincode) => {
  return `${address}|${city}|${area}|${pincode}`.toLowerCase();
};

/**
 * Geocoding API call with retry logic for rate limits
 */
const geocodePrimary = async (address, city, area, pincode, attempt = 0) => {
  try {
    const response = await api.get("/locations/geocode", {
      params: { address, city, area, pincode, country: "India", countrycodes: "in" },
    });
    const geocodeResult = response.data?.data ?? response.data;
    const result = {
      latitude: Number(geocodeResult.data?.latitude || geocodeResult.latitude),
      longitude: Number(geocodeResult.data?.longitude || geocodeResult.longitude),
    };

    if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
      throw new Error('Invalid coordinates received');
    }

    if (!hasUsableIndiaCoordinates(result)) {
      throw new Error("Could not find a valid Indian location for this address. Please check the city, area and pincode.");
    }

    return result;
  } catch (err) {
    if (err.response?.status === 429 && attempt < MAX_RETRIES - 1) {
      const waitTime = RETRY_BACKOFF[attempt];
      console.warn(`Rate limited. Retrying after ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return geocodePrimary(address, city, area, pincode, attempt + 1);
    }

    console.error("Geocoding API error:", err);
    throw new Error(
      err.response?.data?.message ||
        err.message ||
        "Could not find coordinates. Please verify the address and try again."
    );
  }
};

/**
 * Process the geocode request queue with rate limiting
 */
const processGeocodeQueue = async () => {
  if (isGeocoding || geocodeRequestQueue.length === 0) return;

  isGeocoding = true;
  const { resolve, reject, address, city, area, pincode } = geocodeRequestQueue.shift();

  try {
    const cacheKey = getCacheKey(address, city, area, pincode);

    // Check cache first
    const cached = getCachedGeocode(cacheKey);
    if (cached) {
      if (hasUsableIndiaCoordinates(cached)) {
        console.log('Using cached geocode result');
        resolve(cached);
        isGeocoding = false;
        // Process next in queue after 1 second
        setTimeout(processGeocodeQueue, 1000);
        return;
      }

      geocodeCache.delete(cacheKey);
    }

    // Make API request with retry and fallback
    const geocodeResult = await geocodePrimary(address, city, area, pincode);

    // Cache the result
    setCachedGeocode(cacheKey, geocodeResult);
    resolve(geocodeResult);
  } catch (err) {
    console.error('Geocoding queue processing failed:', err);
    reject(err);
  } finally {
    isGeocoding = false;
    // Process next in queue after 1 second (respect rate limit)
    setTimeout(processGeocodeQueue, 1000);
  }
};

/**
 * Queue a geocoding request
 */
export const queueGeocodeRequest = (address, city, area = "", pincode = "") => {
  return new Promise((resolve, reject) => {
    geocodeRequestQueue.push({ resolve, reject, address, city, area, pincode });
    processGeocodeQueue();
  });
};

/**
 * Clear the geocode cache
 */
export const clearGeocodeCache = () => {
  geocodeCache.clear();
};

/**
 * Get queue length for monitoring
 */
export const getGeocodeQueueLength = () => {
  return geocodeRequestQueue.length;
};
