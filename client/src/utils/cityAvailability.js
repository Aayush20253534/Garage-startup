import { cityApi } from "@/api/cities";

export const UNAVAILABLE_CITY_MESSAGE =
  "Sorry, the service isn't available in your region.";

let activeCityCache = null;

const normalizeCity = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\d{5,6}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const compact = (values = []) =>
  values.map((value) => String(value || "").trim()).filter(Boolean);

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
        !["india", "bharat"].includes(normalizeCity(part)),
    );

const getLocationCandidates = (locationOrCity) => {
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

export const loadActiveCities = async () => {
  if (activeCityCache) return activeCityCache;
  activeCityCache = await cityApi.getCities();
  return activeCityCache || [];
};

export const findAvailableCity = async (locationOrCity) => {
  const candidates = getLocationCandidates(locationOrCity);
  if (candidates.length === 0) return null;

  const cities = await loadActiveCities();
  const cityByKey = new Map(
    cities.map((city) => [normalizeCity(city.name), city]),
  );

  for (const candidate of candidates) {
    const matchedCity = cityByKey.get(normalizeCity(candidate));
    if (matchedCity) return matchedCity;
  }

  return null;
};

export const getAvailableCityName = async (locationOrCity) => {
  const city = await findAvailableCity(locationOrCity);
  return city?.name || "";
};

export const requireAvailableCityName = async (locationOrCity) => {
  const cityName = await getAvailableCityName(locationOrCity);

  if (!cityName) {
    throw new Error(UNAVAILABLE_CITY_MESSAGE);
  }

  return cityName;
};

export const isCityAvailable = async (cityName) =>
  Boolean(await findAvailableCity(String(cityName || "")));

export const resetCityAvailabilityCache = () => {
  activeCityCache = null;
};
