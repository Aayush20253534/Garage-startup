const CLOUDINARY_VIDEO_MARKER = "/video/upload/";
const COMPATIBLE_VIDEO_TRANSFORMATION =
  "f_mp4,q_auto:good,vc_h264:baseline:3.1";

const stripExtension = (value = "") =>
  String(value).replace(/\.[a-z0-9]{2,5}$/i, "");

export const getCompatibleVideoUrl = (media) => {
  const originalUrl =
    typeof media === "string" ? media : String(media?.imageUrl || "");

  if (!originalUrl || !originalUrl.includes(CLOUDINARY_VIDEO_MARKER)) {
    return originalUrl;
  }

  try {
    const url = new URL(originalUrl);
    const markerIndex = url.pathname.indexOf(CLOUDINARY_VIDEO_MARKER);
    const prefix = url.pathname.slice(
      0,
      markerIndex + CLOUDINARY_VIDEO_MARKER.length,
    );
    const deliveryPath = url.pathname.slice(
      markerIndex + CLOUDINARY_VIDEO_MARKER.length,
    );

    if (
      deliveryPath.includes(COMPATIBLE_VIDEO_TRANSFORMATION) ||
      (/vc_h264(?::baseline(?::3\.1)?)?/.test(deliveryPath) &&
        (deliveryPath.includes("f_mp4") || /\.mp4(?:$|\?)/i.test(url.pathname)))
    ) {
      return url.toString();
    }

    const segments = deliveryPath.split("/").filter(Boolean);
    const fileName = segments.pop();

    if (!fileName) return originalUrl;

    segments.push(`${stripExtension(fileName)}.mp4`);
    url.pathname = `${prefix}${COMPATIBLE_VIDEO_TRANSFORMATION}/${segments.join("/")}`;
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return originalUrl;
  }
};
