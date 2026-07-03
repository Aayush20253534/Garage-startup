const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
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

  const price = payload.price === undefined || payload.price === null || payload.price === ""
    ? null
    : Number(payload.price);

  return prisma.garageService.upsert({
    where: {
      garageId_serviceId: {
        garageId,
        serviceId: payload.serviceId,
      },
    },
    create: {
      garageId,
      serviceId: payload.serviceId,
      price,
      isActive: parseBoolean(payload.isActive, true),
    },
    update: {
      price,
      isActive: parseBoolean(payload.isActive, true),
    },
    include: {
      service: {
        include: { category: true },
      },
    },
  });
};

const removeGarageService = async (garageId, serviceId) => {
  await getGarage(garageId);

  const garageService = await prisma.garageService.findUnique({
    where: {
      garageId_serviceId: {
        garageId,
        serviceId,
      },
    },
  });

  if (!garageService) throw new ApiError(404, "Garage service not found");

  return prisma.garageService.delete({
    where: { id: garageService.id },
    include: {
      service: {
        include: { category: true },
      },
    },
  });
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
