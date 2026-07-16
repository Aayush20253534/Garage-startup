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

const normalizeDeviceDetails = ({ userAgent = null, deviceName = null }) => ({
  userAgent: String(userAgent || "").trim().slice(0, 500) || null,
  deviceName: String(deviceName || "").trim().slice(0, 120) || null,
});

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
  const device = normalizeDeviceDetails({ userAgent, deviceName });
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // A browser has one Push API subscription for this service worker. Moving
    // an endpoint between account types prevents alerts leaking to a previous
    // customer/support session on the same browser.
    await tx.customerSupportPushSubscription.deleteMany({
      where: { endpoint: normalized.endpoint },
    });
    await tx.garagePushSubscription.deleteMany({
      where: { endpoint: normalized.endpoint },
    });

    return tx.pushSubscription.upsert({
      where: { endpoint: normalized.endpoint },
      update: {
        userId,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        ...device,
        lastUsedAt: now,
      },
      create: {
        userId,
        ...normalized,
        ...device,
        lastUsedAt: now,
      },
      select: {
        id: true,
        deviceName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
};

const saveSupportSubscription = async ({
  supportAccountId,
  subscription,
  userAgent = null,
  deviceName = null,
}) => {
  if (!isWebPushConfigured()) {
    throw new ApiError(503, "Web Push is not configured on the server");
  }

  const normalized = normalizeSubscription(subscription);
  const device = normalizeDeviceDetails({ userAgent, deviceName });
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.pushSubscription.deleteMany({
      where: { endpoint: normalized.endpoint },
    });
    await tx.garagePushSubscription.deleteMany({
      where: { endpoint: normalized.endpoint },
    });

    return tx.customerSupportPushSubscription.upsert({
      where: { endpoint: normalized.endpoint },
      update: {
        supportAccountId,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        ...device,
        lastUsedAt: now,
      },
      create: {
        supportAccountId,
        ...normalized,
        ...device,
        lastUsedAt: now,
      },
      select: {
        id: true,
        deviceName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
};

const saveGarageSubscription = async ({
  garageOwnerId,
  subscription,
  userAgent = null,
  deviceName = null,
}) => {
  if (!isWebPushConfigured()) {
    throw new ApiError(503, "Web Push is not configured on the server");
  }

  const normalized = normalizeSubscription(subscription);
  const device = normalizeDeviceDetails({ userAgent, deviceName });
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.pushSubscription.deleteMany({
      where: { endpoint: normalized.endpoint },
    });
    await tx.customerSupportPushSubscription.deleteMany({
      where: { endpoint: normalized.endpoint },
    });

    return tx.garagePushSubscription.upsert({
      where: { endpoint: normalized.endpoint },
      update: {
        garageOwnerId,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        ...device,
        lastUsedAt: now,
      },
      create: {
        garageOwnerId,
        ...normalized,
        ...device,
        lastUsedAt: now,
      },
      select: {
        id: true,
        deviceName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
};

const normalizeEndpoint = (endpoint) => {
  const safeEndpoint = String(endpoint || "").trim();
  if (!safeEndpoint) {
    throw new ApiError(400, "Push subscription endpoint is required");
  }
  return safeEndpoint;
};

const removeSubscription = async ({ userId, endpoint }) => {
  const safeEndpoint = normalizeEndpoint(endpoint);
  const result = await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint: safeEndpoint },
  });

  return { removed: result.count > 0 };
};

const removeSupportSubscription = async ({ supportAccountId, endpoint }) => {
  const safeEndpoint = normalizeEndpoint(endpoint);
  const result = await prisma.customerSupportPushSubscription.deleteMany({
    where: { supportAccountId, endpoint: safeEndpoint },
  });

  return { removed: result.count > 0 };
};

const removeGarageSubscription = async ({ garageOwnerId, endpoint }) => {
  const safeEndpoint = normalizeEndpoint(endpoint);
  const result = await prisma.garagePushSubscription.deleteMany({
    where: { garageOwnerId, endpoint: safeEndpoint },
  });

  return { removed: result.count > 0 };
};

const buildPayload = ({
  id = null,
  title,
  message,
  type = "SYSTEM",
  link = null,
  metadata = null,
}) => ({
  title: String(title || "Rovauto"),
  body: String(message || "You have a new Rovauto update."),
  icon: "/icon-192.png",
  badge: "/notification-badge-96.png",
  tag: id ? `rovauto-${id}` : metadata?.ticketId ? `ticket-${metadata.ticketId}` : undefined,
  data: {
    url: link || "/",
    notificationId: id,
    type,
    ...(metadata?.ticketId && { ticketId: metadata.ticketId }),
  },
});

const getSubscriptionModel = (kind) =>
  kind === "support"
    ? prisma.customerSupportPushSubscription
    : kind === "garage"
      ? prisma.garagePushSubscription
    : prisma.pushSubscription;

const sendToStoredSubscriptions = async (
  subscriptions,
  notification,
  { kind = "user" } = {},
) => {
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
          urgency: ["BOOKING", "SUPPORT_TICKET", "DISPUTE"].includes(
            notification.type,
          )
            ? "high"
            : "normal",
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
      accountId:
        subscription.userId ||
        subscription.supportAccountId ||
        subscription.garageOwnerId ||
        null,
      accountType:
        kind === "support"
          ? "CUSTOMER_SUPPORT"
          : kind === "garage"
            ? "GARAGE_OWNER"
            : "USER",
      statusCode: statusCode || null,
      message: result.reason?.message || "Unknown Web Push error",
    });
  });

  const model = getSubscriptionModel(kind);
  await Promise.all([
    expiredIds.length
      ? model.deleteMany({ where: { id: { in: expiredIds } } })
      : Promise.resolve(),
    successfulIds.length
      ? model.updateMany({
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
    where: { userId: { in: uniqueUserIds } },
  });

  return sendToStoredSubscriptions(subscriptions, notification);
};

const sendPushToGarageOwner = async (garageOwnerId, notification) => {
  if (!garageOwnerId || !isWebPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.garagePushSubscription.findMany({
    where: { garageOwnerId },
  });

  return sendToStoredSubscriptions(subscriptions, notification, {
    kind: "garage",
  });
};

const sendPushToSupportAccount = async (supportAccountId, notification) => {
  if (!supportAccountId || !isWebPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.customerSupportPushSubscription.findMany({
    where: { supportAccountId },
  });

  return sendToStoredSubscriptions(subscriptions, notification, {
    kind: "support",
  });
};

const sendPushToSupportAccounts = async (supportAccountIds, notification) => {
  const uniqueIds = [...new Set((supportAccountIds || []).filter(Boolean))];

  if (uniqueIds.length === 0 || !isWebPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.customerSupportPushSubscription.findMany({
    where: { supportAccountId: { in: uniqueIds } },
  });

  return sendToStoredSubscriptions(subscriptions, notification, {
    kind: "support",
  });
};

module.exports = {
  getPublicConfig,
  isWebPushConfigured,
  removeSubscription,
  removeGarageSubscription,
  removeSupportSubscription,
  saveSubscription,
  saveGarageSubscription,
  saveSupportSubscription,
  sendPushToSupportAccount,
  sendPushToSupportAccounts,
  sendPushToUser,
  sendPushToUsers,
  sendPushToGarageOwner,
};
