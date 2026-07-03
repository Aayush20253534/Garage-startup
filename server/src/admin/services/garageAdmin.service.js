const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deleteCache, deletePattern } = require("../../utils/cache");
const { deleteGaragesDeep } = require("./garageDeletion.service");

const garageInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  wallet: true,
  services: {
    include: {
      service: {
        include: {
          category: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  },
  images: {
    orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
  },
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const normalizeScope = (value) => {
  const text = String(value || "").trim();
  return text || "ALL";
};

const listGarages = async (query = {}) => {
  const where = {
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { city: { contains: query.search, mode: "insensitive" } },
        { area: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
      ],
    }),
    ...(query.isActive !== undefined && { isActive: query.isActive === "true" }),
    ...(query.isVerified !== undefined && { isVerified: query.isVerified === "true" }),
    ...(query.city && { city: { contains: query.city, mode: "insensitive" } }),
  };

  return prisma.garage.findMany({
    where,
    include: garageInclude,
    orderBy: { createdAt: "desc" },
  });
};

const getGarage = async (garageId) => {
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    include: garageInclude,
  });

  if (!garage) throw new ApiError(404, "Garage not found");
  return garage;
};

const listAssignableServices = async (query = {}) => {
  return prisma.service.findMany({
    where: {
      isActive: true,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      }),
      ...(query.categoryId && { categoryId: query.categoryId }),
    },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
};

const upsertGarageService = async (garageId, payload) => {
  await getGarage(garageId);

  const service = await prisma.service.findUnique({ where: { id: payload.serviceId } });
  if (!service) throw new ApiError(404, "Service not found");

  const vehicleBrand = normalizeScope(payload.vehicleBrand);
  const vehicleModel = normalizeScope(payload.vehicleModel);

  const garageService = await prisma.garageService.upsert({
    where: {
      garageId_serviceId_vehicleBrand_vehicleModel: {
        garageId,
        serviceId: payload.serviceId,
        vehicleBrand,
        vehicleModel,
      },
    },
    create: {
      garageId,
      serviceId: payload.serviceId,
      vehicleBrand,
      vehicleModel,
      price: null,
      isActive: parseBoolean(payload.isActive, true),
    },
    update: {
      isActive: parseBoolean(payload.isActive, true),
    },
    include: {
      service: {
        include: { category: true },
      },
    },
  });

  await Promise.all([
    deleteCache(`garages:${garageId}:services`),
    deleteCache(`garages:detail:${garageId}`),
    deletePattern("garages:list:*"),
  ]);

  return garageService;
};

const removeGarageService = async (garageId, serviceId, scope = {}) => {
  await getGarage(garageId);
  const vehicleBrand = normalizeScope(scope.vehicleBrand);
  const vehicleModel = normalizeScope(scope.vehicleModel);

  const garageService = await prisma.garageService.findUnique({
    where: {
      garageId_serviceId_vehicleBrand_vehicleModel: {
        garageId,
        serviceId,
        vehicleBrand,
        vehicleModel,
      },
    },
  });

  if (!garageService) throw new ApiError(404, "Garage service not found");

  const deleted = await prisma.garageService.delete({
    where: { id: garageService.id },
    include: {
      service: {
        include: { category: true },
      },
    },
  });

  await Promise.all([
    deleteCache(`garages:${garageId}:services`),
    deleteCache(`garages:detail:${garageId}`),
    deletePattern("garages:list:*"),
  ]);

  return deleted;
};

const deleteGarages = async (garageIds = []) => {
  const ids = Array.isArray(garageIds) ? garageIds.filter(Boolean) : [];
  if (!ids.length) throw new ApiError(400, "Select at least one garage to delete");
  return deleteGaragesDeep({ garageIds: ids });
};

module.exports = {
  deleteGarages,
  getGarage,
  listAssignableServices,
  listGarages,
  removeGarageService,
  upsertGarageService,
};
