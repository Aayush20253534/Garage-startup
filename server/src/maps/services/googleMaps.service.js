const crypto = require("crypto");
const axios = require("axios");
const ApiError = require("../../utils/apiError");

const PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";
const COMPUTE_ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const COMPUTE_ROUTE_MATRIX_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const SNAP_TO_ROADS_URL =
  "https://roads.googleapis.com/v1/snapToRoads";
const ADDRESS_VALIDATION_URL =
  "https://addressvalidation.googleapis.com/v1:validateAddress";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ROUTE_OPTIMIZATION_SCOPE =
  "https://www.googleapis.com/auth/cloud-platform";

const DEFAULT_REGION_CODES = ["in"];
const SUPPORTED_BOUNDS = [
  {
    code: "in",
    minLatitude: 6,
    maxLatitude: 38,
    minLongitude: 68,
    maxLongitude: 98,
  },
];

let routeOptimizationTokenCache = null;

const normalizeText = (value) => String(value || "").trim();

const getRegionCodes = () => {
  const configured = normalizeText(
    process.env.GOOGLE_MAPS_REGION_CODES || process.env.GOOGLE_MAPS_REGION_CODE,
  );
  const values = configured
    ? configured.split(",").map((item) => item.trim().toLowerCase())
    : DEFAULT_REGION_CODES;

  const unique = [...new Set(values.filter(Boolean))];
  return unique.length ? unique : DEFAULT_REGION_CODES;
};

const getPrimaryRegionCode = () => getRegionCodes()[0] ;

const getApiKey = () => {
  const key = normalizeText(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_BROWSER_KEY ||
      process.env.VITE_GOOGLE_MAPS_BROWSER_KEY,
  );
  if (!key) {
    throw new ApiError(503, "Google Maps web services are not configured");
  }
  return key;
};

const getTimeoutMs = () => {
  const configured = Number(process.env.GOOGLE_MAPS_TIMEOUT_MS || 8000);
  if (!Number.isFinite(configured)) return 8000;
  return Math.max(2000, Math.min(configured, 30000));
};

const isCoordinate = (value) => Number.isFinite(Number(value));

const isWithinSupportedBounds = ({ latitude, longitude }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const regionCodes = new Set(getRegionCodes());
  return SUPPORTED_BOUNDS.filter((bounds) => regionCodes.has(bounds.code)).some(
    (bounds) =>
      lat >= bounds.minLatitude &&
      lat <= bounds.maxLatitude &&
      lng >= bounds.minLongitude &&
      lng <= bounds.maxLongitude,
  );
};

const normalizeCoordinate = (coordinate, label = "location") => {
  const latitude = Number(
    coordinate?.latitude ?? coordinate?.lat ?? coordinate?.location?.latitude,
  );
  const longitude = Number(
    coordinate?.longitude ?? coordinate?.lng ?? coordinate?.location?.longitude,
  );

  if (!isWithinSupportedBounds({ latitude, longitude })) {
    throw new ApiError(400, `Invalid service-area ${label} coordinates`);
  }

  return { latitude, longitude };
};

const parseDurationSeconds = (duration) => {
  if (duration === null || duration === undefined) return null;
  const match = String(duration).match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return null;
  return Math.round(Number(match[1]));
};

const parseGoogleError = (error, fallbackMessage) => {
  if (error instanceof ApiError) return error;

  const status = Number(error.response?.status || 0);
  const providerMessage =
    error.response?.data?.error?.message ||
    error.response?.data?.error_message ||
    error.message;

  console.error("[google-maps] request failed", {
    status,
    message: providerMessage,
    endpoint: error.config?.url,
  });

  if (status === 400) return new ApiError(400, providerMessage || fallbackMessage);
  if (status === 401 || status === 403) {
    return new ApiError(502, "Google Maps rejected the configured credentials");
  }
  if (status === 429) {
    return new ApiError(429, "Google Maps request limit reached. Try again later.");
  }
  if (status >= 500 || error.code === "ECONNABORTED") {
    return new ApiError(503, "Google Maps is temporarily unavailable");
  }

  return new ApiError(502, fallbackMessage);
};

const getAddressComponent = (components = [], acceptedTypes = [], short = false) => {
  const component = components.find((item) =>
    acceptedTypes.some((type) => item.types?.includes(type)),
  );
  if (!component) return "";
  return short
    ? component.shortText || component.short_name || ""
    : component.longText || component.long_name || "";
};

