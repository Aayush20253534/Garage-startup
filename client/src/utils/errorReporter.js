import { getSystemIssueReportUrl } from "@/api/baseUrl";
import { CSRF_HEADER_NAME, ensureCsrfToken } from "@/api/csrf";

const reportUrl = getSystemIssueReportUrl();
const recentReports = new Map();
const REPORT_COOLDOWN_MS = 60 * 1000;

const SENSITIVE_KEY_PATTERN =
  /password|token|authorization|cookie|secret|otp|pin|card|cvv|session|privateKey|paymentSession/i;

const stripQueryAndFragment = (value) =>
  String(value || "").split(/[?#]/, 1)[0];

const redactSensitiveText = (value) =>
  String(value || "")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/([?&](?:token|code|otp|password|secret|session|key|authorization)=)[^&#\s]*/gi, "$1[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+91[ -]?)?[6-9]\d{9}\b/g, "[REDACTED_PHONE]")
    .replace(/\b(otp|pin|verification code|reset code)\s*[:= -]*\d{4,8}\b/gi, "$1 [REDACTED]");

const sanitizeMetadata = (value, depth = 0) => {
  if (depth > 4) return "[Maximum depth reached]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactSensitiveText(value).slice(0, 1000);
  if (["number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .slice(0, 50)
      .reduce((result, [key, item]) => {
        result[key] = SENSITIVE_KEY_PATTERN.test(key)
          ? "[REDACTED]"
          : sanitizeMetadata(item, depth + 1);
        return result;
      }, {});
  }
  return redactSensitiveText(value).slice(0, 1000);
};

const toText = (value, fallback = "Unknown frontend error") => {
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === "string") return value || fallback;
  try {
    return JSON.stringify(value) || fallback;
  } catch {
    return fallback;
  }
};

const getPortal = () => {
  if (typeof window === "undefined") return "PUBLIC";

  const path = window.location.pathname;
  const sessionRole = window.localStorage.getItem("rov_session_role");

  if (
    path.startsWith("/admin") ||
    path.startsWith("/intern") ||
    sessionRole === "ADMIN" ||
    sessionRole === "INTERN"
  ) {
    return "ADMIN";
  }
  if (path.startsWith("/garage") || ["GARAGE_OWNER", "GARAGE_CONTROLLER"].includes(sessionRole)) {
    return "GARAGE";
  }
  if (
    sessionRole === "CUSTOMER" ||
    /^\/(dashboard|booking|checkout|tracking)(\/|$)/.test(path)
  ) {
    return "CUSTOMER";
  }

  return "PUBLIC";
};

const getRoute = () => {
  if (typeof window === "undefined") return null;
  return window.location.pathname;
};

const buildFingerprint = (payload) =>
  [
    payload.errorName,
    payload.message,
    payload.endpoint,
    payload.component,
    payload.route,
  ]
    .filter(Boolean)
    .join("|")
    .replace(/\b\d{3,}\b/g, "<number>")
    .slice(0, 1200);

const shouldThrottle = (payload) => {
  const key = buildFingerprint(payload);
  const now = Date.now();
  const previous = recentReports.get(key) || 0;

  if (now - previous < REPORT_COOLDOWN_MS) return true;
  recentReports.set(key, now);

  if (recentReports.size > 100) {
    for (const [itemKey, timestamp] of recentReports) {
      if (now - timestamp > REPORT_COOLDOWN_MS * 2) {
        recentReports.delete(itemKey);
      }
    }
  }

  return false;
};

const postIssue = async (payload) => {
  if (import.meta.env.VITE_ERROR_REPORTING_ENABLED === "false") return;
  if (shouldThrottle(payload)) return;

  const body = JSON.stringify({
    ...payload,
    title: redactSensitiveText(payload.title).slice(0, 180),
    message: redactSensitiveText(payload.message).slice(0, 2000),
    stack: payload.stack
      ? redactSensitiveText(payload.stack).slice(0, 12000)
      : null,
    route: payload.route ? stripQueryAndFragment(payload.route).slice(0, 500) : null,
    endpoint: payload.endpoint
      ? stripQueryAndFragment(payload.endpoint).slice(0, 500)
      : null,
    metadata: sanitizeMetadata(payload.metadata || {}),
  });

  const send = async (forceRefresh = false) => {
    const csrfToken = await ensureCsrfToken({ forceRefresh });
    return fetch(reportUrl, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
      },
      body,
    });
  };

  try {
    const response = await send();
    // The reporter uses native fetch to avoid the Axios error interceptor loop,
    // so mirror the normal API client's single CSRF refresh on stale cookies.
    if (response.status === 403) {
      await send(true);
    }
  } catch {
    // Error reporting must never break the customer or garage flow.
  }
};

export const reportSystemIssue = (error, context = {}) => {
  const message = context.message || toText(error);
  const errorObject = error instanceof Error ? error : null;

  return postIssue({
    title: context.title || "Frontend application error",
    message,
    stack: context.stack || errorObject?.stack || null,
    severity: context.severity || "ERROR",
    actorType: context.actorType || getPortal(),
    route: context.route || getRoute(),
    method: context.method || null,
    endpoint: context.endpoint || null,
    httpStatus: context.httpStatus || null,
    errorName: context.errorName || errorObject?.name || "Error",
    component: context.component || null,
    environment: import.meta.env.MODE || "development",
    release: import.meta.env.VITE_APP_VERSION || null,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : null,
    metadata: context.metadata || {},
  });
};

const isCanceledRequest = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

const isReportEndpoint = (url) =>
  String(url || "").includes("/system-issues");

const isNetworkTimeout = (error) =>
  error?.code === "ECONNABORTED" ||
  /timeout of \d+ms exceeded|timeout/i.test(String(error?.message || ""));

export const reportApiFailure = (error) => {
  if (!error || isCanceledRequest(error)) return;

  const config = error.config || {};
  const endpoint = String(config.url || "");
  if (config.skipErrorReporting || isReportEndpoint(endpoint)) return;

  const status = error.response?.status || null;
  const criticalFlow =
    /\/(bookings|payments|garage\/requests|garage\/wallet|sos)(\/|$)/i.test(
      stripQueryAndFragment(endpoint),
    );
  const ignoredStatus = [401, 403, 404, 422, 429].includes(status);
  const shouldReport =
    !error.response ||
    Number(status) >= 500 ||
    (criticalFlow && Number(status) >= 400 && !ignoredStatus);

  if (!shouldReport) return;

  const timedOut = isNetworkTimeout(error);

  void reportSystemIssue(error, {
    title: !error.response
      ? timedOut
        ? "API request timed out before the server responded"
        : "API request could not reach the server"
      : "API request failed",
    message:
      error.response?.data?.message || error.message || "API request failed",
    severity:
      Number(status) >= 500 || (!error.response && criticalFlow)
        ? "ERROR"
        : "WARNING",
    endpoint: stripQueryAndFragment(endpoint),
    method: String(config.method || "GET").toUpperCase(),
    httpStatus: status,
    component: "Axios response interceptor",
    metadata: {
      errorCode: error.code || null,
      timeout: config.timeout || null,
      retryCount: config.__networkRetryCount || 0,
      statusText: error.response?.statusText || null,
      criticalFlow,
      timedOut,
    },
  });
};

export const installGlobalErrorReporting = () => {
  if (typeof window === "undefined") return () => {};

  const onError = (event) => {
    const message = String(event.message || event.error?.message || "");
    if (!message || message === "Script error.") return;

    void reportSystemIssue(event.error || new Error(message), {
      title: "Unhandled browser error",
      component: "window.error",
      metadata: {
        filename: event.filename || null,
        line: event.lineno || null,
        column: event.colno || null,
      },
    });
  };

  const onUnhandledRejection = (event) => {
    const reason = event.reason;
    void reportSystemIssue(
      reason instanceof Error ? reason : new Error(toText(reason)),
      {
        title: "Unhandled promise rejection",
        component: "window.unhandledrejection",
      },
    );
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
};
