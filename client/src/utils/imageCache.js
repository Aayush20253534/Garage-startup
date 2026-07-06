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

export const registerImageCacheWorker = () => {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registrations =
        await navigator.serviceWorker.getRegistrations();

      await Promise.all(
        registrations
          .filter((registration) => {
            const scriptUrl =
              registration.active?.scriptURL ||
              registration.waiting?.scriptURL ||
              registration.installing?.scriptURL ||
              "";

            return scriptUrl && !scriptUrl.endsWith("/sw.js");
          })
          .map((registration) => registration.unregister()),
      );

      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
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
