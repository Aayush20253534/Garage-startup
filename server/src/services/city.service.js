const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const normalizeKey = (value) => normalizeName(value).toLowerCase();

const listCities = async ({ includeInactive = false } = {}) => {
  return prisma.city.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ name: "asc" }],
  });
};

const createCity = async ({ name, state = "" }) => {
  const cityName = normalizeName(name);
  const normalizedName = normalizeKey(cityName);
  if (!cityName) throw new ApiError(400, "City name is required");

  const existing = await prisma.city.findUnique({ where: { normalizedName } });
  if (existing) throw new ApiError(409, "City already exists");

  return prisma.city.create({
    data: {
      name: cityName,
      normalizedName,
      state: normalizeName(state) || null,
      isActive: true,
    },
  });
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

  return prisma.city.update({
    where: { id: cityId },
    data: {
      name: cityName,
      normalizedName,
      ...(payload.state !== undefined && { state: normalizeName(payload.state) || null }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive === true || payload.isActive === "true" }),
    },
  });
};

module.exports = {
  createCity,
  listCities,
  updateCity,
};
