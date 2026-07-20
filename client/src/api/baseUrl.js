const trimTrailingSlashes = (value) => String(value || "").trim().replace(/\/+$/, "");

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();
const configuredFallbackBaseUrl = import.meta.env.VITE_API_FALLBACK_URL?.trim();
const forceRelativeApi = import.meta.env.VITE_USE_RELATIVE_API === "true";
const forceCrossOriginApi = import.meta.env.VITE_USE_RELATIVE_API === "false";

const isOfficialRovautoHost = () => {
  if (typeof window === "undefined") return false;

  const hostname = String(window.location?.hostname || "").toLowerCase();
  return hostname === "rovauto.com" || hostname.endsWith(".rovauto.com");
};

/*
 * Render backend used by the current production API. Keeping this as a safe
 * fallback prevents Firebase/static hosting deployments from accidentally
 * calling https://www.rovauto.com/api/v1, where no API proxy exists.
 */
const PRODUCTION_API_FALLBACK = "https://rovauto.onrender.com/api/v1";

export const getApiBaseUrl = () => {
  if (!import.meta.env.PROD) {
    return trimTrailingSlashes(
      configuredBaseUrl || "http://localhost:5000/api/v1",
    );
  }

  // The official Vercel deployment proxies /api/v1 to the API. Keeping auth
  // first-party prevents mobile browsers and installed PWAs from rejecting
  // the CSRF/session cookies as third-party cookies.
  if (
    forceRelativeApi ||
    (!forceCrossOriginApi && isOfficialRovautoHost())
  ) {
    return "/api/v1";
  }

  if (configuredBaseUrl) {
    return trimTrailingSlashes(configuredBaseUrl);
  }

  return trimTrailingSlashes(
    configuredFallbackBaseUrl || PRODUCTION_API_FALLBACK,
  );
};

export const getSystemIssueReportUrl = () =>
  `${getApiBaseUrl()}/system-issues/report`;
