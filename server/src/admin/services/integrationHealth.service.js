const axios = require("axios");
const { getAuth } = require("firebase-admin/auth");
const { Resend } = require("resend");

const prisma = require("../../config/prisma");
const redis = require("../../config/redis");
const cloudinary = require("../../config/cloudinary");
const { getFirebaseApp } = require("../../config/firebase");
const {
  getCashfreeBaseUrl,
  getCashfreeMode,
  getCashfreeRequestConfig,
  isCashfreeConfigured,
} = require("../../config/cashfree");
const {
  getWhatsappAccessToken,
  getWhatsappPhoneNumberId,
  getWhatsappProviderUrl,
  isWhatsappConfigured,
} = require("../../services/garageWhatsapp.service");

const REPORT_CACHE_MS = Math.max(
  10_000,
  Math.min(Number(process.env.INTEGRATION_HEALTH_CACHE_MS || 30_000), 5 * 60_000),
);
const PROBE_TIMEOUT_MS = Math.max(
  1_000,
  Math.min(Number(process.env.INTEGRATION_HEALTH_TIMEOUT_MS || 6_000), 15_000),
);

let cachedReport = null;
let cacheExpiresAt = 0;
let activeReportPromise = null;

const STATUS = Object.freeze({
  OPERATIONAL: "OPERATIONAL",
  DEGRADED: "DEGRADED",
  OUTAGE: "OUTAGE",
  NOT_CONFIGURED: "NOT_CONFIGURED",
});

const clean = (value) => String(value || "").trim();
const isConfigured = (...names) => names.every((name) => Boolean(clean(process.env[name])));

const withTimeout = (promise, timeoutMs = PROBE_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Health check timed out")), timeoutMs);
      timer.unref?.();
    }),
  ]);

const redactError = (error, fallback = "Health check failed") => {
  const providerMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.response?.data?.error_description ||
    error?.message ||
    fallback;

  return String(providerMessage)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(access_token|token|secret|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/https?:\/\/[^\s]+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "[redacted-url]";
      }
    })
    .slice(0, 320);
};

const maskPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length <= 4 ? digits : `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
};

const getSenderDomain = () => {
  const sender = clean(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL);
  const addressMatch = sender.match(/<([^>]+)>/);
  const email = clean(addressMatch?.[1] || sender).toLowerCase();
  const atIndex = email.lastIndexOf("@");
  return atIndex > -1 ? email.slice(atIndex + 1) : "";
};

const runProbe = async ({
  key,
  name,
  category,
  configured = true,
  notConfiguredMessage,
  probe,
}) => {
  const checkedAt = new Date().toISOString();

  if (!configured) {
    return {
      key,
      name,
      category,
      status: STATUS.NOT_CONFIGURED,
      configured: false,
      latencyMs: null,
      checkedAt,
      message: notConfiguredMessage || `${name} is not configured`,
      details: {},
    };
  }

  const startedAt = Date.now();

  try {
    const result = await withTimeout(Promise.resolve().then(probe));
    return {
      key,
      name,
      category,
      status: result?.status || STATUS.OPERATIONAL,
      configured: true,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      message: result?.message || `${name} is operational`,
      details: result?.details || {},
    };
  } catch (error) {
    return {
      key,
      name,
      category,
      status: STATUS.OUTAGE,
      configured: true,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      message: redactError(error),
      details: {
        httpStatus: error?.response?.status || error?.statusCode || null,
      },
    };
  }
};

const getDatabaseMetrics = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();

  const [
    paymentGroups,
    latestCashfreePayment,
    emailGroups,
    latestSentEmail,
    latestFailedEmail,
    customerPushSubscriptions,
    garagePushSubscriptions,
    supportPushSubscriptions,
    overduePriceSchedules,
    openIssues,
    criticalOpenIssues,
    issuesLast24Hours,
    recentIssues,
  ] = await Promise.all([
    prisma.payment.groupBy({
      by: ["status"],
      where: { updatedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.payment.findFirst({
      where: { cashfreeOrderId: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: {
        cashfreeOrderId: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.garageApplicationEmailOutbox.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.garageApplicationEmailOutbox.findFirst({
      where: { status: "SENT" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    prisma.garageApplicationEmailOutbox.findFirst({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, lastError: true, attempts: true },
    }),
    prisma.pushSubscription.count(),
    prisma.garagePushSubscription.count(),
    prisma.customerSupportPushSubscription.count(),
    prisma.priceRangeSchedule.count({
      where: {
        status: "PENDING",
        startsAt: { lte: now },
      },
    }),
    prisma.systemIssue.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.systemIssue.count({
      where: { status: { in: ["OPEN", "INVESTIGATING"] }, severity: "CRITICAL" },
    }),
    prisma.systemIssue.count({ where: { lastSeenAt: { gte: since } } }),
    prisma.systemIssue.findMany({
      where: { status: { in: ["OPEN", "INVESTIGATING"] } },
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      take: 6,
      select: {
        id: true,
        title: true,
        severity: true,
        occurrenceCount: true,
        route: true,
        lastSeenAt: true,
      },
    }),
  ]);

  const toCountMap = (groups) =>
    Object.fromEntries(groups.map((group) => [group.status, group._count._all]));

  return {
    payments: {
      last24Hours: toCountMap(paymentGroups),
      latestCashfreePayment,
    },
    emailOutbox: {
      counts: toCountMap(emailGroups),
      latestSentAt: latestSentEmail?.sentAt || null,
      latestFailure: latestFailedEmail
        ? {
            at: latestFailedEmail.updatedAt,
            attempts: latestFailedEmail.attempts,
            message: redactError(latestFailedEmail.lastError, "Email delivery failed"),
          }
        : null,
    },
    pushSubscriptions: {
      customer: customerPushSubscriptions,
      garage: garagePushSubscriptions,
      support: supportPushSubscriptions,
      total:
        customerPushSubscriptions + garagePushSubscriptions + supportPushSubscriptions,
    },
    jobs: {
      overduePriceSchedules,
    },
    incidents: {
      open: openIssues,
      criticalOpen: criticalOpenIssues,
      last24Hours: issuesLast24Hours,
      recent: recentIssues,
    },
  };
};

const checkRuntime = () =>
  runProbe({
    key: "runtime",
    name: "Backend Runtime",
    category: "Core platform",
    probe: async () => {
      const memory = process.memoryUsage();
      return {
        message: "The Rovauto API process is running",
        details: {
          environment: process.env.NODE_ENV || "development",
          release: clean(process.env.RENDER_GIT_COMMIT || process.env.APP_RELEASE || process.env.RELEASE_VERSION) || "not set",
          nodeVersion: process.version,
          uptimeSeconds: Math.round(process.uptime()),
          memoryUsedMb: Math.round(memory.rss / 1024 / 1024),
          processId: process.pid,
        },
      };
    },
  });

const checkDatabase = () =>
  runProbe({
    key: "database",
    name: "PostgreSQL Database",
    category: "Core platform",
    configured: Boolean(clean(process.env.DATABASE_URL)),
    notConfiguredMessage: "DATABASE_URL is missing",
    probe: async () => {
      await prisma.$queryRaw`SELECT 1`;
      return {
        message: "Database query completed successfully",
        details: { engine: "PostgreSQL", orm: "Prisma" },
      };
    },
  });

const checkRedis = () =>
  runProbe({
    key: "redis",
    name: "Redis Cache",
    category: "Core platform",
    configured: Boolean(redis && clean(process.env.REDIS_URL)),
    notConfiguredMessage: "REDIS_URL is missing; cache and distributed rate limits are disabled",
    probe: async () => {
      const response = await redis.ping();
      if (response !== "PONG") throw new Error("Redis did not return PONG");
      return {
        message: "Redis responded to PING",
        details: { connectionState: redis.status },
      };
    },
  });

const checkCloudinary = () =>
  runProbe({
    key: "cloudinary",
    name: "Cloudinary Media",
    category: "Media and storage",
    configured: isConfigured(
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ),
    notConfiguredMessage: "Cloudinary credentials are incomplete",
    probe: async () => {
      const response = await cloudinary.api.ping();
      if (response?.status && response.status !== "ok") {
        throw new Error(`Cloudinary returned ${response.status}`);
      }
      return {
        message: "Cloudinary Admin API is reachable",
        details: {
          cloudName: clean(process.env.CLOUDINARY_CLOUD_NAME),
          providerStatus: response?.status || "ok",
        },
      };
    },
  });

const checkWhatsapp = () =>
  runProbe({
    key: "whatsapp",
    name: "WhatsApp Cloud API",
    category: "Customer communications",
    configured: isWhatsappConfigured(),
    notConfiguredMessage: "WhatsApp provider URL, phone number ID or access token is missing",
    probe: async () => {
      const providerUrl = getWhatsappProviderUrl();
      const phoneNumberId = getWhatsappPhoneNumberId();
      const token = getWhatsappAccessToken();
      const isMetaCloudApi = /graph\.facebook\.com/i.test(providerUrl);

      if (!isMetaCloudApi || !phoneNumberId) {
        return {
          status: STATUS.DEGRADED,
          message: "WhatsApp is configured through a custom provider; live credential verification is unavailable",
          details: {
            provider: "custom",
            webhookVerificationConfigured: Boolean(
              clean(process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
            ),
          },
        };
      }

      const versionMatch = providerUrl.match(/graph\.facebook\.com\/(v\d+\.\d+)\//i);
      const graphVersion = versionMatch?.[1] || clean(process.env.WHATSAPP_GRAPH_VERSION) || "v25.0";
      const response = await axios.get(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}`,
        {
          params: {
            fields: "display_phone_number,verified_name,quality_rating",
          },
          headers: { Authorization: `Bearer ${token}` },
          timeout: PROBE_TIMEOUT_MS,
        },
      );

      return {
        message: "Meta verified the WhatsApp phone-number credentials",
        details: {
          provider: "Meta Cloud API",
          verifiedName: response.data?.verified_name || null,
          displayPhoneNumber: maskPhone(response.data?.display_phone_number),
          qualityRating: response.data?.quality_rating || null,
          webhookVerificationConfigured: Boolean(
            clean(process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
          ),
          graphVersion,
        },
      };
    },
  });

