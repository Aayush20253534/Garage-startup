import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import { queryKeys } from "@/lib/query/queryKeys";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiLogOut,
  FiMonitor,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
} from "react-icons/fi";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

const parseDevice = (userAgent = "") => {
  const value = String(userAgent || "");
  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /Chrome\//i.test(value)
      ? "Chrome"
      : /Firefox\//i.test(value)
        ? "Firefox"
        : /Safari\//i.test(value)
          ? "Safari"
          : "Browser";
  const platform = /Android/i.test(value)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(value)
      ? "iPhone/iPad"
      : /Windows/i.test(value)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown device";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(value);
  return { browser, platform, isMobile };
};

const sessionBadge = (status) => {
  if (status === "ACTIVE") return "border-green-200 bg-green-50 text-green-700";
  if (status === "REVOKED") return "border-red-200 bg-red-50 text-red-700";
  return "border-line bg-bg-soft text-muted";
};

const sessionLabel = (status) => {
  if (status === "ACTIVE") return "Active";
  if (status === "REVOKED") return "Logged out";
  return "Expired";
};

function StatCard({ value, label }) {
  return (
    <article className="min-w-0 rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
      <p className="text-2xl font-black leading-none text-ink">{value}</p>
      <p className="mt-1.5 truncate text-xs font-semibold text-muted">{label}</p>
    </article>
  );
}

