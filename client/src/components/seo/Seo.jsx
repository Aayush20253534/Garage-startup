import { Helmet } from "react-helmet-async";

export const SITE_NAME = "Rovauto";
export const SITE_URL = "https://www.rovauto.com";
export const DEFAULT_TITLE =
  "Rovauto — Verified Vehicle Service and Garage Booking";
export const DEFAULT_DESCRIPTION =
  "Book verified garages for vehicle repair, servicing, pickup, live tracking and service warranty with Rovauto.";
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

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
  type = "website",
  keywords,
  noIndex = false,
  structuredData,
}) {
  const pageTitle = title
    ? title.toLowerCase().includes(SITE_NAME.toLowerCase())
      ? title
      : `${title} | ${SITE_NAME}`
    : DEFAULT_TITLE;

  const canonical = toAbsoluteUrl(canonicalUrl || path);
  const socialImage = toAbsoluteUrl(image, DEFAULT_IMAGE);
  const robots = noIndex ? "noindex, nofollow" : "index, follow";
  const structuredDataItems = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={canonical} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:alt" content={`${SITE_NAME} vehicle service platform`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={socialImage} />

      {structuredDataItems.map((item, index) => (
        <script key={index} type="application/ld+json">
          {serializeStructuredData(item)}
        </script>
      ))}
    </Helmet>
  );
}
