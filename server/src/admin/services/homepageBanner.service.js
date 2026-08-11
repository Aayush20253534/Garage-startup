const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinaryUpload");

const BANNER_FOLDER = "rovauto/homepage-banners";
const MAX_BANNER_SIZE = 8 * 1024 * 1024;

const getDuration = async () => {
  const settings = await prisma.homepageBannerSetting.upsert({
    where: { id: "homepage" },
    create: { id: "homepage", duration: 5 },
    update: {},
  });
  return settings.duration;
};

const listBanners = async () => {
  const [banners, duration] = await Promise.all([
    prisma.homepageBanner.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    getDuration(),
  ]);
  return { banners, duration };
};

const listActiveBanners = async () => {
  const [banners, duration] = await Promise.all([
    prisma.homepageBanner.findMany({
      where: { isActive: true },
      select: {
        id: true,
        imageUrl: true,
        heading: true,
        headingColor: true,
        description: true,
        descriptionColor: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    getDuration(),
  ]);
  return { banners, duration };
};

const createBanner = async (
  { title, heading, headingColor, description, descriptionColor },
  file,
) => {
  if (!file) throw new ApiError(400, "Banner image is required");
  if (!file.mimetype?.startsWith("image/")) {
    throw new ApiError(400, "Banner must be an image");
  }
  if (file.size > MAX_BANNER_SIZE) {
    throw new ApiError(400, "Banner image must be under 8 MB");
  }

  const uploaded = await uploadToCloudinary(
    file.buffer,
    BANNER_FOLDER,
    "image",
    { quality: "auto", fetch_format: "auto" },
  );

  try {
    const aggregate = await prisma.homepageBanner.aggregate({
      _max: { position: true },
    });
    return await prisma.homepageBanner.create({
      data: {
        title,
        heading,
        headingColor,
        description,
        descriptionColor,
        imageUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        position: (aggregate._max.position ?? -1) + 1,
      },
    });
  } catch (error) {
    await deleteFromCloudinary(uploaded.public_id, "image").catch(() => null);
    throw error;
  }
};

const updateBanner = async (id, data) => {
  const existing = await prisma.homepageBanner.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Homepage banner not found");

  return prisma.homepageBanner.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.heading !== undefined ? { heading: data.heading } : {}),
      ...(data.headingColor !== undefined
        ? { headingColor: data.headingColor }
        : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.descriptionColor !== undefined
        ? { descriptionColor: data.descriptionColor }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
};

const reorderBanners = async (bannerIds) => {
  const uniqueIds = [...new Set(bannerIds)];
  if (uniqueIds.length !== bannerIds.length) {
    throw new ApiError(400, "Banner order contains duplicate IDs");
  }

  const existing = await prisma.homepageBanner.findMany({
    select: { id: true },
  });
  const existingIds = new Set(existing.map((banner) => banner.id));
  if (
    existingIds.size !== uniqueIds.length ||
    uniqueIds.some((id) => !existingIds.has(id))
  ) {
    throw new ApiError(400, "Banner order must include every banner exactly once");
  }

  await prisma.$transaction(
    uniqueIds.map((id, position) =>
      prisma.homepageBanner.update({ where: { id }, data: { position } }),
    ),
  );
  return (await listBanners()).banners;
};

const updateDuration = async (duration) =>
  prisma.homepageBannerSetting.upsert({
    where: { id: "homepage" },
    create: { id: "homepage", duration: Number(duration) },
    update: { duration: Number(duration) },
  });

const deleteBanner = async (id) => {
  const existing = await prisma.homepageBanner.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Homepage banner not found");

  await prisma.homepageBanner.delete({ where: { id } });
  await deleteFromCloudinary(existing.publicId, "image").catch((error) => {
    console.error("Failed to delete homepage banner from Cloudinary:", error.message);
  });
  return existing;
};

module.exports = {
  MAX_BANNER_SIZE,
  createBanner,
  deleteBanner,
  listActiveBanners,
  listBanners,
  reorderBanners,
  updateBanner,
  updateDuration,
};
