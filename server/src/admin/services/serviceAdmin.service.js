const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");
const {
  ensureRestrictedCitiesExist,
} = require("../../services/serviceCityRestriction.service");
const {
  deleteFromCloudinary,
  uploadToCloudinary,
} = require("../../utils/cloudinaryUpload");
const {
  normalizeServiceFulfillmentMode,
} = require("../../constants/serviceFulfillmentType");

const THUMBNAIL_MAX_SIZE = 5 * 1024 * 1024;
const THUMBNAIL_FOLDER = "rovauto/services";
const CATEGORY_THUMBNAIL_FOLDER = "rovauto/service-categories";
const MAX_POPULAR_SERVICES = 6;

const normalizeText = (value) => String(value || "").trim();
const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const serviceInclude = {
  category: true,
  media: {
    orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
  },
  cityRestrictions: {
    include: { city: true },
  },
};

const categoryInclude = {
  cityRestrictions: {
    include: { city: true },
  },
  services: {
    include: {
      media: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
      },
      cityRestrictions: {
        include: { city: true },
      },
    },
    orderBy: [
      { displayOrder: "asc" },
      { name: "asc" },
      { createdAt: "asc" },
    ],
  },
};

const invalidateServiceCache = async () => {
  await Promise.allSettled([
    deletePattern("services:*"),
    deletePattern("price-ranges:*"),
  ]);
};

