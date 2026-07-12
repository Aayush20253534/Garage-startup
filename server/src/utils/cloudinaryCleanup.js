const prisma = require("../config/prisma");
const { deleteFromCloudinary } = require("./cloudinaryUpload");

const IMAGE_REFERENCE_MODELS = [
  "garageImage",
  "garageApplicationImage",
  "serviceMedia",
  "bookingInspectionImage",
  "supportTicketAttachment",
  "complaintImage",
];

const isCloudinaryImageReferenced = async (publicId) => {
  if (!publicId) return false;

  const counts = await Promise.all(
    IMAGE_REFERENCE_MODELS.map((model) =>
      prisma[model].count({ where: { publicId } }),
    ),
  );

  return counts.some((count) => count > 0);
};

const deleteCloudinaryImageIfUnreferenced = async (publicId) => {
  if (!publicId) return false;

  try {
    if (await isCloudinaryImageReferenced(publicId)) return false;
    await deleteFromCloudinary(publicId, "image");
    return true;
  } catch (error) {
    console.error(
      `[cloudinary-cleanup] Failed to delete unreferenced image ${publicId}:`,
      error.message,
    );
    return false;
  }
};

const deleteCloudinaryImagesIfUnreferenced = async (publicIds = []) =>
  Promise.allSettled(
    [...new Set(publicIds.filter(Boolean))].map((publicId) =>
      deleteCloudinaryImageIfUnreferenced(publicId),
    ),
  );

module.exports = {
  deleteCloudinaryImageIfUnreferenced,
  deleteCloudinaryImagesIfUnreferenced,
  isCloudinaryImageReferenced,
};
