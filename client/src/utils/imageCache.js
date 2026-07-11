import { resolveMediaUrl } from "@/utils/mediaUrl";

const isCloudinaryHost = (hostname) =>
  hostname === "res.cloudinary.com" || hostname.endsWith(".cloudinary.com");

const isCloudinaryUrl = (url) => {
  try {
    return isCloudinaryHost(new URL(url).hostname);
  } catch {
    return false;
  }
};

const uniqueCloudinaryUrls = (urls = []) =>
  [...new Set(urls.filter(Boolean).filter(isCloudinaryUrl))];

export const getOptimizedImageUrl = (
  media,
  { width = 640, height, crop = "limit" } = {},
) => {
  const resolvedUrl = resolveMediaUrl(media);

  if (!resolvedUrl || !isCloudinaryUrl(resolvedUrl)) {
    return resolvedUrl;
  }

  try {
    const url = new URL(resolvedUrl);
    const uploadMarker = "/image/upload/";

    if (!url.pathname.includes(uploadMarker)) {
      return resolvedUrl;
    }

    const numericWidth = Number(width);
    const numericHeight = Number(height);
    const transformation = [
      "f_auto",
      "q_auto",
      crop ? `c_${crop}` : null,
      Number.isFinite(numericWidth) && numericWidth > 0
        ? `w_${Math.round(numericWidth)}`
        : null,
      Number.isFinite(numericHeight) && numericHeight > 0
        ? `h_${Math.round(numericHeight)}`
        : null,
    ]
      .filter(Boolean)
      .join(",");

    url.pathname = url.pathname.replace(
      uploadMarker,
      `${uploadMarker}${transformation}/`,
    );

    return url.href;
  } catch {
    return resolvedUrl;
  }
};

const getServiceThumbnail = (service) =>
  service?.thumbnail ||
  service?.media?.find((item) => item?.isThumbnail) ||
  service?.media?.[0] ||
  "";

export const getServiceThumbnailUrl = (service) =>
  getOptimizedImageUrl(getServiceThumbnail(service), {
    width: 640,
  });

export const getCategoryThumbnailUrl = (category) =>
  getOptimizedImageUrl(
    category?.thumbnailUrl || category?.thumbnail || category?.imageUrl || "",
    { width: 640 },
  );

export const getServiceImageUrls = (categories = []) =>
  uniqueCloudinaryUrls(
    categories.flatMap((category) => [
      getCategoryThumbnailUrl(category),
      ...(category.services || []).map(getServiceThumbnailUrl),
    ]),
  );

const getPortalFromPath = () => {
  if (typeof window === "undefined") return "main";

  const { pathname } = window.location;

  if (pathname === "/support" || pathname.startsWith("/support/")) {
    return "support";
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }

  if (pathname === "/intern" || pathname.startsWith("/intern/")) {
    return "intern";
  }

  if (pathname === "/garage" || pathname.startsWith("/garage/")) {
    return "garage";
  }

  return "main";
};

const WORKER_CONFIG = {
  main: {
    scriptUrl: "/sw.js",
    scope: "/",
  },
  support: {
    scriptUrl: "/support-sw.js",
    scope: "/support",
  },
  admin: {
    scriptUrl: "/admin-sw.js",
    scope: "/admin",
  },
  intern: {
    scriptUrl: "/intern-sw.js",
    scope: "/intern",
  },
  garage: {
    scriptUrl: "/garage-sw.js",
    scope: "/garage",
  },
};

const getWorkerConfig = (portal = "auto") => {
  const resolvedPortal = portal === "auto" ? getPortalFromPath() : portal;
  return WORKER_CONFIG[resolvedPortal] || WORKER_CONFIG.main;
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
  // Keep the root worker intact and create the more-specific portal registration.
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
  if (typeof Image === "undefined") {
    return;
  }

  const imageUrls = uniqueCloudinaryUrls(urls);

  // Let Cloudinary's CDN and the browser HTTP cache handle persistence.
  // Preload only a few likely-visible images instead of storing opaque
  // cross-origin responses in the service-worker Cache API.
  imageUrls.slice(0, 6).forEach((url) => {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  });
};
