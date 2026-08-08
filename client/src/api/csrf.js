import axios from "axios";
import { getApiBaseUrl } from "@/api/baseUrl";

export const CSRF_COOKIE_NAME = "rovautoCsrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

let csrfTokenCache = "";
let csrfTokenRequest = null;

const readCookie = (name) => {
  if (typeof document === "undefined") return "";

  return (
    document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
};

export const ensureCsrfToken = async ({ forceRefresh = false } = {}) => {
  if (forceRefresh) csrfTokenCache = "";
  if (!forceRefresh && csrfTokenCache) return csrfTokenCache;

  const current = readCookie(CSRF_COOKIE_NAME);
  if (!forceRefresh && current) {
    csrfTokenCache = decodeURIComponent(current);
    return csrfTokenCache;
  }

  if (!csrfTokenRequest) {
    csrfTokenRequest = axios
      .get(`${getApiBaseUrl()}/csrf-token`, {
        withCredentials: true,
        timeout: 15000,
        headers: { Accept: "application/json" },
      })
      .then((response) => {
        // Cross-subdomain cookies are not readable through document.cookie.
        // The endpoint returns the same CSRF value for the request header.
        const issuedFromResponse = String(response.data?.data?.token || "").trim();
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
