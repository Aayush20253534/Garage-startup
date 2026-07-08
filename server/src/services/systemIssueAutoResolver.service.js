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
    const result = await prisma.systemIssue.updateMany({
      where: {
        status: { in: ["OPEN", "INVESTIGATING"] },
        lastSeenAt: { lte: cutoff },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById: null,
        resolutionNote:
          `Auto-resolved after no new occurrences for ${formatMinutes(quietPeriodMs)}. ` +
          "The issue will reopen automatically if it happens again.",
      },
    });

    return {
      resolvedCount: result.count,
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
