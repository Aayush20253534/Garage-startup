const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getCache, setCache, deletePattern } = require("../../utils/cache");
const webPushService = require("../../services/webPush.service");

const NOTIFICATIONS_CACHE_TTL = 60;

const getNotificationsCacheKey = (userId) => {
  // Version the feed so a pre-deployment cache containing shared legacy rows
  // can never be served after owner-only notification reads are enabled.
  return `customer:${userId}:notifications:v2`;
};

const invalidateNotificationCache = async (userId) => {
  if (!userId) return;
  await deletePattern(`customer:${userId}:notifications*`);
};

const getMyNotifications = async (userId) => {
  const cacheKey = getNotificationsCacheKey(userId);

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const notifications = await prisma.notification.findMany({
    // Customer notification feeds are strictly owner-scoped. Broadcasts are
    // materialized as one row per recipient instead of using shared rows.
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  await setCache(cacheKey, notifications, NOTIFICATIONS_CACHE_TTL);

  return notifications;
};

const sendPushToUsers = async (userIds, notification) => {
  try {
    return await webPushService.sendPushToUsers(userIds, notification);
  } catch (error) {
    console.warn("[web-push] unable to send notification", {
      userCount: Array.isArray(userIds) ? userIds.length : 0,
      message: error?.message || "Unknown Web Push error",
    });

    return { sent: 0, failed: 1, removed: 0 };
  }
};

const createNotification = async ({
  userId = null,
  garageOwnerId = null,
  garageControllerId = null,
  title,
  message,
  type = "SYSTEM",
  link = null,
  metadata = null,
  pushTitle = null,
  pushMessage = null,
}) => {
  if (!title || !message) {
    throw new ApiError(400, "Title and message are required");
  }

  const hasUserTarget = Boolean(userId);
  const hasGarageOwnerTarget = Boolean(garageOwnerId);
  const hasGarageControllerTarget = Boolean(garageControllerId);
  if (
    [hasUserTarget, hasGarageOwnerTarget, hasGarageControllerTarget].filter(Boolean)
      .length !== 1
  ) {
    throw new ApiError(
      400,
      "Notification must have exactly one account owner",
    );
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      garageOwnerId,
      garageControllerId,
      title,
      message,
      type,
      link,
      metadata,
    },
  });

  if (userId) {
    await invalidateNotificationCache(userId);
    await sendPushToUsers([userId], {
      ...notification,
      title: pushTitle || notification.title,
      message: pushMessage || notification.message,
    });
  }

  if (garageOwnerId) {
    await webPushService.sendPushToGarageOwner(garageOwnerId, {
      ...notification,
      title: pushTitle || notification.title,
      message: pushMessage || notification.message,
    });
  }

  return notification;
};

const markNotificationRead = async (userId, notificationId) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  const updated = await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      isRead: true,
    },
  });

  await invalidateNotificationCache(userId);

  return updated;
};

const markAllNotificationsRead = async (userId) => {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  await invalidateNotificationCache(userId);

  return {
    marked: true,
  };
};

module.exports = {
  getMyNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  invalidateNotificationCache,
  sendPushToUsers,
};
