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

export const isPrivateSeoPath = (pathname = "") =>
  PRIVATE_EXACT_PATHS.has(pathname) ||
  PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export default function PrivatePageSeo() {
  const { pathname } = useLocation();

  if (!isPrivateSeoPath(pathname)) {
    return null;
  }

  return (
    <Helmet>
      <title>Secure Page | Rovauto</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      <meta name="referrer" content="same-origin" />
    </Helmet>
  );
}
