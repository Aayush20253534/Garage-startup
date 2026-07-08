import { Helmet } from "react-helmet-async";

export const SITE_NAME = "Rovauto";
export const SITE_URL = "https://www.rovauto.com";
export const DEFAULT_TITLE =
  "Rovauto — Verified Vehicle Service and Garage Booking";
export const DEFAULT_DESCRIPTION =
  "Book verified garages for vehicle repair, maintenance, pickup, live tracking and service warranty with Rovauto.";
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
export const SITE_ICON = `${SITE_URL}/icon-512.png`;

const normalizePath = (value = "/") => {
  const path = String(value || "/").trim();

  if (!path || path === "/") {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
};

const toAbsoluteUrl = (value, fallback = SITE_URL) => {
  try {
    return new URL(value || fallback, SITE_URL).toString();
  } catch {
    return fallback;
  }
};

const serializeStructuredData = (value) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  canonicalUrl,
  image = DEFAULT_IMAGE,
  imageAlt = `${SITE_NAME} vehicle service platform`,
  type = "website",
  keywords,
  noIndex = false,
  structuredData,
}) {
  const cleanTitle = String(title || "").trim();

  const pageTitle = cleanTitle
    ? cleanTitle.toLowerCase().includes(SITE_NAME.toLowerCase())
      ? cleanTitle
      : `${cleanTitle} | ${SITE_NAME}`
    : DEFAULT_TITLE;

  const canonical = canonicalUrl
    ? toAbsoluteUrl(canonicalUrl)
    : toAbsoluteUrl(normalizePath(path));

  const socialImage = toAbsoluteUrl(image, DEFAULT_IMAGE);
  const robots = noIndex ? "noindex, nofollow" : "index, follow";

  const structuredDataItems = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{pageTitle}</title>

      <meta name="description" content={description} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}

      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />

      <link rel="canonical" href={canonical} />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
      <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:alt" content={imageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={socialImage} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {structuredDataItems
        .filter(Boolean)
        .map((item, index) => (
          <script key={index} type="application/ld+json">
            {serializeStructuredData(item)}
          </script>
        ))}
    </Helmet>
  );
}
