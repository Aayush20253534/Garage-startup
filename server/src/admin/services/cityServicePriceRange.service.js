const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const normalizeText = (value) => String(value || "").trim();
const normalizeCity = (city) => normalizeText(city).toLowerCase();

const listPriceRanges = async (query = {}) => {
  const where = {
    ...(query.city && { city: normalizeCity(query.city) }),
    ...(query.serviceId && { serviceId: query.serviceId }),
    ...(query.vehicleBrand && { vehicleBrand: normalizeText(query.vehicleBrand) }),
    ...(query.vehicleModel && { vehicleModel: normalizeText(query.vehicleModel) }),
    ...(query.fuelType && { fuelType: query.fuelType }),
    ...(query.isActive !== undefined && { isActive: query.isActive === "true" }),
  };

  return prisma.cityServicePriceRange.findMany({
    where,
    include: { service: { include: { category: true } } },
    orderBy: [{ city: "asc" }, { createdAt: "desc" }],
  });
};

const getPriceRange = async (id) => {
  const priceRange = await prisma.cityServicePriceRange.findUnique({
    where: { id },
    include: { service: { include: { category: true } } },
  });
  if (!priceRange) throw new ApiError(404, "Price range not found");
  return priceRange;
};

const createPriceRange = async (payload) => {
  if (Number(payload.maxPrice) < Number(payload.minPrice)) {
    throw new ApiError(400, "maxPrice must be greater than or equal to minPrice");
  }

  const service = await prisma.service.findUnique({ where: { id: payload.serviceId } });
  if (!service) throw new ApiError(404, "Service not found");

  return prisma.cityServicePriceRange.create({
    data: {
      city: normalizeCity(payload.city),
      serviceId: payload.serviceId,
      vehicleBrand: payload.vehicleBrand ? normalizeText(payload.vehicleBrand) : null,
      vehicleModel: payload.vehicleModel ? normalizeText(payload.vehicleModel) : null,
      fuelType: payload.fuelType || null,
      minPrice: Number(payload.minPrice),
      maxPrice: Number(payload.maxPrice),
      isActive: payload.isActive === undefined ? true : payload.isActive === true || payload.isActive === "true",
    },
    include: { service: { include: { category: true } } },
  });
};

const updatePriceRange = async (id, payload) => {
  await getPriceRange(id);

  if (payload.minPrice !== undefined && payload.maxPrice !== undefined && Number(payload.maxPrice) < Number(payload.minPrice)) {
    throw new ApiError(400, "maxPrice must be greater than or equal to minPrice");
  }

  return prisma.cityServicePriceRange.update({
    where: { id },
    data: {
      ...(payload.city !== undefined && { city: normalizeCity(payload.city) }),
      ...(payload.serviceId !== undefined && { serviceId: payload.serviceId }),
      ...(payload.vehicleBrand !== undefined && { vehicleBrand: payload.vehicleBrand ? normalizeText(payload.vehicleBrand) : null }),
      ...(payload.vehicleModel !== undefined && { vehicleModel: payload.vehicleModel ? normalizeText(payload.vehicleModel) : null }),
      ...(payload.fuelType !== undefined && { fuelType: payload.fuelType || null }),
      ...(payload.minPrice !== undefined && { minPrice: Number(payload.minPrice) }),
      ...(payload.maxPrice !== undefined && { maxPrice: Number(payload.maxPrice) }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive === true || payload.isActive === "true" }),
    },
    include: { service: { include: { category: true } } },
  });
};

const deletePriceRange = async (id) => {
  await getPriceRange(id);
  return prisma.cityServicePriceRange.delete({ where: { id } });
};

const scoreMatch = (range, vehicle) => {
  let score = 0;
  if (range.vehicleBrand && range.vehicleBrand.toLowerCase() !== String(vehicle.brand || "").toLowerCase()) return -1;
  if (range.vehicleModel && range.vehicleModel.toLowerCase() !== String(vehicle.model || "").toLowerCase()) return -1;
  if (range.fuelType && range.fuelType !== vehicle.fuelType) return -1;
  if (range.vehicleBrand) score += 2;
  if (range.vehicleModel) score += 3;
  if (range.fuelType) score += 1;
  return score;
};

const findBestPriceRangesForBooking = async ({ city, services, vehicle }) => {
  const normalizedCity = normalizeCity(city);
  if (!normalizedCity) return new Map();

  const ranges = await prisma.cityServicePriceRange.findMany({
    where: {
      city: normalizedCity,
      serviceId: { in: services.map((service) => service.id) },
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const result = new Map();
  for (const service of services) {
    const best = ranges
      .filter((range) => range.serviceId === service.id)
      .map((range) => ({ range, score: scoreMatch(range, vehicle) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.range.createdAt - a.range.createdAt;
      })[0]?.range;

    if (best) result.set(service.id, best);
  }

  return result;
};

module.exports = {
  createPriceRange,
  deletePriceRange,
  findBestPriceRangesForBooking,
  getPriceRange,
  listPriceRanges,
  updatePriceRange,
};
