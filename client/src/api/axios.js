import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL;

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
    const garageToken = localStorage.getItem("garage_token");
    const customerToken = localStorage.getItem("token");
    const url = String(config.url || "");
    const isGarageRequest =
      url.startsWith("/garage/") ||
      url === "/garages/me" ||
      /^\/garages\/[^/]+\/media$/.test(url);
    const token = isGarageRequest
      ? garageToken || customerToken
      : customerToken || garageToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
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
      /authentication token missing|authentication required|invalid or expired token/i.test(
        message,
      )
    ) {
      error.response.data.message =
        "Login session expired. Please login again.";
    }

    return Promise.reject(error);
  },
);

export default api;
