import axios from "axios";

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = configuredBaseUrl?.replace(/\/+$/, "");

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
    const message = error.response?.data?.message || "";

    if (
      error.response?.status === 401 &&
      /authentication token missing|authentication required|invalid or expired token|session expired/i.test(
        message,
      )
    ) {
      if (error.response?.data) {
        error.response.data.message =
          "Login session expired. Please login again.";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
