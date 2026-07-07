import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const PRIVATE_EXACT_PATHS = new Set([
  "/login",
  "/register",
  "/otp",
  "/forgot",
  "/reset-password",
  "/checkout",
  "/tracking",
]);

const PRIVATE_PATH_PREFIXES = [
  "/dashboard",
  "/garage",
  "/admin",
  "/booking",
  "/sos",
];

export const isPrivateSeoPath = (pathname = "") => {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return (
    PRIVATE_EXACT_PATHS.has(normalizedPath) ||
    PRIVATE_PATH_PREFIXES.some(
      (prefix) =>
        normalizedPath === prefix ||
        normalizedPath.startsWith(`${prefix}/`),
    )
  );
};

export default function PrivatePageSeo() {
  const { pathname } = useLocation();

  if (!isPrivateSeoPath(pathname)) {
    return null;
  }

  return (
    <Helmet prioritizeSeoTags>
      <title>Secure Page | Rovauto</title>

      <meta name="robots" content="noindex, nofollow, noarchive" />
      <meta
        name="googlebot"
        content="noindex, nofollow, noarchive"
      />

      <meta name="referrer" content="same-origin" />

      <link
        rel="canonical"
        href={`https://www.rovauto.com${pathname}`}
      />
    </Helmet>
  );
}