export default function CustomerLoginHistory() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const customersPath = isIntern ? "/intern/customers" : "/admin/customers";
  const [success, setSuccess] = useState("");

  const historyQuery = useQuery({
    queryKey: queryKeys.admin.customerLoginHistory(userId),
    queryFn: () => adminApi.getCustomerLoginHistory(userId),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => adminApi.logoutCustomerFromAllDevices(userId),
    onSuccess: async (result) => {
      const count = Number(result?.revokedSessionCount || 0);
      setSuccess(
        count
          ? `${count} active ${count === 1 ? "session was" : "sessions were"} logged out successfully.`
          : "No active customer sessions were found.",
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.customerLoginHistory(userId),
      });
    },
  });

  const data = historyQuery.data;
  const activeDevices = useMemo(() => data?.activeDevices || [], [data]);
  const sessions = useMemo(() => data?.sessions || [], [data]);
  const summary = data?.summary || {};
  const customer = data?.customer;
  const error =
    historyQuery.error?.response?.data?.message ||
    historyQuery.error?.message ||
    logoutAllMutation.error?.response?.data?.message ||
    logoutAllMutation.error?.message ||
    "";

  const logoutAll = () => {
    if (isIntern || logoutAllMutation.isPending || !customer?.id) return;
    const confirmed = window.confirm(
      `Log ${customer.name || customer.email || "this customer"} out from every currently active device?`,
    );
    if (!confirmed) return;
    setSuccess("");
    logoutAllMutation.mutate();
  };

  return (
    <div className="admin-page space-y-4 pb-8">
      <section className="admin-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(customersPath)}
              className="inline-flex items-center gap-2 text-xs font-bold text-muted transition hover:text-ink"
            >
              <FiArrowLeft /> Back to customers
            </button>
            <div className="mt-3 flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-white">
                <FiShield />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">
                  Customer security
                </p>
                <h1 className="mt-0.5 text-2xl font-black tracking-tight text-ink">
                  Login history
                </h1>
                {customer && (
                  <p className="mt-1 break-words text-sm text-muted">
                    <span className="font-bold text-ink">{customer.name || "Customer"}</span>
                    {customer.email ? ` · ${customer.email}` : ""}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <button
              type="button"
              onClick={() => historyQuery.refetch()}
              disabled={historyQuery.isFetching}
              className="admin-btn-secondary"
            >
              <FiRefreshCw className={historyQuery.isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
            {!isIntern && (
              <button
                type="button"
                onClick={logoutAll}
                disabled={logoutAllMutation.isPending || !summary.activeSessionCount}
                className="admin-btn-danger"
              >
                <FiLogOut />
                {logoutAllMutation.isPending ? "Logging out..." : "Log out all devices"}
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          <FiCheckCircle className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {historyQuery.isLoading ? (
        <div className="admin-panel p-8 text-center text-sm text-muted">
          Loading login history...
        </div>
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard value={summary.activeDeviceCount || 0} label="Logged-in devices" />
            <StatCard value={summary.activeSessionCount || 0} label="Active sessions" />
            <StatCard value={summary.knownDeviceCount || 0} label="Known devices" />
            <StatCard value={summary.totalSessionCount || 0} label="Recorded sessions" />
          </section>

          <section className="admin-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FiShield className="text-brand-dark" />
                  <h2 className="text-base font-black text-ink">Currently logged devices</h2>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Devices with at least one active authenticated customer session.
                </p>
              </div>
              {isIntern && (
                <span className="rounded-full border border-line bg-bg-soft px-2.5 py-1 text-[11px] font-bold text-muted">
                  Read only
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 2xl:grid-cols-2">
              {activeDevices.length ? (
                activeDevices.map((device) => {
                  const parsed = parseDevice(device.userAgent);
                  const Icon = parsed.isMobile ? FiSmartphone : FiMonitor;
                  return (
                    <article key={device.key} className="min-w-0 rounded-xl border border-line bg-bg-soft/70 p-3.5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink">
                          <Icon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="truncate text-sm font-black text-ink">
                              {parsed.browser} on {parsed.platform}
                            </p>
                            <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-black uppercase text-green-700">
                              Logged in
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 break-all text-[11px] leading-4 text-muted" title={device.userAgent || ""}>
                            {device.userAgent || "User agent unavailable"}
                          </p>
                          <dl className="mt-3 grid gap-x-4 gap-y-1 text-[11px] text-muted sm:grid-cols-2">
                            <div><dt className="inline font-semibold text-ink/70">Last seen: </dt><dd className="inline">{formatDateTime(device.lastSeenAt)}</dd></div>
                            <div><dt className="inline font-semibold text-ink/70">Sessions: </dt><dd className="inline">{device.sessionCount || 1}</dd></div>
                            <div><dt className="inline font-semibold text-ink/70">First login: </dt><dd className="inline">{formatDateTime(device.firstLoginAt)}</dd></div>
                            <div><dt className="inline font-semibold text-ink/70">Expires: </dt><dd className="inline">{formatDateTime(device.expiresAt)}</dd></div>
                          </dl>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="2xl:col-span-2 rounded-xl border border-dashed border-line bg-bg-soft p-6 text-center text-sm text-muted">
                  No devices are currently logged in.
                </div>
              )}
            </div>
          </section>

          <section className="admin-panel overflow-hidden">
            <div className="border-b border-line px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <FiClock className="text-brand-dark" />
                <h2 className="text-base font-black text-ink">Session history</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                Retained sessions across recorded browsers and devices.
              </p>
            </div>

            <div className="hidden max-w-full overflow-x-auto lg:block">
              <table className="w-full min-w-[850px] table-fixed text-left text-xs">
                <thead className="bg-bg-soft text-[10px] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="w-[30%] px-4 py-2.5">Device</th>
                    <th className="w-[12%] px-4 py-2.5">Status</th>
                    <th className="w-[16%] px-4 py-2.5">Logged in</th>
                    <th className="w-[16%] px-4 py-2.5">Last seen</th>
                    <th className="w-[16%] px-4 py-2.5">Expires</th>
                    <th className="w-[10%] px-4 py-2.5">Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sessions.length ? (
                    sessions.map((session) => {
                      const parsed = parseDevice(session.userAgent);
                      return (
                        <tr key={session.id} className="align-top hover:bg-bg-soft/50">
                          <td className="px-4 py-3">
                            <p className="font-bold text-ink">{parsed.browser} on {parsed.platform}</p>
                            <p className="mt-1 truncate text-[11px] text-muted" title={session.userAgent || ""}>
                              {session.userAgent || "User agent unavailable"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${sessionBadge(session.status)}`}>
                              {sessionLabel(session.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{formatDateTime(session.createdAt)}</td>
                          <td className="px-4 py-3 text-muted">{formatDateTime(session.lastSeenAt)}</td>
                          <td className="px-4 py-3 text-muted">{formatDateTime(session.expiresAt)}</td>
                          <td className="px-4 py-3 font-mono text-[10px] text-muted">{session.id.slice(0, 8)}…</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-muted">No recorded sessions.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2.5 p-3 lg:hidden">
              {sessions.length ? (
                sessions.map((session) => {
                  const parsed = parseDevice(session.userAgent);
                  const Icon = parsed.isMobile ? FiSmartphone : FiMonitor;
                  return (
                    <article key={session.id} className="min-w-0 rounded-xl border border-line bg-bg-soft/70 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-ink"><Icon /></span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">{parsed.browser} on {parsed.platform}</p>
                            <p className="mt-1 line-clamp-2 break-all text-[10px] leading-4 text-muted">{session.userAgent || "User agent unavailable"}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sessionBadge(session.status)}`}>
                          {sessionLabel(session.status)}
                        </span>
                      </div>
                      <dl className="mt-3 grid gap-1 text-[11px] text-muted">
                        <div className="flex justify-between gap-3"><dt>Logged in</dt><dd className="text-right">{formatDateTime(session.createdAt)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Last seen</dt><dd className="text-right">{formatDateTime(session.lastSeenAt)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Expires</dt><dd className="text-right">{formatDateTime(session.expiresAt)}</dd></div>
                      </dl>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl bg-bg-soft p-6 text-center text-sm text-muted">No recorded sessions.</div>
              )}
            </div>
          </section>

          <p className="px-1 text-[11px] leading-5 text-muted">
            Session history follows the server retention policy, so sufficiently old expired or revoked sessions may be cleaned automatically.
          </p>
        </>
      ) : null}
    </div>
  );
}