const parsePlaceAddress = (place = {}) => {
  const components = place.addressComponents || place.address_components || [];
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
  const state = getAddressComponent(components, ["administrative_area_level_1"]);
  const pincode = getAddressComponent(components, ["postal_code"]);
  const country = getAddressComponent(components, ["country"]);
  const countryCode = getAddressComponent(components, ["country"], true);

  const street = [
    premise,
    subpremise,
    [streetNumber, route].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    address: street,
    area,
    city,
    state,
    pincode,
    country: country || "India",
    countryCode,
  };
};

const autocompletePlaces = async ({
  input,
  sessionToken,
  latitude,
  longitude,
}) => {
  const cleanInput = normalizeText(input);
  if (cleanInput.length < 3) return [];

  const body = {
    input: cleanInput,
    sessionToken: normalizeText(sessionToken) || undefined,
    includedRegionCodes: getRegionCodes(),
    regionCode: getPrimaryRegionCode(),
    languageCode: process.env.GOOGLE_MAPS_LANGUAGE || "en",
    includeQueryPredictions: false,
  };

  if (isCoordinate(latitude) && isCoordinate(longitude)) {
    const origin = normalizeCoordinate({ latitude, longitude }, "search origin");
    body.origin = origin;
    body.locationBias = {
      circle: {
        center: origin,
        radius: Math.max(
          1000,
          Math.min(Number(process.env.GOOGLE_PLACES_BIAS_RADIUS_M || 50000), 50000),
        ),
      },
    };
  }

  try {
    const response = await axios.post(PLACES_AUTOCOMPLETE_URL, body, {
      timeout: getTimeoutMs(),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types,suggestions.placePrediction.distanceMeters",
      },
    });

    return (response.data?.suggestions || [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        placeId: prediction.placeId,
        text: prediction.text?.text || "",
        mainText: prediction.structuredFormat?.mainText?.text || "",
        secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
        types: prediction.types || [],
        distanceMeters: prediction.distanceMeters ?? null,
      }));
  } catch (error) {
    throw parseGoogleError(error, "Unable to load address suggestions");
  }
};

const getPlaceDetails = async ({ placeId, sessionToken }) => {
  const cleanPlaceId = normalizeText(placeId);
  if (!cleanPlaceId) throw new ApiError(400, "Place ID is required");

  try {
    const response = await axios.get(
      `${PLACE_DETAILS_BASE_URL}/${encodeURIComponent(cleanPlaceId)}`,
      {
        timeout: getTimeoutMs(),
        params: {
          languageCode: process.env.GOOGLE_MAPS_LANGUAGE || "en",
          regionCode: getPrimaryRegionCode(),
          ...(sessionToken ? { sessionToken } : {}),
        },
        headers: {
          "X-Goog-Api-Key": getApiKey(),
          "X-Goog-FieldMask":
            "id,formattedAddress,location,addressComponents,viewport,plusCode,types",
        },
      },
    );

    const place = response.data || {};
    const location = normalizeCoordinate(place.location, "place");
    const address = parsePlaceAddress(place);

    const allowedCountryCodes = new Set(
      getRegionCodes().map((code) => code.toUpperCase()),
    );
    if (
      address.countryCode &&
      allowedCountryCodes.size > 0 &&
      !allowedCountryCodes.has(address.countryCode)
    ) {
      throw new ApiError(400, "Select an address within the service area");
    }

    return {
      placeId: place.id || cleanPlaceId,
      formattedAddress: place.formattedAddress || "",
      fullAddress: place.formattedAddress || "",
      latitude: location.latitude,
      longitude: location.longitude,
      address,
      addressComponents: place.addressComponents || [],
      viewport: place.viewport || null,
      plusCode: place.plusCode || null,
      types: place.types || [],
      attribution: "Google Maps",
    };
  } catch (error) {
    throw parseGoogleError(error, "Unable to load place details");
  }
};

