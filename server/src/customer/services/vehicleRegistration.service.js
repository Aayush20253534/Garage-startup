const axios = require("axios");
const ApiError = require("../../utils/apiError");
const { getCache, setCache } = require("../../utils/cache");
const {
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
} = require("../../utils/vehicleRegistration");
const {
  parseWay2ApiVehicle,
  parseWay2ApiAdminVehicle,
} = require("../../utils/way2apiRc");

const PROVIDER = "WAY2API_RC";
const DEFAULT_URL = "https://app.way2api.com/api/v1/rc/verify";
const SUCCESS_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const NOT_FOUND_CACHE_TTL_SECONDS = 5 * 60;

const clean = (value) => String(value || "").trim();

const normalizeWords = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeMaker = (value) => {
  const removable = new Set([
    "motor",
    "motors",
    "india",
    "limited",
    "ltd",
    "private",
    "pvt",
    "company",
    "co",
    "ag",
    "inc",
  ]);

  return normalizeWords(value)
    .split(" ")
    .filter((part) => part && !removable.has(part))
    .join(" ");
};

const containsPhrase = (left, right) => {
  const leftValue = ` ${normalizeWords(left)} `;
  const rightValue = ` ${normalizeWords(right)} `;
  if (!leftValue.trim() || !rightValue.trim()) return null;
  return leftValue.includes(rightValue) || rightValue.includes(leftValue);
};

const compareMaker = (selectedBrand, rcMaker) => {
  if (!clean(selectedBrand) || !clean(rcMaker)) return null;
  const selected = normalizeMaker(selectedBrand);
  const registered = normalizeMaker(rcMaker);
  if (!selected || !registered) return null;
  return (
    ` ${registered} `.includes(` ${selected} `) ||
    ` ${selected} `.includes(` ${registered} `)
  );
};

const compareModel = (selectedModel, rcModel) => {
  if (!clean(selectedModel) || !clean(rcModel)) return null;
  const phraseMatch = containsPhrase(selectedModel, rcModel);
  if (phraseMatch) return true;

  const selectedCompact = normalizeWords(selectedModel).replace(/\s+/g, "");
  const registeredCompact = normalizeWords(rcModel).replace(/\s+/g, "");
  if (!selectedCompact || !registeredCompact) return null;
  return (
    registeredCompact.includes(selectedCompact) ||
    selectedCompact.includes(registeredCompact)
  );
};

const normalizeFuel = (value) => {
  const normalized = normalizeWords(value).toUpperCase();
  if (!normalized) return "";
  if (normalized.includes("PETROL") || normalized.includes("GASOLINE")) {
    return "PETROL";
  }
  if (normalized.includes("DIESEL")) return "DIESEL";
  if (normalized.includes("CNG")) return "CNG";
  if (normalized.includes("ELECTRIC") || normalized.includes("BATTERY")) {
    return "ELECTRIC";
  }
  if (normalized.includes("HYBRID")) return "HYBRID";
  return normalized;
};

const compareFuel = (selectedFuel, rcFuel) => {
  if (!clean(selectedFuel) || !clean(rcFuel)) return null;
  return normalizeFuel(selectedFuel) === normalizeFuel(rcFuel);
};

const compareVehicleDetails = (expected = {}, vehicle = {}) => {
  const matches = {
    brand: compareMaker(expected.brand, vehicle.maker),
    model: compareModel(expected.model, vehicle.model),
    fuelType: compareFuel(expected.fuelType, vehicle.fuelType),
  };

  // RC maker strings can identify the manufacturer rather than the exact
  // consumer-facing brand. A strong model match therefore wins over a
  // maker-only mismatch, while model/fuel mismatches still block verification.
  const blockingMismatch =
    matches.model === false ||
    matches.fuelType === false ||
    (matches.brand === false && matches.model !== true);

  return {
    matches,
    matchesSelectedVehicle: !blockingMismatch,
  };
};

const getLookupCacheKey = (registrationNumber) =>
  `vehicle-registration:way2api:${normalizeRegistrationNumber(registrationNumber)}`;

const getProviderConfig = () => ({
  enabled:
    String(process.env.VEHICLE_REGISTRATION_VERIFICATION_ENABLED || "true")
      .trim()
      .toLowerCase() !== "false",
  apiKey: clean(process.env.WAY2API_API_KEY),
  url: clean(process.env.WAY2API_RC_URL) || DEFAULT_URL,
  timeoutMs: Math.max(
    3000,
    Math.min(30000, Number(process.env.WAY2API_RC_TIMEOUT_MS || 12000)),
  ),
});

const ensureConfigured = () => {
  const config = getProviderConfig();
  if (!config.enabled) {
    throw new ApiError(
      503,
      "Vehicle registration verification is temporarily disabled",
    );
  }

  if (!config.apiKey) {
    throw new ApiError(
      503,
      "Vehicle registration verification is not configured yet",
    );
  }

  return config;
};

const isNotFoundMessage = (message) =>
  /not\s*found|no\s+(?:vehicle|rc|record|data)|record\s+not\s+available/i.test(
    clean(message),
  );

