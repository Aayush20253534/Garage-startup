const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const { getCache, setCache, deleteCache, deletePattern } = require("../../utils/cache");

const REVIEW_CACHE_TTL_SECONDS = Number(
  process.env.REVIEW_CACHE_TTL_SECONDS || 5 * 60,
);

const invalidateGarageReviewCaches = async (garageId) => {
  if (!garageId) return;

  await Promise.allSettled([
    deleteCache(`garages:detail:${garageId}`),
    deletePattern("garages:list:*"),
    deletePattern("garages:public:*"),
  ]);
};

const getMyReviewsCacheKey = (userId) => `customer:${userId}:reviews:list`;

const invalidateCustomerReviewCaches = async (userId, bookingId) => {
  if (!userId) return;

  await Promise.allSettled([
    deleteCache(getMyReviewsCacheKey(userId)),
    deletePattern(`customer:${userId}:bookings:*`),
    bookingId
      ? deletePattern(`customer:${userId}:booking:${bookingId}*`)
      : deletePattern(`customer:${userId}:booking:*`),
    invalidateCustomerCache(userId),
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

  await Promise.allSettled([
    invalidateGarageReviewCaches(booking.garageId),
    invalidateCustomerReviewCaches(userId, booking.id),
  ]);
  return review;
};

const getMyReviews = async (userId) => {
  const cacheKey = getMyReviewsCacheKey(userId);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const reviews = await prisma.review.findMany({
    where: { userId },
    include: {
      garage: true,
      booking: true,
    },
    orderBy: { createdAt: "desc" },
  });

  await setCache(cacheKey, reviews, REVIEW_CACHE_TTL_SECONDS);
  return reviews;
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

  await Promise.allSettled([
    invalidateGarageReviewCaches(review.garageId),
    invalidateCustomerReviewCaches(userId, review.bookingId),
  ]);
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

  await Promise.allSettled([
    invalidateGarageReviewCaches(review.garageId),
    invalidateCustomerReviewCaches(userId, review.bookingId),
  ]);
  return { deleted: true };
};

module.exports = {
  createReview,
  getMyReviews,
  updateReview,
  deleteReview,
};