const checkCashfree = (metrics) =>
  runProbe({
    key: "cashfree",
    name: "Cashfree Payments",
    category: "Payments",
    configured: isCashfreeConfigured(),
    notConfiguredMessage: "Cashfree app ID or secret key is missing",
    probe: async () => {
      const recentOrder = metrics?.payments?.latestCashfreePayment;
      const recentCounts = metrics?.payments?.last24Hours || {};
      const baseDetails = {
        mode: getCashfreeMode(),
        paidLast24Hours: recentCounts.PAID || 0,
        failedLast24Hours: recentCounts.FAILED || 0,
        createdLast24Hours: recentCounts.CREATED || 0,
        lastOrderCheckedAt: recentOrder?.updatedAt || null,
      };

      if (!recentOrder?.cashfreeOrderId) {
        return {
          status: STATUS.DEGRADED,
          message: "Cashfree is configured, but no local order is available for a live credential check",
          details: baseDetails,
        };
      }

      try {
        const response = await axios.get(
          `${getCashfreeBaseUrl()}/orders/${encodeURIComponent(recentOrder.cashfreeOrderId)}`,
          getCashfreeRequestConfig({ timeout: PROBE_TIMEOUT_MS }),
        );

        return {
          message: "Cashfree credentials and recent order lookup are working",
          details: {
            ...baseDetails,
            recentOrderStatus: response.data?.order_status || recentOrder.status,
          },
        };
      } catch (error) {
        if (error?.response?.status === 404) {
          return {
            status: STATUS.DEGRADED,
            message: "Cashfree is reachable, but the latest local order was not found in the selected Cashfree environment",
            details: baseDetails,
          };
        }
        throw error;
      }
    },
  });

const checkEmail = (metrics) =>
  runProbe({
    key: "email",
    name: "Resend Email and OTP",
    category: "Customer communications",
    configured: isConfigured("RESEND_API_KEY") && Boolean(getSenderDomain()),
    notConfiguredMessage: "RESEND_API_KEY or the sender email is missing",
    probe: async () => {
      const resend = new Resend(clean(process.env.RESEND_API_KEY));
      const result = await resend.domains.list();
      if (result?.error) throw new Error(result.error.message || "Resend rejected the API key");

      const domains = Array.isArray(result?.data?.data)
        ? result.data.data
        : Array.isArray(result?.data)
          ? result.data
          : [];
      const senderDomain = getSenderDomain();
      const senderDomainRecord = domains.find(
        (domain) => String(domain?.name || "").toLowerCase() === senderDomain,
      );
      const outbox = metrics?.emailOutbox || { counts: {} };
      const failedCount = outbox.counts?.FAILED || 0;
      const pendingCount = outbox.counts?.PENDING || 0;
      const processingCount = outbox.counts?.PROCESSING || 0;
      const senderUsesResendTestDomain = senderDomain === "resend.dev";
      const senderVerified =
        senderUsesResendTestDomain || senderDomainRecord?.status === "verified";

      return {
        status: senderVerified && failedCount === 0 ? STATUS.OPERATIONAL : STATUS.DEGRADED,
        message: !senderVerified
          ? "Resend API is reachable, but the configured sender domain is not verified"
          : failedCount > 0
            ? "Resend is reachable, but failed emails remain in the delivery queue"
            : "Resend credentials and sender domain are ready",
        details: {
          deliveryMode: clean(process.env.EMAIL_OTP_DELIVERY) || "not set",
          senderDomain,
          senderDomainStatus: senderUsesResendTestDomain
            ? "test-domain"
            : senderDomainRecord?.status || "not found",
          verifiedDomains: domains.filter((domain) => domain?.status === "verified").length,
          pendingEmails: pendingCount,
          processingEmails: processingCount,
          failedEmails: failedCount,
          latestSentAt: outbox.latestSentAt || null,
          latestFailure: outbox.latestFailure || null,
        },
      };
    },
  });

