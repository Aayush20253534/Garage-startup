const axios = require("axios");
const prisma = require("../config/prisma");
const systemIssueReporter = require("./systemIssueReporter.service");

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_QUIET_PERIOD_MS = 30 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const MIN_QUIET_PERIOD_MS = 5 * 60 * 1000;

let resolverTimer = null;
let resolverRunning = false;

const parseBooleanEnv = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
};

const parseDurationMs = (value, fallback, minimum) => {
  const parsed = Number(value || fallback);

  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
};

const getIntervalMs = () =>
  parseDurationMs(
    process.env.SYSTEM_ISSUE_AUTO_RESOLVE_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    MIN_INTERVAL_MS,
  );

const getQuietPeriodMs = () =>
  parseDurationMs(
    process.env.SYSTEM_ISSUE_AUTO_RESOLVE_QUIET_MS,
    DEFAULT_QUIET_PERIOD_MS,
    MIN_QUIET_PERIOD_MS,
  );

const isAutoResolveEnabled = () =>
  parseBooleanEnv(process.env.SYSTEM_ISSUE_AUTO_RESOLVE_ENABLED, true);

const formatMinutes = (durationMs) => {
  const minutes = Math.round(durationMs / (60 * 1000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

const getProbeBaseUrl = () =>
  String(
    process.env.SYSTEM_ISSUE_PROBE_BASE_URL ||
      process.env.API_BASE_URL ||
      process.env.BACKEND_URL ||
      `http://127.0.0.1:${process.env.PORT || 5000}/api/v1`,
  ).replace(/\/+$/, "");

const isSafeProbeMethod = (method) =>
  ["GET", "HEAD"].includes(String(method || "GET").toUpperCase());

const parseStatusListEnv = (value, fallback = []) => {
  const raw = String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));

  return raw.length > 0 ? raw : fallback;
};

const getAllowedProtectedProbeStatuses = () =>
  new Set(
    parseStatusListEnv(
      process.env.SYSTEM_ISSUE_PROTECTED_PROBE_OK_STATUSES,
      [401, 403],
    ),
  );

const isQuietOnlyAutoResolveEnabled = () =>
  parseBooleanEnv(process.env.SYSTEM_ISSUE_QUIET_ONLY_AUTO_RESOLVE_ENABLED, true);

const isProtectedEndpoint = (issue) => {
  const endpoint = String(issue.endpoint || "");
  const actorType = String(issue.actorType || "PUBLIC").toUpperCase();

  return (
    actorType !== "PUBLIC" ||
    /^\/?(api\/v1\/)?(customer|vehicles|locations|notifications|bookings|payments|complaints|dashboard|chatbot|activities|wallet|sos|garage\/wallet|garage\/requests|admin|intern)(\/|$)/i.test(
      endpoint.replace(/^https?:\/\/[^/]+/i, ""),
    )
  );
};

const canResolveByQuietPeriodOnly = (issue) => {
  if (!isQuietOnlyAutoResolveEnabled()) return false;
  if (/system-issues\/report/i.test(String(issue.endpoint || ""))) return false;

  return !isSafeProbeMethod(issue.method) || isProtectedEndpoint(issue);
};

const buildResolutionNote = (quietPeriodMs, verification) => {
  const base =
    `Auto-resolved after no new occurrences for ${formatMinutes(quietPeriodMs)} `;

  if (verification.reason === "quiet_period_only") {
    return (
      base +
      "because this issue belongs to an unsafe or protected endpoint that cannot be replayed safely. " +
      "The issue will reopen automatically if it happens again."
    );
  }

  if (verification.reason === "protected_probe_reachable") {
    return (
      base +
      `and the protected endpoint responded with expected auth status ${verification.status}. ` +
      "The issue will reopen automatically if it happens again."
    );
  }

  return (
    base +
    `and a successful verification probe (${verification.status}). ` +
    "The issue will reopen automatically if it happens again."
  );
};

const toProbeUrl = (issue) => {
  const metadataProbeUrl =
    typeof issue.metadata?.autoResolveProbeUrl === "string"
      ? issue.metadata.autoResolveProbeUrl.trim()
      : "";
  const endpoint = metadataProbeUrl || String(issue.endpoint || "").trim();

  if (!endpoint || /system-issues\/report/i.test(endpoint)) {
    return null;
  }

  if (!metadataProbeUrl && !isSafeProbeMethod(issue.method)) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(endpoint)) {
      return endpoint;
    }

    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    const baseUrl = getProbeBaseUrl();

    if (normalizedEndpoint.startsWith("/api/v1/")) {
      return `${baseUrl.replace(/\/api\/v1$/, "")}${normalizedEndpoint}`;
    }

    return `${baseUrl}${normalizedEndpoint}`;
  } catch {
    return null;
  }
};