const validateAddress = async ({ addressLines = [], locality, administrativeArea, postalCode }) => {
  const lines = (Array.isArray(addressLines) ? addressLines : [addressLines])
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 3);

  if (!lines.length) {
    throw new ApiError(400, "At least one address line is required");
  }

  try {
    const response = await axios.post(
      ADDRESS_VALIDATION_URL,
      {
        address: {
          regionCode: getPrimaryRegionCode().toUpperCase(),
          languageCode: process.env.GOOGLE_MAPS_LANGUAGE || "en",
          addressLines: lines,
          ...(normalizeText(locality) && { locality: normalizeText(locality) }),
          ...(normalizeText(administrativeArea) && {
            administrativeArea: normalizeText(administrativeArea),
          }),
          ...(normalizeText(postalCode) && { postalCode: normalizeText(postalCode) }),
        },
      },
      {
        timeout: getTimeoutMs(),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": getApiKey(),
        },
      },
    );

    const result = response.data?.result || {};
    const verdict = result.verdict || {};
    const postalAddress = result.address?.postalAddress || {};
    const geocode = result.geocode || {};
    const location = geocode.location && isWithinSupportedBounds(geocode.location)
      ? normalizeCoordinate(geocode.location, "validated address")
      : null;

    return {
      responseId: response.data?.responseId || null,
      formattedAddress: result.address?.formattedAddress || lines.join(", "),
      postalAddress,
      addressComponents: result.address?.addressComponents || [],
      location,
      placeId: geocode.placeId || null,
      plusCode: geocode.plusCode || null,
      verdict: {
        inputGranularity: verdict.inputGranularity || null,
        validationGranularity: verdict.validationGranularity || null,
        geocodeGranularity: verdict.geocodeGranularity || null,
        addressComplete: Boolean(verdict.addressComplete),
        hasUnconfirmedComponents: Boolean(verdict.hasUnconfirmedComponents),
        hasInferredComponents: Boolean(verdict.hasInferredComponents),
        hasReplacedComponents: Boolean(verdict.hasReplacedComponents),
      },
      accepted:
        Boolean(verdict.addressComplete) &&
        !Boolean(verdict.hasUnconfirmedComponents),
      attribution: "Google Maps Address Validation",
    };
  } catch (error) {
    throw parseGoogleError(error, "Unable to validate this address");
  }
};

const buildWaypoint = (coordinate) => ({
  location: {
    latLng: normalizeCoordinate(coordinate),
  },
});

const computeRoute = async ({
  origin,
  destination,
  trafficAware = false,
  alternatives = false,
}) => {
  try {
    const response = await axios.post(
      COMPUTE_ROUTES_URL,
      {
        origin: buildWaypoint(origin),
        destination: buildWaypoint(destination),
        travelMode: "DRIVE",
        routingPreference: trafficAware ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
        computeAlternativeRoutes: Boolean(alternatives),
        languageCode: process.env.GOOGLE_MAPS_LANGUAGE || "en-US",
        units: "METRIC",
      },
      {
        timeout: getTimeoutMs(),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": getApiKey(),
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline,routes.viewport,routes.localizedValues,routes.routeLabels",
        },
      },
    );

    const route = response.data?.routes?.[0];
    if (!route) throw new ApiError(404, "No driving route was found");

    return {
      distanceMeters: Number(route.distanceMeters || 0),
      distanceKm: Number(((route.distanceMeters || 0) / 1000).toFixed(1)),
      durationSeconds: parseDurationSeconds(route.duration),
      staticDurationSeconds: parseDurationSeconds(route.staticDuration),
      encodedPolyline: route.polyline?.encodedPolyline || null,
      viewport: route.viewport || null,
      localizedValues: route.localizedValues || null,
      routeLabels: route.routeLabels || [],
    };
  } catch (error) {
    throw parseGoogleError(error, "Unable to calculate the driving route");
  }
};

const computeRouteMatrix = async ({
  origins,
  destinations,
  trafficAware = false,
}) => {
  const safeOrigins = (origins || []).map((item) => ({ waypoint: buildWaypoint(item) }));
  const safeDestinations = (destinations || []).map((item) => ({
    waypoint: buildWaypoint(item),
  }));

  if (!safeOrigins.length || !safeDestinations.length) {
    throw new ApiError(400, "At least one origin and destination are required");
  }

  if (safeOrigins.length * safeDestinations.length > 100) {
    throw new ApiError(400, "Route matrix is limited to 100 traffic-aware elements");
  }

  try {
    const response = await axios.post(
      COMPUTE_ROUTE_MATRIX_URL,
      {
        origins: safeOrigins,
        destinations: safeDestinations,
        travelMode: "DRIVE",
        routingPreference: trafficAware ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
        languageCode: process.env.GOOGLE_MAPS_LANGUAGE || "en-US",
        units: "METRIC",
      },
      {
        timeout: getTimeoutMs(),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": getApiKey(),
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,distanceMeters,duration,staticDuration,status,condition,localizedValues",
        },
      },
    );

    return (Array.isArray(response.data) ? response.data : []).map((element) => ({
      originIndex: element.originIndex,
      destinationIndex: element.destinationIndex,
      distanceMeters: Number(element.distanceMeters || 0),
      distanceKm: Number(((element.distanceMeters || 0) / 1000).toFixed(1)),
      durationSeconds: parseDurationSeconds(element.duration),
      staticDurationSeconds: parseDurationSeconds(element.staticDuration),
      condition: element.condition || null,
      status: element.status || null,
      localizedValues: element.localizedValues || null,
    }));
  } catch (error) {
    throw parseGoogleError(error, "Unable to calculate driving times");
  }
};

