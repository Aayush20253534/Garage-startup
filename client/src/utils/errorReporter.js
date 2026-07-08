import { getSystemIssueReportUrl } from "@/api/baseUrl";

const reportUrl = getSystemIssueReportUrl();
const recentReports = new Map();
const REPORT_COOLDOWN_MS = 60 * 1000;

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
  if (path.startsWith("/garage") || sessionRole === "GARAGE_OWNER") {
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
  return `${window.location.pathname}${window.location.search}`;
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

  try {
    await fetch(reportUrl, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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

export const reportApiFailure = (error) => {
  if (!error || isCanceledRequest(error)) return;

  const config = error.config || {};
  const endpoint = String(config.url || "");
  if (config.skipErrorReporting || isReportEndpoint(endpoint)) return;

  const status = error.response?.status || null;
  const criticalFlow =
    /\/(bookings|payments|garage\/requests|garage\/wallet|sos)(\/|$)/i.test(
      endpoint,
    );
  const ignoredStatus = [401, 403, 404, 422, 429].includes(status);
  const shouldReport =
    !error.response ||
    Number(status) >= 500 ||
    (criticalFlow && Number(status) >= 400 && !ignoredStatus);

  if (!shouldReport) return;

  void reportSystemIssue(error, {
    title: !error.response
      ? "API request could not reach the server"
      : "API request failed",
    message:
      error.response?.data?.message || error.message || "API request failed",
    severity: Number(status) >= 500 || !error.response ? "ERROR" : "WARNING",
    endpoint,
    method: String(config.method || "GET").toUpperCase(),
    httpStatus: status,
    component: "Axios response interceptor",
    metadata: {
      errorCode: error.code || null,
      timeout: config.timeout || null,
      params: config.params || null,
      statusText: error.response?.statusText || null,
      criticalFlow,
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
