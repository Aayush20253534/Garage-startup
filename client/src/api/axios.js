import axios from "axios";
import { getApiBaseUrl } from "@/api/baseUrl";
import { reportApiFailure } from "@/utils/errorReporter";

const apiBaseUrl = getApiBaseUrl();

const toPositiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const API_TIMEOUT_MS = toPositiveNumber(
  import.meta.env.VITE_API_TIMEOUT_MS,
  45000,
);
const NETWORK_RETRY_DELAY_MS = toPositiveNumber(
  import.meta.env.VITE_API_RETRY_DELAY_MS,
  900,
);
const DEFAULT_NETWORK_RETRIES = toPositiveNumber(
  import.meta.env.VITE_API_NETWORK_RETRIES,
  1,
);
const RETRYABLE_METHODS = new Set(["get", "head", "options"]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ERR_NETWORK",
  "ETIMEDOUT",
]);

const wait = (duration) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });

const isRetryableNetworkError = (error) => {
  if (!error || error.response) return false;

  const code = String(error.code || "");
  const message = String(error.message || "");

  return (
    RETRYABLE_NETWORK_CODES.has(code) ||
    /timeout|network error|failed to fetch|load failed/i.test(message)
  );
};

const shouldRetryNetworkError = (error) => {
  if (!isRetryableNetworkError(error)) return false;

  const config = error.config || {};
  if (config.skipNetworkRetry) return false;

  const method = String(config.method || "get").toLowerCase();
  if (!RETRYABLE_METHODS.has(method)) return false;

  const retryLimit = toPositiveNumber(
    config.networkRetries,
    DEFAULT_NETWORK_RETRIES,
  );
  const retryCount = Number(config.__networkRetryCount || 0);

  return retryCount < retryLimit;
};

const SESSION_ROLE_KEY = "rov_session_role";
const SESSION_ACCOUNT_TYPE_KEY = "rov_session_account_type";
const SESSION_EXPIRED_EVENT = "rovauto:session-expired";
const SESSION_ERROR_PATTERN =
  /authentication token missing|authentication required|invalid account session|account no longer exists|invalid or expired token|invalid or expired session|session expired/i;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    // Let the browser set the multipart boundary for FormData requests.
    if (config.data instanceof FormData) {
      if (typeof config.headers?.delete === "function") {
        config.headers.delete("Content-Type");
      } else if (config.headers) {
        delete config.headers["Content-Type"];
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (shouldRetryNetworkError(error)) {
      const retryConfig = {
        ...error.config,
        __networkRetryCount: Number(error.config?.__networkRetryCount || 0) + 1,
      };

      await wait(NETWORK_RETRY_DELAY_MS);
      return api(retryConfig);
    }

    const status = error.response?.status;
    const message = error.response?.data?.message || "";
    const isExpiredSession =
      status === 401 && SESSION_ERROR_PATTERN.test(message);

    if (isExpiredSession) {
      localStorage.removeItem(SESSION_ROLE_KEY);
      localStorage.removeItem(SESSION_ACCOUNT_TYPE_KEY);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, {
            detail: {
              url: error.config?.url || "",
            },
          }),
        );
      }

      if (
        !error.config?.skipSessionExpiryMessage &&
        error.response?.data
      ) {
        error.response.data.message =
          "Login session expired. Please login again.";
      }
    }

    reportApiFailure(error);

    return Promise.reject(error);
  },
);

export default api;
