import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCloud,
  FiCreditCard,
  FiDatabase,
  FiHardDrive,
  FiMail,
  FiMessageCircle,
  FiRefreshCw,
  FiServer,
  FiShield,
  FiSmartphone,
  FiWifi,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

const STATUS_META = {
  OPERATIONAL: {
    label: "Operational",
    icon: FiCheckCircle,
    box: "border-green-200 bg-green-50 text-green-800",
    dot: "bg-green-500",
  },
  DEGRADED: {
    label: "Needs attention",
    icon: FiAlertTriangle,
    box: "border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  },
  OUTAGE: {
    label: "Unavailable",
    icon: FiXCircle,
    box: "border-red-200 bg-red-50 text-red-800",
    dot: "bg-red-500",
  },
  NOT_CONFIGURED: {
    label: "Not configured",
    icon: FiAlertTriangle,
    box: "border-slate-300 bg-slate-50 text-slate-700",
    dot: "bg-slate-400",
  },
};

const INTEGRATION_ICONS = {
  runtime: FiServer,
  database: FiDatabase,
  redis: FiZap,
  cloudinary: FiCloud,
  whatsapp: FiMessageCircle,
  cashfree: FiCreditCard,
  email: FiMail,
  firebase: FiShield,
  "web-push": FiSmartphone,
  "background-jobs": FiActivity,
};

const DETAIL_LABELS = {
  environment: "Environment",
  release: "Release",
  nodeVersion: "Node version",
  uptimeSeconds: "Uptime",
  memoryUsedMb: "Memory used",
  processId: "Process ID",
  engine: "Database",
  orm: "ORM",
  connectionState: "Connection",
  cloudName: "Cloud name",
  providerStatus: "Provider status",
  provider: "Provider",
  verifiedName: "Verified name",
  displayPhoneNumber: "Phone number",
  qualityRating: "Quality rating",
  webhookVerificationConfigured: "Webhook verification",
  graphVersion: "Graph version",
  mode: "Mode",
  paidLast24Hours: "Paid in 24 hours",
  failedLast24Hours: "Failed in 24 hours",
  createdLast24Hours: "Created in 24 hours",
  lastOrderCheckedAt: "Latest local order",
  recentOrderStatus: "Latest provider status",
  deliveryMode: "OTP delivery",
  senderDomain: "Sender domain",
  senderDomainStatus: "Domain status",
  verifiedDomains: "Verified domains",
  pendingEmails: "Pending emails",
  processingEmails: "Processing emails",
  failedEmails: "Failed emails",
  latestSentAt: "Last email sent",
  latestFailure: "Latest failure",
  projectId: "Firebase project",
  activeSubscriptions: "Push subscriptions",
  customerSubscriptions: "Customer subscriptions",
  garageSubscriptions: "Garage subscriptions",
  supportSubscriptions: "Support subscriptions",
  overduePriceSchedules: "Overdue price schedules",
  httpStatus: "HTTP status",
};

const CATEGORY_ORDER = [
  "Core platform",
  "Authentication",
  "Customer communications",
  "Payments",
  "Media and storage",
  "Operations",
];

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const formatDuration = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total)) return "—";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDetailValue = (key, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "uptimeSeconds") return formatDuration(value);
  if (key === "memoryUsedMb") return `${value} MB`;
  if (key.endsWith("At")) return formatDateTime(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (value.message) {
      return `${value.message}${value.at ? ` · ${formatDateTime(value.at)}` : ""}`;
    }
    return JSON.stringify(value);
  }
  return String(value).replaceAll("_", " ");
};

