import api from "@/api/axios";
import { hasUsableIndiaCoordinates } from "@/utils/address";

/**
 * Frontend geocoding queue.
 * Google requests are made only by the Rovauto backend, so the server API key
 * never appears in browser code.
 */

const geocodeRequestQueue = [];
const inFlightRequests = new Map();

let isGeocoding = false;

const MAX_RETRIES = 3;
const RETRY_BACKOFF = [1000, 2500, 5000];
const QUEUE_DELAY_MS = 350;

const normalizePart = (value) => String(value || "").trim();

const getRequestKey = (address, city, area, pincode) =>
  [address, city, area, pincode]
    .map((part) => normalizePart(part).toLowerCase())
    .join("|");

const unwrapApiData = (response) => response?.data?.data ?? response?.data ?? {};

const geocodePrimary = async (
  address,
  city,
  area,
  pincode,
  attempt = 0,
) => {
  try {
    const response = await api.get("/locations/geocode", {
      params: {
        address,
        city,
        area,
        pincode,
      },
    });

    const geocodeResult = unwrapApiData(response);
    const result = {
      latitude: Number(geocodeResult.latitude),
      longitude: Number(geocodeResult.longitude),
      fullAddress:
        geocodeResult.fullAddress || geocodeResult.displayName || "",
      placeId: geocodeResult.placeId || null,
      locationType: geocodeResult.locationType || null,
      provider: geocodeResult.provider || "google",
      attribution: geocodeResult.attribution || "Google Maps",
    };

    if (!hasUsableIndiaCoordinates(result)) {
      throw new Error(
        "Could not find a valid service-area location for this address. Please check the city, area and pincode.",
      );
    }

    return result;
  } catch (error) {
    const status = Number(error.response?.status || 0);
    const isRetryable = status === 429 || status >= 500 || !error.response;

    if (isRetryable && attempt < MAX_RETRIES - 1) {
      const waitTime = RETRY_BACKOFF[attempt];
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      return geocodePrimary(
        address,
        city,
        area,
        pincode,
        attempt + 1,
      );
    }

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "Could not find coordinates. Please verify the address and try again.",
    );
  }
};

const processGeocodeQueue = async () => {
  if (isGeocoding || geocodeRequestQueue.length === 0) return;

  isGeocoding = true;
  const request = geocodeRequestQueue.shift();

  try {
    const result = await geocodePrimary(
      request.address,
      request.city,
      request.area,
      request.pincode,
    );

    request.resolve(result);
  } catch (error) {
    request.reject(error);
  } finally {
    isGeocoding = false;
    setTimeout(processGeocodeQueue, QUEUE_DELAY_MS);
  }
};

export const queueGeocodeRequest = (
  address,
  city,
  area = "",
  pincode = "",
) => {
  const requestKey = getRequestKey(address, city, area, pincode);

  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey);
  }

  const promise = new Promise((resolve, reject) => {
    geocodeRequestQueue.push({
      resolve,
      reject,
      address,
      city,
      area,
      pincode,
    });

    processGeocodeQueue();
  }).finally(() => {
    inFlightRequests.delete(requestKey);
  });

  inFlightRequests.set(requestKey, promise);
  return promise;
};

export const clearGeocodeCache = () => {
  // Google geocoding results are intentionally not retained in a client cache.
  inFlightRequests.clear();
};

export const getGeocodeQueueLength = () => geocodeRequestQueue.length;