const checkFirebase = () =>
  runProbe({
    key: "firebase",
    name: "Firebase Authentication",
    category: "Authentication",
    configured: isConfigured(
      "FIREBASE_PROJECT_ID",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
    ),
    notConfiguredMessage: "Firebase service-account configuration is incomplete",
    probe: async () => {
      const auth = getAuth(getFirebaseApp());
      await auth.listUsers(1);
      return {
        message: "Firebase accepted the service-account credentials",
        details: { projectId: clean(process.env.FIREBASE_PROJECT_ID) },
      };
    },
  });

const checkWebPush = (metrics) =>
  runProbe({
    key: "web-push",
    name: "Web Push Notifications",
    category: "Customer communications",
    configured: isConfigured("WEB_PUSH_VAPID_PUBLIC_KEY", "WEB_PUSH_VAPID_PRIVATE_KEY"),
    notConfiguredMessage: "VAPID public/private keys are missing",
    probe: async () => ({
      message: "VAPID keys are configured for browser push notifications",
      details: {
        activeSubscriptions: metrics?.pushSubscriptions?.total || 0,
        customerSubscriptions: metrics?.pushSubscriptions?.customer || 0,
        garageSubscriptions: metrics?.pushSubscriptions?.garage || 0,
        supportSubscriptions: metrics?.pushSubscriptions?.support || 0,
      },
    }),
  });

const checkBackgroundJobs = (metrics) =>
  runProbe({
    key: "background-jobs",
    name: "Background Jobs",
    category: "Operations",
    configured: true,
    probe: async () => {
      if (!metrics) {
        return {
          status: STATUS.DEGRADED,
          message: "Background-job counters are unavailable because database metrics could not be loaded",
          details: {},
        };
      }

      const emailCounts = metrics.emailOutbox?.counts || {};
      const failedEmails = emailCounts.FAILED || 0;
      const overduePriceSchedules = metrics?.jobs?.overduePriceSchedules || 0;
      const processingEmails = emailCounts.PROCESSING || 0;
      const degraded = failedEmails > 0 || overduePriceSchedules > 0;

      return {
        status: degraded ? STATUS.DEGRADED : STATUS.OPERATIONAL,
        message: degraded
          ? "One or more queued operations need attention"
          : "Queued email and pricing operations have no detected backlog",
        details: {
          pendingEmails: emailCounts.PENDING || 0,
          processingEmails,
          failedEmails,
          overduePriceSchedules,
        },
      };
    },
  });

const buildReport = async () => {
  let metrics = null;
  let metricsError = null;

  try {
    metrics = await withTimeout(getDatabaseMetrics(), Math.max(PROBE_TIMEOUT_MS, 8_000));
  } catch (error) {
    metricsError = redactError(error, "Operational metrics could not be loaded");
  }

  const integrations = await Promise.all([
    checkRuntime(),
    checkDatabase(),
    checkRedis(),
    checkCloudinary(),
    checkWhatsapp(),
    checkCashfree(metrics),
    checkEmail(metrics),
    checkFirebase(),
    checkWebPush(metrics),
    checkBackgroundJobs(metrics),
  ]);

  const summary = integrations.reduce(
    (result, integration) => {
      result.total += 1;
      result[integration.status] = (result[integration.status] || 0) + 1;
      return result;
    },
    {
      total: 0,
      OPERATIONAL: 0,
      DEGRADED: 0,
      OUTAGE: 0,
      NOT_CONFIGURED: 0,
    },
  );

  const overallStatus = summary.OUTAGE
    ? STATUS.OUTAGE
    : summary.DEGRADED || summary.NOT_CONFIGURED
      ? STATUS.DEGRADED
      : STATUS.OPERATIONAL;

  return {
    checkedAt: new Date().toISOString(),
    overallStatus,
    summary,
    integrations,
    incidents: metrics?.incidents || {
      open: 0,
      criticalOpen: 0,
      last24Hours: 0,
      recent: [],
    },
    metricsAvailable: Boolean(metrics),
    metricsError,
    cacheSeconds: Math.round(REPORT_CACHE_MS / 1000),
  };
};

const getIntegrationHealth = async ({ force = false } = {}) => {
  const shouldForce = force === true || String(force).toLowerCase() === "true";

  if (!shouldForce && cachedReport && Date.now() < cacheExpiresAt) {
    return { ...cachedReport, cached: true };
  }

  if (activeReportPromise) {
    return activeReportPromise;
  }

  activeReportPromise = buildReport()
    .then((report) => {
      cachedReport = { ...report, cached: false };
      cacheExpiresAt = Date.now() + REPORT_CACHE_MS;
      return cachedReport;
    })
    .finally(() => {
      activeReportPromise = null;
    });

  return activeReportPromise;
};

module.exports = {
  STATUS,
  getIntegrationHealth,
};