const rankDestinations = async ({ origin, destinations, trafficAware = false }) => {
  const matrix = await computeRouteMatrix({
    origins: [origin],
    destinations,
    trafficAware,
  });

  return matrix
    .filter((element) => element.condition === "ROUTE_EXISTS")
    .sort((left, right) => {
      const leftDuration = left.durationSeconds ?? Number.MAX_SAFE_INTEGER;
      const rightDuration = right.durationSeconds ?? Number.MAX_SAFE_INTEGER;
      return leftDuration - rightDuration;
    });
};

const snapToRoads = async ({ points, interpolate = true }) => {
  const safePoints = (points || []).slice(-100).map((point) =>
    normalizeCoordinate(point, "tracking"),
  );

  if (safePoints.length < 2) {
    return safePoints.map((point, index) => ({
      location: point,
      originalIndex: index,
      placeId: null,
    }));
  }

  try {
    const response = await axios.get(SNAP_TO_ROADS_URL, {
      timeout: getTimeoutMs(),
      params: {
        path: safePoints
          .map((point) => `${point.latitude},${point.longitude}`)
          .join("|"),
        interpolate: Boolean(interpolate),
        key: getApiKey(),
      },
    });

    return (response.data?.snappedPoints || []).map((point) => ({
      location: {
        latitude: Number(point.location?.latitude),
        longitude: Number(point.location?.longitude),
      },
      originalIndex: point.originalIndex ?? null,
      placeId: point.placeId || null,
    }));
  } catch (error) {
    throw parseGoogleError(error, "Unable to align tracking points to roads");
  }
};

const base64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const getRouteOptimizationCredentials = () => {
  const projectId = normalizeText(
    process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  );
  const clientEmail = normalizeText(
    process.env.GOOGLE_ROUTE_OPTIMIZATION_CLIENT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL,
  );
  const privateKey = normalizeText(
    process.env.GOOGLE_ROUTE_OPTIMIZATION_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY,
  ).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new ApiError(
      503,
      "Route Optimization service-account credentials are not configured",
    );
  }

  return { projectId, clientEmail, privateKey };
};

const getRouteOptimizationAccessToken = async () => {
  if (
    routeOptimizationTokenCache &&
    routeOptimizationTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return routeOptimizationTokenCache.token;
  }

  const { clientEmail, privateKey } = getRouteOptimizationCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: ROUTE_OPTIMIZATION_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsigned), privateKey)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  try {
    const response = await axios.post(
      GOOGLE_OAUTH_TOKEN_URL,
      new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
      }).toString(),
      {
        timeout: getTimeoutMs(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    routeOptimizationTokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + Number(response.data.expires_in || 3600) * 1000,
    };

    return routeOptimizationTokenCache.token;
  } catch (error) {
    throw parseGoogleError(error, "Unable to authenticate Route Optimization");
  }
};

const optimizeTours = async ({ model, timeout = "20s", label = "rovauto" }) => {
  const { projectId } = getRouteOptimizationCredentials();
  const token = await getRouteOptimizationAccessToken();

  try {
    const response = await axios.post(
      `https://routeoptimization.googleapis.com/v1/projects/${encodeURIComponent(
        projectId,
      )}:optimizeTours`,
      {
        timeout,
        model,
        solvingMode: "DEFAULT_SOLVE",
        searchMode: "RETURN_FAST",
        considerRoadTraffic: true,
        populatePolylines: true,
        populateTransitionPolylines: true,
        label,
      },
      {
        timeout: Math.max(getTimeoutMs(), 30000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    throw parseGoogleError(error, "Unable to optimize routes");
  }
};

const getBrowserConfig = () => ({
  enabled: Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY),
  browserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || null,
  mapId: process.env.GOOGLE_MAPS_MAP_ID || null,
  country: getPrimaryRegionCode().toUpperCase(),
  defaultCenter: {
    latitude: Number(process.env.GOOGLE_MAPS_DEFAULT_LATITUDE || 27.7172),
    longitude: Number(process.env.GOOGLE_MAPS_DEFAULT_LONGITUDE || 85.324),
  },
});

module.exports = {
  autocompletePlaces,
  validateAddress,
  computeRoute,
  computeRouteMatrix,
  getBrowserConfig,
  getPlaceDetails,
  isWithinIndia: isWithinSupportedBounds,
  normalizeCoordinate,
  optimizeTours,
  parseDurationSeconds,
  rankDestinations,
  snapToRoads,
};