const verifyIssueResolved = async (issue) => {
  const probeUrl = toProbeUrl(issue);

  if (!probeUrl) {
    if (canResolveByQuietPeriodOnly(issue)) {
      return { verified: true, reason: "quiet_period_only" };
    }

    return { verified: false, reason: "no_safe_probe" };
  }

  try {
    const response = await axios.request({
      method: isSafeProbeMethod(issue.method) ? issue.method || "GET" : "GET",
      url: probeUrl,
      timeout: Number(process.env.SYSTEM_ISSUE_PROBE_TIMEOUT_MS || 8000),
      validateStatus: (status) => status < 500,
      headers: {
        "X-Rovauto-System-Probe": "system-issue-auto-resolver",
      },
    });

    if (response.status >= 200 && response.status < 400) {
      return { verified: true, status: response.status, probeUrl };
    }

    if (
      isProtectedEndpoint(issue) &&
      getAllowedProtectedProbeStatuses().has(response.status)
    ) {
      return {
        verified: true,
        status: response.status,
        probeUrl,
        reason: "protected_probe_reachable",
      };
    }

    return { verified: false, status: response.status, probeUrl };
  } catch (error) {
    return {
      verified: false,
      reason:
        error.response?.status ||
        error.code ||
        error.message ||
        "probe_failed",
      probeUrl,
    };
  }
};

const runSystemIssueAutoResolverOnce = async () => {
  if (!isAutoResolveEnabled()) {
    return { skipped: true, reason: "disabled" };
  }

  if (resolverRunning) {
    return { skipped: true, reason: "already_running" };
  }

  resolverRunning = true;

  try {
    const quietPeriodMs = getQuietPeriodMs();
    const cutoff = new Date(Date.now() - quietPeriodMs);
    const candidates = await prisma.systemIssue.findMany({
      where: {
        status: { in: ["OPEN", "INVESTIGATING"] },
        lastSeenAt: { lte: cutoff },
      },
      orderBy: { lastSeenAt: "asc" },
      take: Math.min(
        Math.max(Number(process.env.SYSTEM_ISSUE_AUTO_RESOLVE_BATCH || 25), 1),
        100,
      ),
    });

    let resolvedCount = 0;
    let skippedCount = 0;

    for (const issue of candidates) {
      const verification = await verifyIssueResolved(issue);

      if (!verification.verified) {
        skippedCount += 1;
        continue;
      }

      const result = await prisma.systemIssue.updateMany({
        where: {
          id: issue.id,
          status: { in: ["OPEN", "INVESTIGATING"] },
          lastSeenAt: { lte: cutoff },
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedById: null,
          resolutionNote: buildResolutionNote(quietPeriodMs, verification),
        },
      });

      resolvedCount += result.count;
    }

    return {
      resolvedCount,
      skippedCount,
      checkedCount: candidates.length,
      cutoff,
      quietPeriodMs,
    };
  } finally {
    resolverRunning = false;
  }
};

const reportResolverFailure = (error, title) => {
  console.error("[system-issue-auto-resolver]", error.message);
  void systemIssueReporter.captureBackgroundError(error, {
    title,
    component: "System issue auto resolver",
    severity: "ERROR",
  });
};

const startSystemIssueAutoResolver = () => {
  if (resolverTimer) return resolverTimer;

  if (!isAutoResolveEnabled()) {
    return null;
  }

  runSystemIssueAutoResolverOnce().catch((error) => {
    reportResolverFailure(
      error,
      "System issue auto resolver initial run failed",
    );
  });

  resolverTimer = setInterval(() => {
    runSystemIssueAutoResolverOnce().catch((error) => {
      reportResolverFailure(error, "System issue auto resolver run failed");
    });
  }, getIntervalMs());

  if (typeof resolverTimer.unref === "function") {
    resolverTimer.unref();
  }

  return resolverTimer;
};

const stopSystemIssueAutoResolver = () => {
  if (!resolverTimer) return;
  clearInterval(resolverTimer);
  resolverTimer = null;
};

module.exports = {
  runSystemIssueAutoResolverOnce,
  startSystemIssueAutoResolver,
  stopSystemIssueAutoResolver,
};
