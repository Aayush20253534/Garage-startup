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

const THUMBNAIL_MAX_SIZE = 5 * 1024 * 1024;
const THUMBNAIL_FOLDER = "rovauto/services";
const CATEGORY_THUMBNAIL_FOLDER = "rovauto/service-categories";

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
    orderBy: { name: "asc" },
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

  const service = await prisma.service.create({
    data: {
      categoryId: payload.categoryId,
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
    include: serviceInclude,
  });

  await invalidateServiceCache();
  return service;
};

const updateService = async (serviceId, payload) => {
  await getService(serviceId);

  if (payload.categoryId !== undefined) {
    await getCategory(payload.categoryId);
  }

  const data = {};
  if (payload.categoryId !== undefined) data.categoryId = payload.categoryId;
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
    },
    include: serviceInclude,
  });

  await invalidateServiceCache();
  return service;
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
  updateCategory,
  updateService,
  uploadCategoryThumbnail,
  uploadThumbnail,
};
