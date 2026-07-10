import api from "@/api/axios";
import { getRovautoServiceWorkerRegistration } from "@/utils/imageCache";

const PUSH_SCOPES = {
  user: "/push",
  support: "/customer-support/push",
};

const normalizeScope = (scope = "user") =>
  Object.prototype.hasOwnProperty.call(PUSH_SCOPES, scope) ? scope : "user";

const getPushApiBase = (scope) => PUSH_SCOPES[normalizeScope(scope)];
const getWorkerPortal = (scope) =>
  normalizeScope(scope) === "support" ? "support" : "user";
const getWorkerScope = (scope) =>
  normalizeScope(scope) === "support" ? "/support" : "/";
const getAppName = (scope) =>
  normalizeScope(scope) === "support" ? "Rovauto Support" : "Rovauto";

const getExactWorkerRegistration = async (scope) => {
  const expectedScope = getWorkerScope(scope).replace(/\/$/, "") || "/";
  const registrations = await navigator.serviceWorker.getRegistrations();

  return (
    registrations.find((registration) => {
      const pathname = new URL(registration.scope).pathname.replace(/\/$/, "") || "/";
      return pathname === expectedScope;
    }) || null
  );
};

const removeLegacySupportSubscriptionRecord = async (supportEndpoint) => {
  const rootRegistration = await getExactWorkerRegistration("user");
  const legacySubscription =
    await rootRegistration?.pushManager.getSubscription();

  if (
    !legacySubscription?.endpoint ||
    legacySubscription.endpoint === supportEndpoint
  ) {
    return;
  }

  await api
    .delete(`${PUSH_SCOPES.support}/subscriptions`, {
      data: { endpoint: legacySubscription.endpoint },
    })
    .catch((error) => {
      console.warn("Unable to remove legacy support push endpoint:", error);
    });
};

const isIosDevice = () => {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const isStandalonePwa = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true);

const getDeviceName = (scope) => {
  const platform =
    navigator.userAgentData?.platform || navigator.platform || "Device";
  const appName = getAppName(scope);

  if (isIosDevice()) return `${appName} · ${platform} Home Screen`;
  if (/Android/i.test(navigator.userAgent)) return `${appName} · ${platform} Android`;
  return `${appName} · ${platform} browser`;
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
};

export const isPushNotificationSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const getPushNotificationStatus = async ({ scope = "user" } = {}) => {
  if (isIosDevice() && !isStandalonePwa()) return "install-required";
  if (!isPushNotificationSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  const registration = await getRovautoServiceWorkerRegistration({
    portal: getWorkerPortal(scope),
  });
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) return "enabled";
  return Notification.permission === "granted" ? "disabled" : "prompt";
};

export const enablePushNotifications = async ({ scope = "user" } = {}) => {
  const appName = getAppName(scope);

  if (isIosDevice() && !isStandalonePwa()) {
    throw new Error(
      `On iPhone or iPad, add ${appName} to the Home Screen first, then open the installed app and enable notifications.`,
    );
  }

  if (!isPushNotificationSupported()) {
    throw new Error("This browser does not support app notifications.");
  }

  const base = getPushApiBase(scope);
  const configResponse = await api.get(`${base}/public-key`);
  const config = configResponse.data?.data;

  if (!config?.enabled || !config?.publicKey) {
    throw new Error(`${appName} notifications are not configured on the server yet.`);
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Enable them in your browser or device settings."
        : "Notification permission was not granted.",
    );
  }

  const registration = await getRovautoServiceWorkerRegistration({
    portal: getWorkerPortal(scope),
  });
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  if (normalizeScope(scope) === "support") {
    await removeLegacySupportSubscriptionRecord(subscription.endpoint);
  }

  await api.post(`${base}/subscriptions`, {
    subscription: subscription.toJSON(),
    deviceName: getDeviceName(scope),
  });

  return subscription;
};

export const syncExistingPushSubscription = async ({ scope = "user" } = {}) => {
  if (!isPushNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const registration = await getRovautoServiceWorkerRegistration({
    portal: getWorkerPortal(scope),
  });
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const base = getPushApiBase(scope);

  if (normalizeScope(scope) === "support") {
    await removeLegacySupportSubscriptionRecord(subscription.endpoint);
  }

  await api.post(`${base}/subscriptions`, {
    subscription: subscription.toJSON(),
    deviceName: getDeviceName(scope),
  });

  return true;
};

export const disablePushNotifications = async ({
  ignoreServerErrors = false,
  scope = "user",
} = {}) => {
  if (!isPushNotificationSupported()) return false;

  const registration = await getExactWorkerRegistration(scope);
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  let serverError = null;
  const base = getPushApiBase(scope);

  try {
    await api.delete(`${base}/subscriptions`, {
      data: { endpoint: subscription.endpoint },
    });
  } catch (error) {
    serverError = error;
  }

  await subscription.unsubscribe();

  if (serverError && !ignoreServerErrors) {
    throw new Error(
      "Notifications were disabled on this device, but server cleanup will complete automatically.",
    );
  }

  return true;
};