function StatusBlock({ status, compact = false }) {
  const meta = STATUS_META[status] || STATUS_META.DEGRADED;
  const Icon = meta.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 border-l-4 px-3 font-bold ${
        compact ? "h-9 text-xs" : "h-11 text-sm"
      } ${meta.box}`}
    >
      <Icon className="shrink-0" />
      {meta.label}
    </div>
  );
}

function SummaryCard({ label, value, hint, icon: Icon }) {
  return (
    <article className="border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{value ?? 0}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        <div className="grid h-10 w-10 place-items-center border border-line bg-bg-soft text-lg text-ink">
          <Icon />
        </div>
      </div>
    </article>
  );
}

function IntegrationCard({ integration }) {
  const Icon = INTEGRATION_ICONS[integration.key] || FiWifi;
  const meta = STATUS_META[integration.status] || STATUS_META.DEGRADED;
  const details = Object.entries(integration.details || {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <article className="border border-line bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center border border-line bg-bg-soft text-xl text-ink">
            <Icon />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-ink">{integration.name}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{integration.message}</p>
          </div>
        </div>
        <StatusBlock status={integration.status} compact />
      </div>

      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-line bg-bg-soft px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Response time
            </p>
            <p className="mt-1 text-sm font-bold text-ink">
              {integration.latencyMs === null ? "Not tested" : `${integration.latencyMs} ms`}
            </p>
          </div>
          <div className="border border-line bg-bg-soft px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Last checked
            </p>
            <p className="mt-1 text-sm font-bold text-ink">
              {formatDateTime(integration.checkedAt)}
            </p>
          </div>
        </div>

        {details.length > 0 && (
          <dl className="mt-4 divide-y divide-line border border-line">
            {details.map(([key, value]) => (
              <div
                key={key}
                className="grid gap-1 px-3 py-2.5 text-sm sm:grid-cols-[170px_1fr] sm:gap-3"
              >
                <dt className="font-semibold text-muted">
                  {DETAIL_LABELS[key] || key.replace(/([A-Z])/g, " $1")}
                </dt>
                <dd className="break-words font-bold text-ink">
                  {formatDetailValue(key, value)}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {integration.status === "OUTAGE" && (
          <div className={`mt-4 border px-3 py-2.5 text-xs font-semibold ${meta.box}`}>
            Verify the related backend environment variables and provider dashboard, then run the checks again.
          </div>
        )}
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-64 animate-pulse border border-line bg-white" />
      ))}
    </div>
  );
}

export default function IntegrationHealth() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadReport = useCallback(async ({ force = false, initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const data = await adminApi.getIntegrationHealth(force ? { force: true } : {});
      setReport(data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to load integration health",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReport({ initial: true });
  }, [loadReport]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void loadReport();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadReport]);

  const groupedIntegrations = useMemo(() => {
    const groups = new Map();
    (report?.integrations || []).forEach((integration) => {
      const category = integration.category || "Other";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(integration);
    });

    return [...groups.entries()].sort(([left], [right]) => {
      const leftIndex = CATEGORY_ORDER.indexOf(left);
      const rightIndex = CATEGORY_ORDER.indexOf(right);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    });
  }, [report]);

  const overallMeta = STATUS_META[report?.overallStatus] || STATUS_META.DEGRADED;

  return (
    <div className="space-y-6 pb-10">
      <header className="border border-line bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
              Platform Operations
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-ink">
              Integration Health Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Read-only checks for Rovauto infrastructure and external providers. These probes do not send messages, create payments or upload files.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex h-11 items-center gap-2 border border-line bg-white px-3 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="h-4 w-4"
              />
              Auto-refresh every 60s
            </label>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => loadReport({ force: true })}
              className="inline-flex h-11 items-center justify-center gap-2 border border-ink bg-ink px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Checking..." : "Run all checks"}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : report ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
            <article className={`border p-5 ${overallMeta.box}`}>
              <p className="text-xs font-bold uppercase tracking-[0.18em]">
                Overall platform status
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className={`h-4 w-4 ${overallMeta.dot}`} />
                <p className="text-2xl font-extrabold">{overallMeta.label}</p>
              </div>
              <p className="mt-3 text-sm font-semibold opacity-80">
                Checked {formatDateTime(report.checkedAt)}
                {report.cached ? " · cached result" : " · live result"}
              </p>
            </article>

            <SummaryCard
              label="Operational"
              value={report.summary?.OPERATIONAL}
              hint="Passed live checks"
              icon={FiCheckCircle}
            />
            <SummaryCard
              label="Attention"
              value={report.summary?.DEGRADED}
              hint="Partial or queued issue"
              icon={FiAlertTriangle}
            />
            <SummaryCard
              label="Unavailable"
              value={report.summary?.OUTAGE}
              hint="Provider check failed"
              icon={FiXCircle}
            />
            <SummaryCard
              label="Not configured"
              value={report.summary?.NOT_CONFIGURED}
              hint="Missing environment setup"
              icon={FiHardDrive}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Open system issues"
              value={report.incidents?.open}
              hint={`${report.incidents?.criticalOpen || 0} critical`}
              icon={FiAlertTriangle}
            />
            <SummaryCard
              label="Issues in 24 hours"
              value={report.incidents?.last24Hours}
              hint="Unique issue records seen"
              icon={FiClock}
            />
            <SummaryCard
              label="Health probes"
              value={report.summary?.total}
              hint={`${report.cacheSeconds || 30}s server cache`}
              icon={FiActivity}
            />
          </section>

          {!report.metricsAvailable && report.metricsError && (
            <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Operational counters could not be loaded: {report.metricsError}
            </div>
          )}

          {groupedIntegrations.map(([category, integrations]) => (
            <section key={category} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-ink">{category}</h2>
                <span className="border border-line bg-white px-2.5 py-1 text-xs font-bold text-muted">
                  {integrations.length} checks
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {integrations.map((integration) => (
                  <IntegrationCard key={integration.key} integration={integration} />
                ))}
              </div>
            </section>
          ))}

          <section className="border border-line bg-white shadow-sm">
            <div className="border-b border-line p-4 sm:p-5">
              <h2 className="text-xl font-extrabold text-ink">Recent open incidents</h2>
              <p className="mt-1 text-sm text-muted">
                Latest unresolved errors already captured by Rovauto system-issue reporting.
              </p>
            </div>

            {(report.incidents?.recent || []).length ? (
              <div className="divide-y divide-line">
                {report.incidents.recent.map((issue) => (
                  <article
                    key={issue.id}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`border-l-4 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            issue.severity === "CRITICAL"
                              ? "border-red-500 bg-red-50 text-red-800"
                              : issue.severity === "WARNING"
                                ? "border-amber-500 bg-amber-50 text-amber-900"
                                : "border-blue-500 bg-blue-50 text-blue-800"
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <span className="text-xs font-bold text-muted">
                          {issue.occurrenceCount} occurrence{issue.occurrenceCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate font-extrabold text-ink">{issue.title}</h3>
                      <p className="mt-1 truncate text-sm text-muted">
                        {issue.route || "Route unavailable"}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-muted">
                      Last seen {formatDateTime(issue.lastSeenAt)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FiCheckCircle className="mx-auto text-3xl text-green-600" />
                <p className="mt-3 font-bold text-ink">No open incidents</p>
                <p className="mt-1 text-sm text-muted">
                  No unresolved system issues are currently recorded.
                </p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
