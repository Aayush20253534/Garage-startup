const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getCache, setCache, deletePattern } = require("../../utils/cache");
const webPushService = require("../../services/webPush.service");

const NOTIFICATIONS_CACHE_TTL = 60;

const getNotificationsCacheKey = (userId) => {
  return `customer:${userId}:notifications`;
};

const getReadCopySourceId = (notification) => {
  return notification?.metadata?.sourceNotificationId || null;
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
    where: {
      OR: [
        { userId },
        { userId: null },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  const readGlobalIds = new Set(
    notifications
      .filter((notification) => notification.userId === userId && getReadCopySourceId(notification))
      .map(getReadCopySourceId)
  );
  const visibleNotifications = notifications.filter((notification) => {
    if (notification.userId !== null) return !getReadCopySourceId(notification);
    return !readGlobalIds.has(notification.id);
  });

  await setCache(cacheKey, visibleNotifications, NOTIFICATIONS_CACHE_TTL);

  return visibleNotifications;
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

  const notification = await prisma.notification.create({
    data: {
      userId,
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

  return notification;
};

const markNotificationRead = async (userId, notificationId) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      OR: [
        { userId },
        { userId: null },
      ],
    },
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  if (!notification.userId) {
    const userNotifications = await prisma.notification.findMany({
      where: { userId },
    });
    const existingReadCopy = userNotifications.find(
      (item) => getReadCopySourceId(item) === notification.id
    );

    if (existingReadCopy) {
      await invalidateNotificationCache(userId);
      return existingReadCopy;
    }

    const copied = await prisma.notification.create({
      data: {
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        metadata: {
          ...(notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
            ? notification.metadata
            : {}),
          sourceNotificationId: notification.id,
        },
        isRead: true,
      },
    });

    await invalidateNotificationCache(userId);
    return copied;
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
  await prisma.$transaction(async (tx) => {
    await tx.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    const globalNotifications = await tx.notification.findMany({
      where: { userId: null },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        link: true,
        metadata: true,
        createdAt: true,
      },
    });

    const existingCopies = await tx.notification.findMany({
      where: { userId },
      select: { metadata: true },
    });
    const copiedGlobalIds = new Set(existingCopies.map(getReadCopySourceId).filter(Boolean));
    const missingReadCopies = globalNotifications.filter((notification) => !copiedGlobalIds.has(notification.id));

    if (missingReadCopies.length) {
      await tx.notification.createMany({
        data: missingReadCopies.map((notification) => ({
          userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          link: notification.link,
          metadata: {
            ...(notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
              ? notification.metadata
              : {}),
            sourceNotificationId: notification.id,
          },
          isRead: true,
          createdAt: notification.createdAt,
        })),
      });
    }
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
