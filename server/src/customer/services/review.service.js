const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deleteCache, deletePattern } = require("../../utils/cache");

const invalidateGarageReviewCaches = async (garageId) => {
  if (!garageId) return;

  await Promise.allSettled([
    deleteCache(`garages:detail:${garageId}`),
    deletePattern("garages:list:*"),
  ]);
};

const createReview = async (userId, data) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: data.bookingId,
      userId,
    },
    include: {
      review: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.status !== "COMPLETED") {
    throw new ApiError(400, "You can review only completed bookings");
  }

  if (booking.review) {
    throw new ApiError(400, "Review already exists for this booking");
  }

  const review = await prisma.$transaction(async (tx) => {
    const createdReview = await tx.review.create({
      data: {
        userId,
        garageId: booking.garageId,
        bookingId: booking.id,
        rating: Number(data.rating),
        comment: data.comment || null,
      },
      include: {
        garage: true,
        booking: true,
      },
    });

    const aggregate = await tx.review.aggregate({
      where: { garageId: booking.garageId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.garage.update({
      where: { id: booking.garageId },
      data: {
        ratingAvg: aggregate._avg.rating || 0,
        ratingCount: aggregate._count.rating || 0,
      },
    });

    return createdReview;
  });

  await invalidateGarageReviewCaches(booking.garageId);
  return review;
};

const getMyReviews = async (userId) => {
  return prisma.review.findMany({
    where: { userId },
    include: {
      garage: true,
      booking: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

const updateReview = async (userId, reviewId, data) => {
  const review = await prisma.review.findFirst({
    where: {
      id: reviewId,
      userId,
    },
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  const updatedReview = await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: {
        ...(data.rating !== undefined && { rating: Number(data.rating) }),
        ...(data.comment !== undefined && { comment: data.comment || null }),
      },
      include: {
        garage: true,
        booking: true,
      },
    });

    const aggregate = await tx.review.aggregate({
      where: { garageId: review.garageId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.garage.update({
      where: { id: review.garageId },
      data: {
        ratingAvg: aggregate._avg.rating || 0,
        ratingCount: aggregate._count.rating || 0,
      },
    });

    return updated;
  });

  await invalidateGarageReviewCaches(review.garageId);
  return updatedReview;
};

const deleteReview = async (userId, reviewId) => {
  const review = await prisma.review.findFirst({
    where: {
      id: reviewId,
      userId,
    },
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({
      where: { id: reviewId },
    });

    const aggregate = await tx.review.aggregate({
      where: { garageId: review.garageId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.garage.update({
      where: { id: review.garageId },
      data: {
        ratingAvg: aggregate._avg.rating || 0,
        ratingCount: aggregate._count.rating || 0,
      },
    });
  });

  await invalidateGarageReviewCaches(review.garageId);
  return { deleted: true };
};

module.exports = {
  createReview,
  getMyReviews,
  updateReview,
  deleteReview,
};
