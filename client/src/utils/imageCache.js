const CLOUDINARY_HOST = "res.cloudinary.com";

const isCloudinaryUrl = (url) => {
  try {
    return new URL(url).hostname === CLOUDINARY_HOST;
  } catch {
    return false;
  }
};

const uniqueCloudinaryUrls = (urls = []) =>
  [...new Set(urls.filter(Boolean).filter(isCloudinaryUrl))];

export const getServiceThumbnailUrl = (service) =>
  service?.thumbnail?.url ||
  service?.media?.find((item) => item.isThumbnail)?.url ||
  service?.media?.[0]?.url ||
  "";

export const getCategoryThumbnailUrl = (category) =>
  category?.thumbnailUrl || "";

export const getServiceImageUrls = (categories = []) =>
  uniqueCloudinaryUrls(
    categories.flatMap((category) => [
      getCategoryThumbnailUrl(category),
      ...(category.services || []).map(getServiceThumbnailUrl),
    ]),
  );

const isSupportPath = () =>
  typeof window !== "undefined" &&
  (window.location.pathname === "/support" ||
    window.location.pathname.startsWith("/support/"));

const getWorkerConfig = (portal = "auto") => {
  const supportPortal = portal === "support" || (portal === "auto" && isSupportPath());

  return supportPortal
    ? {
        scriptUrl: "/support-sw.js",
        scope: "/support",
      }
    : {
        scriptUrl: "/sw.js",
        scope: "/",
      };
};

const getRegistrationScriptUrl = (registration) =>
  registration?.active?.scriptURL ||
  registration?.waiting?.scriptURL ||
  registration?.installing?.scriptURL ||
  "";

const waitForWorkerActivation = async (registration) => {
  if (registration.active) return registration;

  const worker = registration.installing || registration.waiting;
  if (!worker) return registration;

  await new Promise((resolve) => {
    if (worker.state === "activated") {
      resolve();
      return;
    }

    const handleStateChange = () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        worker.removeEventListener("statechange", handleStateChange);
        resolve();
      }
    };

    worker.addEventListener("statechange", handleStateChange);
  });

  return registration;
};

export const getRovautoServiceWorkerRegistration = async ({ portal = "auto" } = {}) => {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported by this browser.");
  }

  const config = getWorkerConfig(portal);
  let registration = await navigator.serviceWorker.getRegistration(config.scope);
  const registrationScope = registration
    ? new URL(registration.scope).pathname.replace(/\/$/, "") || "/"
    : null;
  const expectedScope = config.scope.replace(/\/$/, "") || "/";

  // getRegistration(clientUrl) can return the broader root registration.
  // Keep it intact and create a separate, more-specific support registration.
  if (registration && registrationScope !== expectedScope) {
    registration = null;
  }

  const currentScriptUrl = getRegistrationScriptUrl(registration);

  if (
    registration &&
    currentScriptUrl &&
    !currentScriptUrl.endsWith(config.scriptUrl)
  ) {
    await registration.unregister();
    registration = null;
  }

  if (!registration) {
    registration = await navigator.serviceWorker.register(config.scriptUrl, {
      scope: config.scope,
      updateViaCache: "none",
    });
  }

  await registration.update().catch(() => {});
  await waitForWorkerActivation(registration);
  return registration;
};

export const registerImageCacheWorker = () => {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await getRovautoServiceWorkerRegistration();
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  });
};

export const warmImageCache = (urls = []) => {
  const imageUrls = uniqueCloudinaryUrls(urls);

  if (imageUrls.length === 0) {
    return;
  }

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "WARM_IMAGE_CACHE",
      urls: imageUrls,
    });
  }

  imageUrls.slice(0, 12).forEach((url) => {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  });
};
