import axios from "axios";

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = configuredBaseUrl?.replace(/\/+$/, "");

const SESSION_ROLE_KEY = "rov_session_role";
const SESSION_EXPIRED_EVENT = "rovauto:session-expired";
const SESSION_ERROR_PATTERN =
  /authentication token missing|authentication required|invalid or expired token|session expired/i;

if (!apiBaseUrl && import.meta.env.PROD) {
  throw new Error("VITE_API_URL is required for production builds.");
}

const api = axios.create({
  baseURL: apiBaseUrl || "http://localhost:5000/api/v1",
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

    return Promise.reject(error);
  },
);

export default api;
