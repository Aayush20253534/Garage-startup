const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinaryUpload");
const {
  deleteCloudinaryImagesIfUnreferenced,
} = require("../utils/cloudinaryCleanup");
const invalidatePublicCache = require("../utils/invalidatePublicCache");
const {
  GARAGE_MAXIMUM_IMAGES,
  GARAGE_MAX_IMAGE_SIZE_BYTES,
} = require("../garage/constants");
const { activateGarageIfEligible } = require("../garage/services/garageOwner.service");

const getTotalPhotoCount = (images, thumbnail) => images.length + thumbnail.length;

const validateImageFile = (file) => {
  if (!file?.mimetype?.startsWith("image/")) {
    throw new ApiError(400, "Only image files are allowed for garage photos");
  }

  if (file.size > GARAGE_MAX_IMAGE_SIZE_BYTES) {
    throw new ApiError(400, "Each garage photo must be less than or equal to 1 MB");
  }
};

const assertCanManageGarageMedia = (garage, user) => {
  if (user.role !== "ADMIN" && garage.ownerId !== user.id) {
    throw new ApiError(403, "You are not allowed to manage media for this garage");
  }
};

const lockGarageForMediaUpdate = async (tx, garageId) => {
  if (typeof tx.$queryRaw !== "function") return;

  await tx.$queryRaw`
    SELECT "id"
    FROM "Garage"
    WHERE "id" = ${garageId}
    FOR UPDATE
  `;
};

const getGarageMediaState = async (tx, garageId, updatedGarage = null) => {
  const freshGarage = await tx.garage.findUnique({
    where: { id: garageId },
    include: {
      images: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
      },
      wallet: true,
    },
  });

  if (!freshGarage) {
    throw new ApiError(404, "Garage not found");
  }

  return {
    ...freshGarage,
    activation: {
      isActive: updatedGarage?.isActive ?? freshGarage.isActive,
      photoCount: freshGarage.images.length,
    },
  };
};

const getGarageImageRecord = async (imageId) => {
  const image = await prisma.garageImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      imageUrl: true,
      publicId: true,
      updatedAt: true,
    },
  });

  if (!image) {
    throw new ApiError(404, "Garage photo not found");
  }

  return image;
};

