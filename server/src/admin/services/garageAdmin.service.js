const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deleteCache, deletePattern } = require("../../utils/cache");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const BROADCAST_STATUS = require("../../constants/broadcastStatus");
const { deleteGaragesDeep } = require("./garageDeletion.service");

const garageListInclude = {
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

const garageDetailInclude = {
  ...garageListInclude,
  reviews: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      booking: {
        select: {
          id: true,
          bookingCode: true,
          customerAcceptedAt: true,
          createdAt: true,
          vehicle: {
            select: {
              brand: true,
              model: true,
              registrationNumber: true,
            },
          },
          services: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          inspectionImages: {
            orderBy: [{ phase: "asc" }, { order: "asc" }],
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
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
    include: garageListInclude,
    orderBy: { createdAt: "desc" },
  });
};

const getGarage = async (garageId) => {
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    include: garageDetailInclude,
  });

  if (!garage) throw new ApiError(404, "Garage not found");
  return garage;
};

const invalidateGarageAdminChanges = async (garageId) => Promise.allSettled([
  deleteCache(`garages:${garageId}:services`),
  deleteCache(`garages:detail:${garageId}`),
  deleteCache("public:stats:v2"),
  deletePattern("garages:list:*"),
  deletePattern("garages:public:*"),
]);

const updateGarageDetails = async (garageId, payload = {}) => {
  const existingGarage = await getGarage(garageId);
  const allowed = ["name", "description", "phone", "whatsappNo", "email", "address", "city", "area", "latitude", "longitude", "workingRadiusKm", "garageType", "supportedBrands", "openingTime", "closingTime", "isVerified"];
  const data = Object.fromEntries(allowed.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
  const ownerFieldMap = {
    ownerName: "name",
    ownerEmail: "email",
    ownerPhone: "phone",
  };
  const ownerData = Object.fromEntries(
    Object.entries(ownerFieldMap)
      .filter(([payloadKey]) => payload[payloadKey] !== undefined)
      .map(([payloadKey, ownerKey]) => [ownerKey, payload[payloadKey]]),
  );

  if (!Object.keys(data).length && !Object.keys(ownerData).length) {
    throw new ApiError(400, "No garage changes were provided");
  }

  if (Object.keys(ownerData).length && !existingGarage.ownerId) {
    throw new ApiError(400, "This garage does not have a linked owner account");
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      await tx.garage.update({ where: { id: garageId }, data });
    }
    if (Object.keys(ownerData).length) {
      await tx.garageOwner.update({
        where: { id: existingGarage.ownerId },
        data: ownerData,
      });
    }
  });
  await invalidateGarageAdminChanges(garageId);
  return getGarage(garageId);
};

const setGarageThumbnail = async (garageId, imageId) => {
  const image = await prisma.garageImage.findFirst({ where: { id: imageId, garageId } });
  if (!image) throw new ApiError(404, "Garage photo not found");
  await prisma.$transaction([
    prisma.garageImage.updateMany({ where: { garageId }, data: { isThumbnail: false } }),
    prisma.garageImage.update({ where: { id: imageId }, data: { isThumbnail: true, order: 0 } }),
  ]);
  const images = await prisma.garageImage.findMany({ where: { garageId }, orderBy: [{ isThumbnail: "desc" }, { order: "asc" }] });
  await prisma.$transaction(images.map((item, index) => prisma.garageImage.update({ where: { id: item.id }, data: { order: index } })));
  await invalidateGarageAdminChanges(garageId);
  return getGarage(garageId);
};

const reorderGarageImages = async (garageId, imageIds = []) => {
  const images = await prisma.garageImage.findMany({ where: { garageId }, select: { id: true, isThumbnail: true } });
  if (images.length !== imageIds.length || new Set(imageIds).size !== imageIds.length || imageIds.some((id) => !images.some((image) => image.id === id))) {
    throw new ApiError(400, "Photo order must include every garage photo exactly once");
  }
  const thumbnailId = images.find((image) => image.isThumbnail)?.id || imageIds[0];
  await prisma.$transaction(imageIds.map((id, index) => prisma.garageImage.update({ where: { id }, data: { order: index, isThumbnail: id === thumbnailId } })));
  await invalidateGarageAdminChanges(garageId);
  return getGarage(garageId);
};

const setGarageActiveStatus = async (garageId, isActive) => {
  const nextIsActive = isActive === true;
  const now = new Date();

  const { affectedCustomerIds } = await prisma.$transaction(async (tx) => {
    const existingGarage = await tx.garage.findUnique({
      where: { id: garageId },
      select: { id: true, isActive: true },
    });

    if (!existingGarage) throw new ApiError(404, "Garage not found");

    await tx.garage.update({
      where: { id: garageId },
      data: { isActive: nextIsActive },
    });

    let customerIds = [];

    if (!nextIsActive) {
      const pendingRequests = await tx.garageBroadcastRequest.findMany({
        where: {
          garageId,
          status: BROADCAST_STATUS.SENT,
        },
        select: {
          booking: { select: { userId: true } },
        },
      });

      customerIds = [
        ...new Set(
          pendingRequests
            .map((request) => request.booking?.userId)
            .filter(Boolean),
        ),
      ];

      await tx.garageBroadcastRequest.updateMany({
        where: {
          garageId,
          status: BROADCAST_STATUS.SENT,
        },
        data: {
          status: BROADCAST_STATUS.EXPIRED,
          expiredAt: now,
        },
      });
    }

    return { affectedCustomerIds: customerIds };
  });

  await Promise.allSettled([
    deleteCache(`garages:${garageId}:services`),
    deleteCache(`garages:detail:${garageId}`),
    deleteCache("public:stats:v2"),
    deletePattern("garages:list:*"),
    deletePattern("garages:public:*"),
    ...affectedCustomerIds.map((userId) => invalidateCustomerCache(userId)),
  ]);

  return getGarage(garageId);
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
    deletePattern("garages:public:*"),
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
    deletePattern("garages:public:*"),
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
  setGarageActiveStatus,
  updateGarageDetails,
  setGarageThumbnail,
  reorderGarageImages,
  upsertGarageService,
};
