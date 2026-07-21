const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");
const {
  deleteFromCloudinary,
  uploadToCloudinary,
} = require("../../utils/cloudinaryUpload");

const LOGO_MAX_SIZE = 2 * 1024 * 1024;
const LOGO_FOLDER = "rovauto/vehicle-brands";

const normalizeName = (value) => String(value || "").trim();

const includeModels = {
  models: {
    orderBy: { name: "asc" },
  },
};

const invalidateVehicleMetaCache = async () => {
  await deletePattern("vehicle-meta:*");
};

const uploadLogo = async (file) => {
  if (!file) return null;

  if (!file.mimetype?.startsWith("image/")) {
    throw new ApiError(400, "Brand logo must be an image");
  }

  if (file.size > LOGO_MAX_SIZE) {
    throw new ApiError(400, "Brand logo must be under 2 MB");
  }

  const result = await uploadToCloudinary(file.buffer, LOGO_FOLDER, "image");
  return {
    logoUrl: result.secure_url,
    logoPublicId: result.public_id,
  };
};

const deleteUploadedLogo = async (logo) => {
  if (!logo?.logoPublicId) return;
  await deleteFromCloudinary(logo.logoPublicId, "image").catch(() => null);
};

const getBrand = async (brandId) => {
  const brand = await prisma.vehicleBrand.findUnique({
    where: { id: brandId },
    include: includeModels,
  });

  if (!brand) throw new ApiError(404, "Car brand not found");
  return brand;
};

const getModel = async (modelId) => {
  const model = await prisma.vehicleModel.findUnique({
    where: { id: modelId },
    include: { brand: true },
  });

  if (!model) throw new ApiError(404, "Car model not found");
  return model;
};

const listBrands = async (query = {}) => {
  const includeInactive = query.includeInactive === "true";
  const search = normalizeName(query.search);
  const modelSearch = normalizeName(query.modelSearch);
  const modelWhere = {
    ...(!includeInactive && { isActive: true }),
    ...(modelSearch && {
      name: {
        contains: modelSearch,
        mode: "insensitive",
      },
    }),
  };

  return prisma.vehicleBrand.findMany({
    where: {
      ...(!includeInactive && { isActive: true }),
      ...(search && {
        name: {
          contains: search,
          mode: "insensitive",
        },
      }),
      ...(modelSearch && { models: { some: modelWhere } }),
    },
    include: {
      models: {
        where: modelWhere,
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
};

const createBrand = async (payload, file) => {
  const name = normalizeName(payload.name);
  if (!name) throw new ApiError(400, "Car brand name is required");

  const logo = await uploadLogo(file);
  const models = Array.isArray(payload.models) ? payload.models : [];
  const cleanModels = [...new Set(models.map(normalizeName).filter(Boolean))];

  try {
    const brand = await prisma.vehicleBrand.create({
      data: {
        name,
        logoUrl: logo?.logoUrl || null,
        logoPublicId: logo?.logoPublicId || null,
        isActive:
          payload.isActive === undefined ||
          payload.isActive === true ||
          payload.isActive === "true",
        models: {
          create: cleanModels.map((modelName) => ({
            name: modelName,
            isActive: true,
          })),
        },
      },
      include: includeModels,
    });

    await invalidateVehicleMetaCache();
    return brand;
  } catch (error) {
    await deleteUploadedLogo(logo);
    if (error.code === "P2002") {
      throw new ApiError(409, "A car brand with this name already exists");
    }
    throw error;
  }
};

const updateBrand = async (brandId, payload, file) => {
  const existingBrand = await getBrand(brandId);

  const data = {};
  const logo = await uploadLogo(file);

  if (payload.name !== undefined) {
    const name = normalizeName(payload.name);
    if (!name) throw new ApiError(400, "Car brand name cannot be empty");
    data.name = name;
  }

  if (payload.isActive !== undefined) {
    data.isActive = payload.isActive === true || payload.isActive === "true";
  }

  if (logo) {
    data.logoUrl = logo.logoUrl;
    data.logoPublicId = logo.logoPublicId;
  }

  try {
    const brand = await prisma.vehicleBrand.update({
      where: { id: brandId },
      data,
      include: includeModels,
    });

    if (
      logo?.logoPublicId &&
      existingBrand.logoPublicId &&
      existingBrand.logoPublicId !== logo.logoPublicId
    ) {
      await deleteFromCloudinary(existingBrand.logoPublicId, "image").catch(
        () => null,
      );
    }

    await invalidateVehicleMetaCache();
    return brand;
  } catch (error) {
    await deleteUploadedLogo(logo);
    if (error.code === "P2002") {
      throw new ApiError(409, "A car brand with this name already exists");
    }
    throw error;
  }
};

const deactivateBrand = async (brandId) => {
  await getBrand(brandId);

  const brand = await prisma.vehicleBrand.update({
    where: { id: brandId },
    data: {
      isActive: false,
      models: {
        updateMany: {
          where: {},
          data: { isActive: false },
        },
      },
    },
    include: includeModels,
  });

  await invalidateVehicleMetaCache();
  return brand;
};

const createModel = async (brandId, payload) => {
  await getBrand(brandId);

  const name = normalizeName(payload.name);
  if (!name) throw new ApiError(400, "Car model name is required");

  try {
    const model = await prisma.vehicleModel.create({
      data: {
        brandId,
        name,
        isActive:
          payload.isActive === undefined ||
          payload.isActive === true ||
          payload.isActive === "true",
      },
    });

    await invalidateVehicleMetaCache();
    return model;
  } catch (error) {
    if (error.code === "P2002") {
      throw new ApiError(409, "This car model already exists under the brand");
    }
    throw error;
  }
};

const updateModel = async (modelId, payload) => {
  await getModel(modelId);

  const data = {};
  if (payload.name !== undefined) {
    const name = normalizeName(payload.name);
    if (!name) throw new ApiError(400, "Car model name cannot be empty");
    data.name = name;
  }

  if (payload.isActive !== undefined) {
    data.isActive = payload.isActive === true || payload.isActive === "true";
  }

  try {
    const model = await prisma.vehicleModel.update({
      where: { id: modelId },
      data,
    });

    await invalidateVehicleMetaCache();
    return model;
  } catch (error) {
    if (error.code === "P2002") {
      throw new ApiError(409, "This car model already exists under the brand");
    }
    throw error;
  }
};

const deleteModel = async (modelId) => {
  await getModel(modelId);

  const model = await prisma.vehicleModel.delete({
    where: { id: modelId },
  });

  await invalidateVehicleMetaCache();
  return model;
};

module.exports = {
  createBrand,
  createModel,
  deactivateBrand,
  deleteModel,
  getBrand,
  listBrands,
  updateBrand,
  updateModel,
};