const requestProvider = async (registrationNumber, { adminView = false } = {}) => {
  const config = ensureConfigured();

  let response;
  try {
    response = await axios.post(
      config.url,
      { rc_number: registrationNumber },
      {
        timeout: config.timeoutMs,
        validateStatus: () => true,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );
  } catch (error) {
    throw new ApiError(
      503,
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
        ? "Vehicle verification timed out. Please try again."
        : "Vehicle verification service is temporarily unavailable",
    );
  }

  const payload = response.data || {};
  const message = clean(payload.message || payload.error || payload.detail);

  if (response.status === 401 || response.status === 403) {
    console.error("[vehicle-registration] Way2API rejected the configured API key", {
      status: response.status,
    });
    throw new ApiError(
      503,
      "Vehicle verification service is temporarily unavailable",
    );
  }

  if (response.status === 429 || response.status >= 500) {
    throw new ApiError(
      503,
      response.status === 429
        ? "Vehicle verification is busy right now. Please try again shortly."
        : "Vehicle verification service is temporarily unavailable",
    );
  }

  if (isNotFoundMessage(message)) {
    return {
      verified: false,
      status: "NOT_FOUND",
      provider: PROVIDER,
      registrationNumber,
      vehicle: null,
    };
  }

  if (response.status === 400 || response.status === 404 || payload.success === false) {
    throw new ApiError(
      response.status === 400 ? 400 : 503,
      message ||
        (response.status === 400
          ? "Enter a valid vehicle registration number"
          : "Vehicle verification service returned an unexpected response"),
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new ApiError(
      503,
      "Vehicle verification service is temporarily unavailable",
    );
  }

  const result = payload.data?.result || payload.result;
  if (!result || typeof result !== "object") {
    throw new ApiError(
      503,
      "Vehicle verification service returned an incomplete response",
    );
  }

  const vehicle = adminView
    ? parseWay2ApiAdminVehicle(result)
    : parseWay2ApiVehicle(result);
  if (!vehicle.registrationNumber || (!vehicle.maker && !vehicle.model)) {
    throw new ApiError(
      503,
      "Vehicle verification service returned an incomplete RC record",
    );
  }

  if (vehicle.registrationNumber !== registrationNumber) {
    throw new ApiError(
      503,
      "Vehicle verification service returned a mismatched RC record",
    );
  }

  return {
    verified: true,
    status: "VERIFIED",
    provider: PROVIDER,
    registrationNumber,
    vehicle,
  };
};

const lookupRegistration = async (registrationNumber, { force = false } = {}) => {
  const normalized = normalizeRegistrationNumber(registrationNumber);
  if (!isValidRegistrationNumber(normalized)) {
    throw new ApiError(
      400,
      "Enter a valid registration number using 5 to 11 letters and numbers",
    );
  }

  const cacheKey = getLookupCacheKey(normalized);
  if (!force) {
    const cached = await getCache(cacheKey);
    if (cached) return cached;
  }

  const result = await requestProvider(normalized);
  await setCache(
    cacheKey,
    result,
    result.verified ? SUCCESS_CACHE_TTL_SECONDS : NOT_FOUND_CACHE_TTL_SECONDS,
  );
  return result;
};

const lookupRegistrationForAdmin = async (registrationNumber) => {
  const normalized = normalizeRegistrationNumber(registrationNumber);
  if (!isValidRegistrationNumber(normalized)) {
    throw new ApiError(
      400,
      "Enter a valid registration number using 5 to 11 letters and numbers",
    );
  }

  // Deliberately perform a live provider lookup here instead of reading the
  // customer's Rovauto vehicle record. Full owner names are not written to the
  // database or the shared verification cache.
  return requestProvider(normalized, { adminView: true });
};

const verifyRegistration = async ({ registrationNumber, brand, model, fuelType }) => {
  const result = await lookupRegistration(registrationNumber);
  if (!result.verified) return result;

  return {
    ...result,
    ...compareVehicleDetails({ brand, model, fuelType }, result.vehicle),
  };
};

const getRegistrationRequirement = async (tx, userId) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      vehicleRegistrationRequired: true,
    },
  });

  if (!user) throw new ApiError(404, "User not found");
  return user.vehicleRegistrationRequired === true;
};

const getVerifiedRegistrationData = async ({
  registrationNumber,
  brand,
  model,
  fuelType,
}) => {
  const verification = await verifyRegistration({
    registrationNumber,
    brand,
    model,
    fuelType,
  });

  if (!verification.verified) {
    throw new ApiError(
      400,
      "We could not find this registration number. Check it and try again.",
    );
  }

  if (!verification.matchesSelectedVehicle) {
    throw new ApiError(
      409,
      "This registration number belongs to a different vehicle. Check the brand, model, and fuel type.",
    );
  }

  return verification;
};

const toVehicleVerificationFields = (verification) => ({
  registrationNumber: verification.registrationNumber,
  registrationVerified: true,
  registrationVerifiedAt: new Date(),
  registrationVerificationProvider: verification.provider,
  rcOwnerName: verification.vehicle?.ownerName || null,
  rcOwnerNameMasked: verification.vehicle?.ownerNameMasked || null,
  rcMaker: verification.vehicle?.maker || null,
  rcModel: verification.vehicle?.model || null,
  rcFuelType: verification.vehicle?.fuelType || null,
  rcVehicleClass: verification.vehicle?.vehicleClass || null,
  rcStatus: verification.vehicle?.status || null,
});

const clearedVehicleVerificationFields = () => ({
  registrationVerified: false,
  registrationVerifiedAt: null,
  registrationVerificationProvider: null,
  rcOwnerName: null,
  rcOwnerNameMasked: null,
  rcMaker: null,
  rcModel: null,
  rcFuelType: null,
  rcVehicleClass: null,
  rcStatus: null,
});

module.exports = {
  PROVIDER,
  normalizeRegistrationNumber,
  compareVehicleDetails,
  lookupRegistration,
  lookupRegistrationForAdmin,
  verifyRegistration,
  getRegistrationRequirement,
  getVerifiedRegistrationData,
  toVehicleVerificationFields,
  clearedVehicleVerificationFields,
};
