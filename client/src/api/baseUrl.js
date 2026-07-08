const trimTrailingSlashes = (value) => String(value || "").trim().replace(/\/+$/, "");

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();
const configuredFallbackBaseUrl = import.meta.env.VITE_API_FALLBACK_URL?.trim();
const forceRelativeApi = import.meta.env.VITE_USE_RELATIVE_API === "true";

/*
 * Render backend used by the current production API. Keeping this as a safe
 * fallback prevents Firebase/static hosting deployments from accidentally
 * calling https://www.rovauto.com/api/v1, where no API proxy exists.
 */
const PRODUCTION_API_FALLBACK = "https://rovauto.onrender.com/api/v1";

export const getApiBaseUrl = () => {
  if (configuredBaseUrl) {
    return trimTrailingSlashes(configuredBaseUrl);
  }

  if (!import.meta.env.PROD) {
    return "http://localhost:5000/api/v1";
  }

  if (forceRelativeApi) {
    return "/api/v1";
  }

  return trimTrailingSlashes(
    configuredFallbackBaseUrl || PRODUCTION_API_FALLBACK,
  );
};

export const getSystemIssueReportUrl = () =>
  `${getApiBaseUrl()}/system-issues/report`;
