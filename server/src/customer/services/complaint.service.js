const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { deletePattern } = require("../../utils/cache");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");

const invalidateComplaintBookingCaches = async (userId, bookingId) => {
  if (!userId) return;

  await Promise.allSettled([
    deletePattern(`customer:${userId}:bookings:*`),
    bookingId
      ? deletePattern(`customer:${userId}:booking:${bookingId}*`)
      : deletePattern(`customer:${userId}:booking:*`),
    invalidateCustomerCache(userId),
  ]);
};

const createComplaint = async (userId, data, files = []) => {
  if (!files || files.length < 1) {
    throw new ApiError(400, "At least 1 complaint image is required");
  }

  if (files.length > 10) {
    throw new ApiError(400, "Maximum 10 complaint images allowed");
  }

  for (const file of files) {
    if (!file.mimetype.startsWith("image/")) {
      throw new ApiError(400, "Only images are allowed for complaints");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new ApiError(400, "Each complaint image must be under 10 MB");
    }
  }

  if (data.bookingId) {
    const booking = await prisma.booking.findFirst({
      where: {
        id: data.bookingId,
        userId,
      },
    });

    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }
  }

  const uploadedImages = [];

  for (const file of files) {
    const uploaded = await uploadToCloudinary(
      file.buffer,
      "project-x/complaints",
      "image"
    );

    uploadedImages.push({
      imageUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
    });
  }

  const complaint = await prisma.complaint.create({
    data: {
      userId,
      bookingId: data.bookingId || null,
      title: data.title,
      description: data.description,
      status: "OPEN",
      images: {
        create: uploadedImages.map((image, index) => ({
          imageUrl: image.imageUrl,
          publicId: image.publicId,
          order: index,
        })),
      },
    },
    include: {
      images: true,
      booking: {
        include: {
          garage: true,
          vehicle: true,
          service: true,
        },
      },
    },
  });

  await invalidateComplaintBookingCaches(userId, data.bookingId);
  return complaint;
};

const getMyComplaints = async (userId) => {
  return prisma.complaint.findMany({
    where: { userId },
    include: {
      booking: {
        include: {
          garage: true,
          vehicle: true,
          service: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

const getComplaintById = async (userId, complaintId) => {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id: complaintId,
      userId,
    },
    include: {
      booking: {
        include: {
          garage: true,
          vehicle: true,
          service: true,
          payment: true,
        },
      },
    },
  });

  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  return complaint;
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintById,
};
