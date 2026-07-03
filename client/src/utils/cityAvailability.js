import { cityApi } from "@/api/cities";

export const UNAVAILABLE_CITY_MESSAGE = "Rovauto isn't available in your area yet.";

let activeCityCache = null;

const normalizeCity = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const loadActiveCities = async () => {
  if (activeCityCache) return activeCityCache;
  activeCityCache = await cityApi.getCities();
  return activeCityCache || [];
};

export const isCityAvailable = async (cityName) => {
  const normalized = normalizeCity(cityName);
  if (!normalized) return false;
  const cities = await loadActiveCities();
  return cities.some((city) => normalizeCity(city.name) === normalized);
};

export const resetCityAvailabilityCache = () => {
  activeCityCache = null;
};