const listCategories = async (query = {}) => {
  const includeInactive = query.includeInactive === "true";
  const search = normalizeText(query.search);

  return prisma.serviceCategory.findMany({
    where: {
      ...(!includeInactive && { isActive: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: categoryInclude,
    orderBy: { name: "asc" },
  });
};

const getCategory = async (categoryId) => {
  const category = await prisma.serviceCategory.findUnique({
    where: { id: categoryId },
    include: categoryInclude,
  });

  if (!category) throw new ApiError(404, "Service category not found");
  return category;
};

const getService = async (serviceId) => {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: serviceInclude,
  });

  if (!service) throw new ApiError(404, "Service not found");
  return service;
};

const createCategory = async (payload) => {
  const name = normalizeText(payload.name);
  if (!name) throw new ApiError(400, "Service category name is required");

  const restrictedCityIds = await ensureRestrictedCitiesExist(
    payload.restrictedCityIds,
  );

  try {
    const category = await prisma.serviceCategory.create({
      data: {
        name,
        description: normalizeText(payload.description) || null,
        isActive: parseBoolean(payload.isActive, true),
        isComingSoon: parseBoolean(payload.isComingSoon, false),
        ...(restrictedCityIds.length > 0 && {
          cityRestrictions: {
            create: restrictedCityIds.map((cityId) => ({ cityId })),
          },
        }),
      },
      include: categoryInclude,
    });

    await invalidateServiceCache();
    return category;
  } catch (error) {
    if (error.code === "P2002") {
      throw new ApiError(409, "A service category with this name already exists");
    }
    throw error;
  }
};

const updateCategory = async (categoryId, payload) => {
  await getCategory(categoryId);

  const data = {};
  if (payload.name !== undefined) {
    const name = normalizeText(payload.name);
    if (!name) throw new ApiError(400, "Service category name cannot be empty");
    data.name = name;
  }
  if (payload.description !== undefined) {
    data.description = normalizeText(payload.description) || null;
  }
  if (payload.isActive !== undefined) {
    data.isActive = parseBoolean(payload.isActive, true);
    if (!data.isActive) {
      data.isComingSoon = false;
      data.services = {
        updateMany: {
          where: {},
          data: { isPopular: false, popularOrder: null },
        },
      };
    }
  }
  if (payload.isComingSoon !== undefined) {
    data.isComingSoon = parseBoolean(payload.isComingSoon, false);
  }
  if (payload.restrictedCityIds !== undefined) {
    const restrictedCityIds = await ensureRestrictedCitiesExist(
      payload.restrictedCityIds,
    );

    data.cityRestrictions = {
      deleteMany: {},
      ...(restrictedCityIds.length > 0 && {
        create: restrictedCityIds.map((cityId) => ({ cityId })),
      }),
    };
  }

  try {
    const category = await prisma.serviceCategory.update({
      where: { id: categoryId },
      data,
      include: categoryInclude,
    });

    await invalidateServiceCache();
    return category;
  } catch (error) {
    if (error.code === "P2002") {
      throw new ApiError(409, "A service category with this name already exists");
    }
    throw error;
  }
};

const deactivateCategory = async (categoryId) => {
  await getCategory(categoryId);

  const category = await prisma.serviceCategory.update({
    where: { id: categoryId },
    data: {
      isActive: false,
      isComingSoon: false,
      services: {
        updateMany: {
          where: {},
          data: {
            isActive: false,
            isPopular: false,
            popularOrder: null,
          },
        },
      },
    },
    include: categoryInclude,
  });

  await invalidateServiceCache();
  return category;
};

const createService = async (payload) => {
  const name = normalizeText(payload.name);
  if (!name) throw new ApiError(400, "Service name is required");

  await getCategory(payload.categoryId);
  const restrictedCityIds = await ensureRestrictedCitiesExist(
    payload.restrictedCityIds,
  );

  const lastService = await prisma.service.findFirst({
    where: { categoryId: payload.categoryId },
    orderBy: [{ displayOrder: "desc" }, { createdAt: "desc" }],
    select: { displayOrder: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: payload.categoryId,
      displayOrder: (lastService?.displayOrder || 0) + 1,
      name,
      description: normalizeText(payload.description) || null,
      isActive: parseBoolean(payload.isActive, true),
      isComingSoon: parseBoolean(payload.isComingSoon, false),
      fulfillmentType: normalizeServiceFulfillmentMode(payload.fulfillmentType),
      ...(restrictedCityIds.length > 0 && {
        cityRestrictions: {
          create: restrictedCityIds.map((cityId) => ({ cityId })),
        },
      }),
    },
    include: serviceInclude,
  });

  await invalidateServiceCache();
  return service;
};

const updateService = async (serviceId, payload) => {
  const existingService = await getService(serviceId);

  const targetCategory = payload.categoryId !== undefined
    ? await getCategory(payload.categoryId)
    : null;

  const data = {};
  if (payload.categoryId !== undefined) {
    data.categoryId = payload.categoryId;

    if (payload.categoryId !== existingService.categoryId) {
      const lastService = await prisma.service.findFirst({
        where: { categoryId: payload.categoryId },
        orderBy: [{ displayOrder: "desc" }, { createdAt: "desc" }],
        select: { displayOrder: true },
      });
      data.displayOrder = (lastService?.displayOrder || 0) + 1;
    }
  }
  if (payload.name !== undefined) {
    const name = normalizeText(payload.name);
    if (!name) throw new ApiError(400, "Service name cannot be empty");
    data.name = name;
  }
  if (payload.description !== undefined) {
    data.description = normalizeText(payload.description) || null;
  }
  if (payload.isActive !== undefined) {
    data.isActive = parseBoolean(payload.isActive, true);
    if (!data.isActive) {
      data.isPopular = false;
      data.popularOrder = null;
    }
  }
  if (payload.isComingSoon !== undefined) {
    data.isComingSoon = parseBoolean(payload.isComingSoon, false);
  }
  if (payload.fulfillmentType !== undefined) {
    data.fulfillmentType = normalizeServiceFulfillmentMode(
      payload.fulfillmentType,
    );
  }
  if (targetCategory && !targetCategory.isActive) {
    data.isPopular = false;
    data.popularOrder = null;
  }
  if (payload.restrictedCityIds !== undefined) {
    const restrictedCityIds = await ensureRestrictedCitiesExist(
      payload.restrictedCityIds,
    );

    data.cityRestrictions = {
      deleteMany: {},
      ...(restrictedCityIds.length > 0 && {
        create: restrictedCityIds.map((cityId) => ({ cityId })),
      }),
    };
  }

  const service = await prisma.service.update({
    where: { id: serviceId },
    data,
    include: serviceInclude,
  });

  await invalidateServiceCache();
  return service;
};

const deactivateService = async (serviceId) => {
  await getService(serviceId);

  const service = await prisma.service.update({
    where: { id: serviceId },
    data: {
      isActive: false,
      isComingSoon: false,
      isPopular: false,
      popularOrder: null,
    },
    include: serviceInclude,
  });

  await invalidateServiceCache();
  return service;
};

const reorderCategoryServices = async (categoryId, serviceIds = []) => {
  const category = await getCategory(categoryId);
  const uniqueServiceIds = [...new Set(serviceIds)];

  if (uniqueServiceIds.length !== serviceIds.length) {
    throw new ApiError(400, "Service order cannot contain duplicates");
  }

  const currentServiceIds = category.services.map((service) => service.id);
  const currentServiceIdSet = new Set(currentServiceIds);

  if (
    uniqueServiceIds.length !== currentServiceIds.length ||
    uniqueServiceIds.some((serviceId) => !currentServiceIdSet.has(serviceId))
  ) {
    throw new ApiError(
      409,
      "The services in this category changed. Refresh the catalogue and try again",
    );
  }

  await prisma.$transaction(
    uniqueServiceIds.map((serviceId, index) =>
      prisma.service.update({
        where: { id: serviceId },
        data: { displayOrder: index + 1 },
        select: { id: true },
      }),
    ),
  );

  await invalidateServiceCache();
  return getCategory(categoryId);
};

const setPopularServices = async (serviceIds = []) => {
  const uniqueServiceIds = [...new Set(serviceIds)];

  if (uniqueServiceIds.length !== serviceIds.length) {
    throw new ApiError(400, "Popular services cannot contain duplicates");
  }

  if (uniqueServiceIds.length > MAX_POPULAR_SERVICES) {
    throw new ApiError(
      400,
      `You can select at most ${MAX_POPULAR_SERVICES} popular services`,
    );
  }

  const services = uniqueServiceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: uniqueServiceIds } },
        select: {
          id: true,
          name: true,
          isActive: true,
          category: { select: { name: true, isActive: true } },
        },
      })
    : [];

  if (services.length !== uniqueServiceIds.length) {
    throw new ApiError(404, "One or more selected services were not found");
  }

  const unavailable = services.find(
    (item) => !item.isActive || !item.category?.isActive,
  );

  if (unavailable) {
    throw new ApiError(
      400,
      `${unavailable.name} must be active in an active category before it can be popular`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.service.updateMany({
      where: { isPopular: true },
      data: { isPopular: false, popularOrder: null },
    });

    for (const [index, serviceId] of uniqueServiceIds.entries()) {
      await tx.service.update({
        where: { id: serviceId },
        data: { isPopular: true, popularOrder: index + 1 },
      });
    }
  });

  await invalidateServiceCache();

  if (uniqueServiceIds.length === 0) return [];

  return prisma.service.findMany({
    where: { id: { in: uniqueServiceIds } },
    include: serviceInclude,
    orderBy: [{ popularOrder: "asc" }, { name: "asc" }],
  });
};

