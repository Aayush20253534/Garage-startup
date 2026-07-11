import { getApiBaseUrl } from "@/api/baseUrl";

const API_MEDIA_PATH = /^\/?(?:api\/|uploads?\/|media\/|files?\/|storage\/)/i;

const getBrowserOrigin = () =>
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost";

const getApiOrigin = () => {
  try {
    return new URL(getApiBaseUrl(), getBrowserOrigin()).origin;
  } catch {
    return getBrowserOrigin();
  }
};

const getRawMediaUrl = (media) => {
  if (typeof media === "string") return media;

  return (
    media?.imageUrl ||
    media?.secureUrl ||
    media?.secure_url ||
    media?.url ||
    media?.src ||
    ""
  );
};

const isLocalHost = (hostname) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "0.0.0.0";

export const resolveMediaUrl = (media) => {
  let rawUrl = String(getRawMediaUrl(media) || "")
    .trim()
    .replaceAll("&amp;", "&");

  if (!rawUrl) return "";

  if (rawUrl.startsWith("//")) {
    rawUrl = `https:${rawUrl}`;
  }

  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
    return rawUrl;
  }

  try {
    const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(rawUrl);
    const baseOrigin =
      !isAbsolute && API_MEDIA_PATH.test(rawUrl)
        ? getApiOrigin()
        : getBrowserOrigin();
    const resolved = new URL(rawUrl, `${baseOrigin.replace(/\/$/, "")}/`);

    // Old database rows may still contain an http Cloudinary/backend URL.
    // Upgrade those URLs on HTTPS deployments so the browser does not block
    // them as mixed content. Local development is intentionally left alone.
    if (resolved.protocol === "http:" && !isLocalHost(resolved.hostname)) {
      resolved.protocol = "https:";
    }

    return resolved.href;
  } catch {
    return rawUrl;
  }
};

export const normalizeMediaCollection = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const imageUrl = resolveMediaUrl(item);
      if (!imageUrl) return null;

      if (typeof item === "string") {
        return {
          id: `media-${index}-${imageUrl}`,
          imageUrl,
          order: index,
          isThumbnail: index === 0,
        };
      }

      return {
        ...item,
        imageUrl,
      };
    })
    .filter(Boolean);
