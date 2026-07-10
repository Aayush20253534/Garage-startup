const webPush = require("web-push");

const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");

const DEFAULT_VAPID_SUBJECT = "mailto:rovauto.official@gmail.com";
const MAX_ENDPOINT_LENGTH = 4096;
const MAX_KEY_LENGTH = 1024;

let configured = false;

const getVapidConfig = () => ({
  publicKey: String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim(),
  privateKey: String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim(),
  subject: String(
    process.env.WEB_PUSH_VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT,
  ).trim(),
});

const configureWebPush = () => {
  if (configured) return true;

  const { publicKey, privateKey, subject } = getVapidConfig();
  if (!publicKey || !privateKey || !subject) return false;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
};

const isWebPushConfigured = () => configureWebPush();

const getPublicConfig = () => {
  const { publicKey } = getVapidConfig();

  return {
    enabled: isWebPushConfigured(),
    publicKey: publicKey || null,
  };
};

const normalizeSubscription = (input = {}) => {
  const subscription = input.subscription || input;
  const endpoint = String(subscription?.endpoint || "").trim();
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new ApiError(
      400,
      "A valid Web Push subscription with endpoint and keys is required",
    );
  }

  if (!endpoint.startsWith("https://") || endpoint.length > MAX_ENDPOINT_LENGTH) {
    throw new ApiError(400, "Invalid Web Push endpoint");
  }

  if (p256dh.length > MAX_KEY_LENGTH || auth.length > MAX_KEY_LENGTH) {
    throw new ApiError(400, "Invalid Web Push subscription keys");
  }

  return { endpoint, p256dh, auth };
};

const saveSubscription = async ({
  userId,
  subscription,
  userAgent = null,
  deviceName = null,
}) => {
  if (!isWebPushConfigured()) {
    throw new ApiError(503, "Web Push is not configured on the server");
  }

  const normalized = normalizeSubscription(subscription);
  const safeUserAgent = String(userAgent || "").trim().slice(0, 500) || null;
  const safeDeviceName = String(deviceName || "").trim().slice(0, 120) || null;
  const now = new Date();

  return prisma.pushSubscription.upsert({
    where: { endpoint: normalized.endpoint },
    update: {
      userId,
      p256dh: normalized.p256dh,
      auth: normalized.auth,
      userAgent: safeUserAgent,
      deviceName: safeDeviceName,
      lastUsedAt: now,
    },
    create: {
      userId,
      ...normalized,
      userAgent: safeUserAgent,
      deviceName: safeDeviceName,
      lastUsedAt: now,
    },
    select: {
      id: true,
      deviceName: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

const removeSubscription = async ({ userId, endpoint }) => {
  const safeEndpoint = String(endpoint || "").trim();
  if (!safeEndpoint) {
    throw new ApiError(400, "Push subscription endpoint is required");
  }

  const result = await prisma.pushSubscription.deleteMany({
    where: {
      userId,
      endpoint: safeEndpoint,
    },
  });

  return { removed: result.count > 0 };
};

const buildPayload = ({
  id = null,
  title,
  message,
  type = "SYSTEM",
  link = null,
  metadata: _metadata = null,
}) => ({
  title: String(title || "Rovauto"),
  body: String(message || "You have a new Rovauto update."),
  icon: "/icon-192.png",
  badge: "/favicon-48.png",
  tag: id ? `rovauto-${id}` : undefined,
  data: {
    url: link || "/",
    notificationId: id,
    type,
  },
});

const sendToStoredSubscriptions = async (subscriptions, notification) => {
  if (!isWebPushConfigured() || subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const payload = JSON.stringify(buildPayload(notification));
  const results = await Promise.allSettled(
    subscriptions.map((item) =>
      webPush.sendNotification(
        {
          endpoint: item.endpoint,
          keys: {
            p256dh: item.p256dh,
            auth: item.auth,
          },
        },
        payload,
        {
          TTL: 60 * 60,
          urgency: notification.type === "BOOKING" ? "high" : "normal",
        },
      ),
    ),
  );

  const expiredIds = [];
  const successfulIds = [];
  let failed = 0;

  results.forEach((result, index) => {
    const subscription = subscriptions[index];

    if (result.status === "fulfilled") {
      successfulIds.push(subscription.id);
      return;
    }

    const statusCode = Number(result.reason?.statusCode || 0);
    if (statusCode === 404 || statusCode === 410) {
      expiredIds.push(subscription.id);
      return;
    }

    failed += 1;
    console.warn("[web-push] delivery failed", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      statusCode: statusCode || null,
      message: result.reason?.message || "Unknown Web Push error",
    });
  });

  await Promise.all([
    expiredIds.length
      ? prisma.pushSubscription.deleteMany({
          where: { id: { in: expiredIds } },
        })
      : Promise.resolve(),
    successfulIds.length
      ? prisma.pushSubscription.updateMany({
          where: { id: { in: successfulIds } },
          data: { lastUsedAt: new Date() },
        })
      : Promise.resolve(),
  ]);

  return {
    sent: successfulIds.length,
    failed,
    removed: expiredIds.length,
  };
};

const sendPushToUser = async (userId, notification) => {
  if (!userId || !isWebPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  return sendToStoredSubscriptions(subscriptions, notification);
};

const sendPushToUsers = async (userIds, notification) => {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];

  if (uniqueUserIds.length === 0 || !isWebPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: { in: uniqueUserIds },
    },
  });

  return sendToStoredSubscriptions(subscriptions, notification);
};

module.exports = {
  getPublicConfig,
  isWebPushConfigured,
  removeSubscription,
  saveSubscription,
  sendPushToUser,
  sendPushToUsers,
};
