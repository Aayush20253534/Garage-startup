const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { deletePattern } = require("../../utils/cache");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinaryUpload");
const {
  COMPLAINT_MAX_FILES,
  COMPLAINT_MAX_FILE_SIZE_BYTES,
} = require("../constants/complaintUpload");
const { decodeCursor, encodeCursor, parsePageLimit } = require("../../utils/cursorPagination");

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

  if (files.length > COMPLAINT_MAX_FILES) {
    throw new ApiError(
      400,
      `Maximum ${COMPLAINT_MAX_FILES} complaint images allowed`,
    );
  }

  for (const file of files) {
    if (!file.mimetype?.startsWith("image/")) {
      throw new ApiError(400, "Only images are allowed for complaints");
    }

    if (file.size > COMPLAINT_MAX_FILE_SIZE_BYTES) {
      throw new ApiError(400, "Each complaint image must be 5 MB or smaller");
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

  let complaint;

  try {
    for (const file of files) {
      const fileSource = file.path || file.buffer;

      if (!fileSource) {
        throw new ApiError(400, "Complaint image data is missing");
      }

      const uploaded = await uploadToCloudinary(
        fileSource,
        "project-x/complaints",
        "image",
      );

      uploadedImages.push({
        imageUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
      });
    }

    complaint = await prisma.complaint.create({
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
  } catch (error) {
    await Promise.allSettled(
      uploadedImages.map((image) =>
        deleteFromCloudinary(image.publicId, "image"),
      ),
    );

    throw error;
  }

  await invalidateComplaintBookingCaches(userId, data.bookingId);
  return complaint;
};

const getMyComplaints = async (userId, query = {}) => {
  const limit = parsePageLimit(query.limit);
  const cursor = decodeCursor(query.cursor, "createdAt");
  const rows = await prisma.complaint.findMany({
    where: {
      userId,
      ...(cursor && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    },
    include: {
      booking: {
        include: {
          garage: true,
          vehicle: true,
          service: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore
      ? encodeCursor({ id: last.id, createdAt: last.createdAt })
      : null,
  };
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
