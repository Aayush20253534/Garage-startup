const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { getCache, setCache, deletePattern } = require("../utils/cache");

const UNAVAILABLE_CITY_MESSAGE =
  "Sorry, the service isn't available in your region.";
const CITY_CACHE_TTL_SECONDS = Number(process.env.CITY_CACHE_TTL_SECONDS || 10 * 60);

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const normalizeKey = (value) =>
  normalizeName(value)
    .toLowerCase()
    .replace(/\b\d{5,6}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const stripAdministrativeSuffix = (value) =>
  normalizeKey(value)
    .replace(
      /\s+(?:municipal corporation|municipality|metropolitan city|urban district|rural district|district|division)$/,
      "",
    )
    .trim();

const containsWholeCityName = (candidate, cityName) => {
  const candidateKey = stripAdministrativeSuffix(candidate);
  const cityKey = normalizeKey(cityName);
  if (!candidateKey || !cityKey) return false;
  if (candidateKey === cityKey) return true;

  return ` ${candidateKey} `.includes(` ${cityKey} `);
};

const compact = (values = []) => values.map(normalizeName).filter(Boolean);

const getCityListCacheKey = (includeInactive) =>
  `cities:list:${includeInactive ? "all" : "active"}`;

const invalidateCityCache = async () => {
  await Promise.allSettled([
    deletePattern("cities:*"),
    deletePattern("services:*"),
    deletePattern("price-ranges:*"),
  ]);
};

const getComponentText = (component = {}) =>
  component.longText ||
  component.long_name ||
  component.shortText ||
  component.short_name ||
  component.text ||
  "";

const componentHasType = (component = {}, types = []) =>
  Array.isArray(component.types) &&
  types.some((type) => component.types.includes(type));

const splitAddressTokens = (value = "") =>
  compact(String(value || "").split(","))
    .map((part) => part.replace(/\b\d{5,6}\b/g, "").trim())
    .filter(Boolean)
    .filter(
      (part) =>
        !["india", "bharat"].includes(normalizeKey(part)),
    );

const getLocationCityCandidates = (locationOrCity = {}) => {
  if (typeof locationOrCity === "string") {
    return [locationOrCity, ...splitAddressTokens(locationOrCity)];
  }

  const location = locationOrCity || {};
  const components = Array.isArray(location.addressComponents)
    ? location.addressComponents
    : [];

  const componentCandidates = components
    .filter((component) =>
      componentHasType(component, [
        "locality",
        "postal_town",
        "administrative_area_level_3",
        "administrative_area_level_2",
      ]),
    )
    .map(getComponentText);

  const fullAddressTokens = [
    ...splitAddressTokens(location.formattedAddress),
    ...splitAddressTokens(location.fullAddress),
    ...splitAddressTokens(location.address),
  ];

  return compact([
    ...componentCandidates,
    ...fullAddressTokens,
    location.city,
    location.locality,
    location.town,
    location.district,
    location.area,
    location.state,
  ]);
};

const listCities = async ({ includeInactive = false } = {}) => {
  const cacheKey = getCityListCacheKey(includeInactive);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const cities = await prisma.city.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ name: "asc" }],
  });

  await setCache(cacheKey, cities, CITY_CACHE_TTL_SECONDS);
  return cities;
};

const findActiveCityFromLocation = async (locationOrCity) => {
  const candidates = getLocationCityCandidates(locationOrCity);
  if (candidates.length === 0) return null;

  const cities = await listCities();
  const cityByKey = new Map(
    cities.map((city) => [city.normalizedName || normalizeKey(city.name), city]),
  );

  for (const candidate of candidates) {
    const matchedCity = cityByKey.get(normalizeKey(candidate));
    if (matchedCity) return matchedCity;
  }

  const longestCityNamesFirst = [...cities].sort(
    (left, right) => normalizeKey(right.name).length - normalizeKey(left.name).length,
  );
  for (const candidate of candidates) {
    const matchedCity = longestCityNamesFirst.find((city) =>
      containsWholeCityName(candidate, city.name),
    );
    if (matchedCity) return matchedCity;
  }

  return null;
};

const requireActiveCityFromLocation = async (locationOrCity) => {
  const city = await findActiveCityFromLocation(locationOrCity);

  if (!city) {
    throw new ApiError(400, UNAVAILABLE_CITY_MESSAGE);
  }

  return city;
};

const ensureAddressContainsCity = (address, cityName) => {
  const cleanAddress = normalizeName(address);
  const cleanCity = normalizeName(cityName);

  if (!cleanCity) return cleanAddress;
  if (!cleanAddress) return cleanCity;

  const hasCityToken = splitAddressTokens(cleanAddress).some(
    (part) => normalizeKey(part) === normalizeKey(cleanCity),
  );

  return hasCityToken ? cleanAddress : `${cleanAddress}, ${cleanCity}`;
};

const createCity = async ({ name, state = "" }) => {
  const cityName = normalizeName(name);
  const normalizedName = normalizeKey(cityName);
  if (!cityName) throw new ApiError(400, "City name is required");

  const existing = await prisma.city.findUnique({ where: { normalizedName } });
  if (existing) throw new ApiError(409, "City already exists");

  const city = await prisma.city.create({
    data: {
      name: cityName,
      normalizedName,
      state: normalizeName(state) || null,
      isActive: true,
    },
  });

  await invalidateCityCache();
  return city;
};

const updateCity = async (cityId, payload = {}) => {
  const existing = await prisma.city.findUnique({ where: { id: cityId } });
  if (!existing) throw new ApiError(404, "City not found");

  const cityName = payload.name === undefined ? existing.name : normalizeName(payload.name);
  const normalizedName = normalizeKey(cityName);
  if (!cityName) throw new ApiError(400, "City name is required");

  if (normalizedName !== existing.normalizedName) {
    const duplicate = await prisma.city.findUnique({ where: { normalizedName } });
    if (duplicate) throw new ApiError(409, "City already exists");
  }

  const city = await prisma.city.update({
    where: { id: cityId },
    data: {
      name: cityName,
      normalizedName,
      ...(payload.state !== undefined && { state: normalizeName(payload.state) || null }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive === true || payload.isActive === "true" }),
    },
  });

  await invalidateCityCache();
  return city;
};

module.exports = {
  createCity,
  containsWholeCityName,
  ensureAddressContainsCity,
  findActiveCityFromLocation,
  invalidateCityCache,
  listCities,
  normalizeKey,
  normalizeName,
  requireActiveCityFromLocation,
  updateCity,
  UNAVAILABLE_CITY_MESSAGE,
};
