const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const garageMediaService = require("../services/garageMedia.service");

const MAX_PROXY_IMAGE_BYTES = 5 * 1024 * 1024;
const CLOUDINARY_HOSTS = new Set(["res.cloudinary.com"]);

const isAllowedCloudinaryHost = (hostname) =>
  CLOUDINARY_HOSTS.has(hostname) || hostname.endsWith(".cloudinary.com");

const uploadGarageMedia = asyncHandler(async (req, res) => {
  const garage = await garageMediaService.uploadGarageMedia(
    req.params.garageId,
    req.files,
    req.user,
  );

  return res
    .status(201)
    .json(new ApiResponse(201, "Garage media uploaded successfully", garage));
});

const getGarageImageContent = asyncHandler(async (req, res) => {
  const image = await garageMediaService.getGarageImageRecord(
    req.params.imageId,
  );

  let sourceUrl;

  try {
    sourceUrl = new URL(image.imageUrl);
  } catch {
    throw new ApiError(502, "Garage photo URL is invalid");
  }

  if (
    sourceUrl.protocol !== "https:" ||
    !isAllowedCloudinaryHost(sourceUrl.hostname)
  ) {
    throw new ApiError(502, "Garage photo source is not allowed");
  }

  let upstream;

  try {
    upstream = await fetch(sourceUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(502, "Garage photo source is temporarily unavailable");
  }

  if (!upstream.ok) {
    throw new ApiError(502, "Garage photo source could not be loaded");
  }

  const contentType = upstream.headers.get("content-type") || "";

  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new ApiError(502, "Garage photo source returned invalid content");
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);

  if (contentLength > MAX_PROXY_IMAGE_BYTES) {
    throw new ApiError(413, "Garage photo is too large to deliver");
  }

  const imageBuffer = Buffer.from(await upstream.arrayBuffer());

  if (imageBuffer.length === 0 || imageBuffer.length > MAX_PROXY_IMAGE_BYTES) {
    throw new ApiError(502, "Garage photo source returned invalid data");
  }

  const upstreamEtag = upstream.headers.get("etag");
  const upstreamLastModified = upstream.headers.get("last-modified");

  res.set({
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Content-Type": contentType,
    "Content-Length": String(imageBuffer.length),
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  });

  if (upstreamEtag) res.set("ETag", upstreamEtag);
  if (upstreamLastModified) res.set("Last-Modified", upstreamLastModified);

  return res.status(200).send(imageBuffer);
});

module.exports = {
  getGarageImageContent,
  uploadGarageMedia,
};