const uploadThumbnail = async (serviceId, file) => {
  await getService(serviceId);

  if (!file) throw new ApiError(400, "Thumbnail image is required");
  if (!file.mimetype?.startsWith("image/")) {
    throw new ApiError(400, "Thumbnail must be an image");
  }
  if (file.size > THUMBNAIL_MAX_SIZE) {
    throw new ApiError(400, "Thumbnail must be under 5 MB");
  }

  const result = await uploadToCloudinary(file.buffer, THUMBNAIL_FOLDER, "image");

  let media;
  try {
    media = await prisma.$transaction(async (tx) => {
      const existingThumbnails = await tx.serviceMedia.findMany({
        where: {
          serviceId,
          mediaType: "IMAGE",
          isThumbnail: true,
        },
      });

      await tx.serviceMedia.updateMany({
        where: {
          serviceId,
          mediaType: "IMAGE",
          isThumbnail: true,
        },
        data: { isThumbnail: false },
      });

      const created = await tx.serviceMedia.create({
        data: {
          serviceId,
          mediaType: "IMAGE",
          url: result.secure_url,
          publicId: result.public_id,
          order: 0,
          isThumbnail: true,
          sizeBytes: file.size,
        },
      });

      return { created, existingThumbnails };
    });
  } catch (error) {
    await deleteFromCloudinary(result.public_id, "image").catch(() => null);
    throw error;
  }

  for (const item of media.existingThumbnails) {
    deleteFromCloudinary(item.publicId, "image").catch(() => {});
  }

  await invalidateServiceCache();
  return media.created;
};

const uploadCategoryThumbnail = async (categoryId, file) => {
  const category = await getCategory(categoryId);

  if (!file) throw new ApiError(400, "Category thumbnail image is required");
  if (!file.mimetype?.startsWith("image/")) {
    throw new ApiError(400, "Category thumbnail must be an image");
  }
  if (file.size > THUMBNAIL_MAX_SIZE) {
    throw new ApiError(400, "Category thumbnail must be under 5 MB");
  }

  const result = await uploadToCloudinary(
    file.buffer,
    CATEGORY_THUMBNAIL_FOLDER,
    "image"
  );

  let updated;
  try {
    updated = await prisma.serviceCategory.update({
      where: { id: categoryId },
      data: {
        thumbnailUrl: result.secure_url,
        thumbnailPublicId: result.public_id,
      },
      include: categoryInclude,
    });
  } catch (error) {
    await deleteFromCloudinary(result.public_id, "image").catch(() => null);
    throw error;
  }

  if (category.thumbnailPublicId) {
    deleteFromCloudinary(category.thumbnailPublicId, "image").catch(() => {});
  }

  await invalidateServiceCache();
  return updated;
};

module.exports = {
  createCategory,
  createService,
  deactivateCategory,
  deactivateService,
  getCategory,
  getService,
  listCategories,
  reorderCategoryServices,
  setPopularServices,
  updateCategory,
  updateService,
  uploadCategoryThumbnail,
  uploadThumbnail,
};