const uploadGarageMedia = async (garageId, files = {}, user) => {
  const images = files.images || [];
  const thumbnail = files.thumbnail || [];
  const videos = files.videos || [];

  if (videos.length > 0) {
    throw new ApiError(400, "Garage videos are not required. Upload photos only.");
  }

  const incomingPhotoCount = getTotalPhotoCount(images, thumbnail);

  if (incomingPhotoCount > GARAGE_MAXIMUM_IMAGES) {
    throw new ApiError(
      400,
      `Garage can upload up to ${GARAGE_MAXIMUM_IMAGES} photos`,
    );
  }

  if (thumbnail.length > 1) {
    throw new ApiError(400, "Only 1 thumbnail image is allowed");
  }

  if (incomingPhotoCount === 0) {
    throw new ApiError(400, "Select at least 1 garage photo to upload");
  }

  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    select: {
      id: true,
      ownerId: true,
      _count: {
        select: { images: true },
      },
    },
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found");
  }

  assertCanManageGarageMedia(garage, user);

  const availableSlots = GARAGE_MAXIMUM_IMAGES - garage._count.images;

  if (incomingPhotoCount > availableSlots) {
    throw new ApiError(
      400,
      availableSlots > 0
        ? `This garage already has ${garage._count.images} photos. You can add only ${availableSlots} more.`
        : `This garage already has the maximum ${GARAGE_MAXIMUM_IMAGES} photos. Delete a photo before adding another.`,
    );
  }

  for (const file of [...thumbnail, ...images]) {
    validateImageFile(file);
  }

  const orderedFiles = [...thumbnail, ...images];
  const uploadedImages = [];

  try {
    for (const file of orderedFiles) {
      const uploaded = await uploadToCloudinary(
        file.buffer,
        "project-x/garages/images",
        "image",
      );

      if (!uploaded?.secure_url || !uploaded?.public_id) {
        throw new ApiError(
          502,
          "Cloud image upload did not return a usable photo URL",
        );
      }

      uploadedImages.push(uploaded);
    }
  } catch (error) {
    await Promise.allSettled(
      uploadedImages.map((image) =>
        deleteFromCloudinary(image.public_id, "image"),
      ),
    );
    throw error;
  }

  let result;

  try {
    result = await prisma.$transaction(async (tx) => {
      await lockGarageForMediaUpdate(tx, garageId);

      const existingImages = await tx.garageImage.findMany({
        where: { garageId },
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
        select: {
          id: true,
          order: true,
          isThumbnail: true,
        },
      });

      const remainingSlots = GARAGE_MAXIMUM_IMAGES - existingImages.length;

      if (uploadedImages.length > remainingSlots) {
        throw new ApiError(
          409,
          remainingSlots > 0
            ? `The gallery changed while uploading. Only ${remainingSlots} photo slots remain.`
            : `The gallery reached its ${GARAGE_MAXIMUM_IMAGES}-photo limit while uploading.`,
        );
      }

      const hasThumbnail = existingImages.some((image) => image.isThumbnail);
      const nextOrder = existingImages.reduce(
        (maximum, image) => Math.max(maximum, image.order),
        -1,
      ) + 1;

      await tx.garageImage.createMany({
        data: uploadedImages.map((image, index) => ({
          garageId,
          imageUrl: image.secure_url,
          publicId: image.public_id,
          isThumbnail: !hasThumbnail && index === 0,
          order: nextOrder + index,
        })),
      });

      const updatedGarage = await activateGarageIfEligible(tx, garageId);
      return getGarageMediaState(tx, garageId, updatedGarage);
    });
  } catch (error) {
    await Promise.allSettled(
      uploadedImages.map((image) =>
        deleteFromCloudinary(image.public_id, "image"),
      ),
    );
    throw error;
  }

  await invalidatePublicCache();

  return result;
};

const deleteGarageImages = async (garageId, imageIds = [], user) => {
  const uniqueImageIds = [
    ...new Set(
      (Array.isArray(imageIds) ? imageIds : [])
        .map((imageId) => String(imageId || "").trim())
        .filter(Boolean),
    ),
  ];

  if (!uniqueImageIds.length || uniqueImageIds.length > GARAGE_MAXIMUM_IMAGES) {
    throw new ApiError(400, "Select between 1 and 15 garage photos to delete");
  }

  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found");
  }

  assertCanManageGarageMedia(garage, user);

  const images = await prisma.garageImage.findMany({
    where: {
      id: { in: uniqueImageIds },
      garageId,
    },
    select: {
      id: true,
      publicId: true,
    },
  });

  if (images.length !== uniqueImageIds.length) {
    throw new ApiError(404, "One or more garage photos were not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockGarageForMediaUpdate(tx, garageId);

    const lockedImages = await tx.garageImage.findMany({
      where: {
        id: { in: uniqueImageIds },
        garageId,
      },
      select: {
        id: true,
      },
    });

    if (lockedImages.length !== uniqueImageIds.length) {
      throw new ApiError(404, "One or more garage photos were not found");
    }

    await tx.garageImage.deleteMany({
      where: {
        id: { in: uniqueImageIds },
        garageId,
      },
    });

    const remainingImages = await tx.garageImage.findMany({
      where: { garageId },
      orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
      select: { id: true },
    });

    for (const [index, remainingImage] of remainingImages.entries()) {
      await tx.garageImage.update({
        where: { id: remainingImage.id },
        data: {
          isThumbnail: index === 0,
          order: index,
        },
      });
    }

    return getGarageMediaState(tx, garageId);
  });

  await Promise.allSettled([
    deleteCloudinaryImagesIfUnreferenced(images.map((image) => image.publicId)),
    invalidatePublicCache(),
  ]);

  return result;
};

const deleteGarageImage = (garageId, imageId, user) =>
  deleteGarageImages(garageId, [imageId], user);

module.exports = {
  deleteGarageImage,
  deleteGarageImages,
  getGarageImageRecord,
  uploadGarageMedia,
};
