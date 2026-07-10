import api from "@/api/axios";
import { getRovautoServiceWorkerRegistration } from "@/utils/imageCache";

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

const getDeviceName = () => {
  const platform =
    navigator.userAgentData?.platform || navigator.platform || "Device";

  if (isIosDevice()) return `${platform} Home Screen`;
  if (/Android/i.test(navigator.userAgent)) return `${platform} Android`;
  return `${platform} browser`;
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

export const getPushNotificationStatus = async () => {
  if (isIosDevice() && !isStandalonePwa()) return "install-required";
  if (!isPushNotificationSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  const registration = await getRovautoServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) return "enabled";
  return Notification.permission === "granted" ? "disabled" : "prompt";
};

export const enablePushNotifications = async () => {
  if (isIosDevice() && !isStandalonePwa()) {
    throw new Error(
      "On iPhone or iPad, add Rovauto to the Home Screen first, then open the installed app and enable notifications.",
    );
  }

  if (!isPushNotificationSupported()) {
    throw new Error("This browser does not support app notifications.");
  }

  const configResponse = await api.get("/push/public-key");
  const config = configResponse.data?.data;

  if (!config?.enabled || !config?.publicKey) {
    throw new Error("App notifications are not configured on the Rovauto server yet.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Enable them in your browser or device settings."
        : "Notification permission was not granted.",
    );
  }

  const registration = await getRovautoServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  await api.post("/push/subscriptions", {
    subscription: subscription.toJSON(),
    deviceName: getDeviceName(),
  });

  return subscription;
};

export const syncExistingPushSubscription = async () => {
  if (!isPushNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  await api.post("/push/subscriptions", {
    subscription: subscription.toJSON(),
    deviceName: getDeviceName(),
  });

  return true;
};

export const disablePushNotifications = async ({
  ignoreServerErrors = false,
} = {}) => {
  if (!isPushNotificationSupported()) return false;

  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  let serverError = null;

  try {
    await api.delete("/push/subscriptions", {
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
