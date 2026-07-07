import axios from "axios";
import { reportApiFailure } from "@/utils/errorReporter";

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

// Production requests must stay on the frontend origin. Vercel proxies
// /api/v1/* to Render, which makes the HttpOnly auth cookie first-party.
const apiBaseUrl = (
  import.meta.env.PROD
    ? "/api/v1"
    : configuredBaseUrl || "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

const SESSION_ROLE_KEY = "rov_session_role";
const SESSION_ACCOUNT_TYPE_KEY = "rov_session_account_type";
const SESSION_EXPIRED_EVENT = "rovauto:session-expired";
const SESSION_ERROR_PATTERN =
  /authentication token missing|authentication required|invalid account session|account no longer exists|invalid or expired token|invalid or expired session|session expired/i;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 20000,
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
  (error) => {
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
