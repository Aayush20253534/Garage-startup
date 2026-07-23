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
const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);
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
const SUPPORT_SESSION_ROLE_KEY = "rov_support_session_role";
const SUPPORT_SESSION_ACCOUNT_TYPE_KEY = "rov_support_session_account_type";
const SUPPORT_USER_KEY = "rov_support_user";
const SESSION_EXPIRED_EVENT = "rovauto:session-expired";
const AUTH_NOTICE_KEY = "rov_auth_notice";
const CUSTOMER_BLOCKED_CODE = "CUSTOMER_BLOCKED";
const CSRF_COOKIE_NAME = "rovautoCsrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";
let csrfTokenCache = "";
let csrfTokenRequest = null;
const SESSION_ERROR_PATTERN =
  /authentication token missing|authentication required|invalid account session|account no longer exists|invalid or expired token|invalid or expired session|session expired/i;

const readCookie = (name) => {
  if (typeof document === "undefined") return "";

  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
};

const ensureCsrfToken = async ({ forceRefresh = false } = {}) => {
  if (forceRefresh) {
    csrfTokenCache = "";
  }

  if (!forceRefresh && csrfTokenCache) return csrfTokenCache;

  const current = readCookie(CSRF_COOKIE_NAME);
  if (!forceRefresh && current) {
    csrfTokenCache = decodeURIComponent(current);
    return csrfTokenCache;
  }

  if (!csrfTokenRequest) {
    csrfTokenRequest = axios
      .get(`${apiBaseUrl}/csrf-token`, {
        withCredentials: true,
        timeout: API_TIMEOUT_MS,
        headers: {
          Accept: "application/json",
        },
      })
      .then((response) => {
        // Cross-subdomain cookies are not readable through document.cookie.
        // The endpoint therefore returns the same token for the request header.
        const issuedFromResponse = String(
          response.data?.data?.token || "",
        ).trim();
        const issuedFromCookie = readCookie(CSRF_COOKIE_NAME);
        const issued =
          issuedFromResponse ||
          (issuedFromCookie ? decodeURIComponent(issuedFromCookie) : "");

        csrfTokenCache = issued;
        return issued;
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }

  return csrfTokenRequest;
};

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    // Let the browser set the multipart boundary for FormData requests.
    if (config.data instanceof FormData) {
      if (typeof config.headers?.delete === "function") {
        config.headers.delete("Content-Type");
      } else if (config.headers) {
        delete config.headers["Content-Type"];
      }
    }

    const method = String(config.method || "get").toLowerCase();
    const requestUrl = String(config.url || "");

    if (
      UNSAFE_METHODS.has(method) &&
      !requestUrl.includes("/csrf-token")
    ) {
      const csrfToken = await ensureCsrfToken();

      if (csrfToken) {
        if (typeof config.headers?.set === "function") {
          config.headers.set(CSRF_HEADER_NAME, csrfToken);
        } else {
          config.headers = {
            ...(config.headers || {}),
            [CSRF_HEADER_NAME]: csrfToken,
          };
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || "";
    const isCsrfFailure =
      status === 403 && /invalid csrf token/i.test(String(message));

    if (isCsrfFailure && !error.config?.__csrfRetry) {
      const csrfToken = await ensureCsrfToken({ forceRefresh: true });

      if (csrfToken) {
        const retryConfig = {
          ...error.config,
          __csrfRetry: true,
          headers: {
            ...(error.config?.headers || {}),
            [CSRF_HEADER_NAME]: csrfToken,
          },
        };

        return api(retryConfig);
      }
    }

    if (shouldRetryNetworkError(error)) {
      const retryConfig = {
        ...error.config,
        __networkRetryCount: Number(error.config?.__networkRetryCount || 0) + 1,
      };

      await wait(NETWORK_RETRY_DELAY_MS);
      return api(retryConfig);
    }

    const isBlockedCustomer =
      status === 403 &&
      error.response?.data?.code === CUSTOMER_BLOCKED_CODE;
    const isExpiredSession =
      status === 401 && SESSION_ERROR_PATTERN.test(message);

    if (isBlockedCustomer) {
      localStorage.removeItem(SESSION_ROLE_KEY);
      localStorage.removeItem(SESSION_ACCOUNT_TYPE_KEY);
      sessionStorage.setItem(
        AUTH_NOTICE_KEY,
        message || "You are blocked from using Rovauto.",
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, {
            detail: {
              url: String(error.config?.url || ""),
              scope: "main",
              reason: "blocked",
              message,
            },
          }),
        );
      }
    }

    if (isExpiredSession) {
      const requestUrl = String(error.config?.url || "");
      const supportScope =
        error.config?.sessionScope === "support" ||
        requestUrl.startsWith("/auth/support/") ||
        requestUrl.startsWith("/customer-support/");

      if (supportScope) {
        localStorage.removeItem(SUPPORT_SESSION_ROLE_KEY);
        localStorage.removeItem(SUPPORT_SESSION_ACCOUNT_TYPE_KEY);
        localStorage.removeItem(SUPPORT_USER_KEY);
      } else {
        localStorage.removeItem(SESSION_ROLE_KEY);
        localStorage.removeItem(SESSION_ACCOUNT_TYPE_KEY);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, {
            detail: {
              url: requestUrl,
              scope: supportScope ? "support" : "main",
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
