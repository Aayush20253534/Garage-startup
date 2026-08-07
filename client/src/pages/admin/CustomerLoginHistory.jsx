import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
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
  if (status === "ACTIVE") {
    return "bg-lime-100 text-ink";
  }
  if (status === "REVOKED") {
    return "bg-red-50 text-red-700";
  }
  return "bg-bg-soft text-muted";
};

const sessionLabel = (status) => {
  if (status === "ACTIVE") return "Active";
  if (status === "REVOKED") return "Logged out";
  return "Expired";
};

export default function CustomerLoginHistory() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const customersPath = isIntern ? "/intern/customers" : "/admin/customers";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi.getCustomerLoginHistory(userId));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load customer login history",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeDevices = useMemo(() => data?.activeDevices || [], [data]);
  const sessions = useMemo(() => data?.sessions || [], [data]);
  const summary = data?.summary || {};
  const customer = data?.customer;

  const logoutAll = async () => {
    if (isIntern || loggingOut || !customer?.id) return;

    const confirmed = window.confirm(
      `Log ${customer.name || customer.email || "this customer"} out from every currently active device?`,
    );
    if (!confirmed) return;

    setLoggingOut(true);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.logoutCustomerFromAllDevices(customer.id);
      const count = Number(result?.revokedSessionCount || 0);
      setSuccess(
        count
          ? `${count} active ${count === 1 ? "session was" : "sessions were"} logged out successfully.`
          : "No active customer sessions were found.",
      );
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to log customer out from all devices",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(customersPath)}
            className="inline-flex items-center gap-2 text-sm font-bold text-muted transition hover:text-ink"
          >
            <FiArrowLeft />
            Back to customers
          </button>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Customer security
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">
            Login history
          </h1>
          {customer && (
            <p className="mt-2 break-words text-sm text-muted">
              <span className="font-bold text-ink">{customer.name || "Customer"}</span>
              {customer.email ? ` · ${customer.email}` : ""}
              {customer.phone ? ` · ${customer.phone}` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          {!isIntern && (
            <button
              type="button"
              onClick={logoutAll}
              disabled={loggingOut || !summary.activeSessionCount}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiLogOut />
              {loggingOut ? "Logging out..." : "Log out from all devices"}
            </button>
          )}
        </div>
      </div>

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

      {loading && !data ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
          Loading login history...
        </div>
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [summary.activeDeviceCount || 0, "Logged-in devices"],
              [summary.activeSessionCount || 0, "Active sessions"],
              [summary.knownDeviceCount || 0, "Known devices"],
              [summary.totalSessionCount || 0, "Recorded sessions"],
            ].map(([value, label]) => (
              <article key={label} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
                <p className="text-2xl font-extrabold text-ink sm:text-3xl">{value}</p>
                <p className="mt-1 text-xs font-semibold text-muted sm:text-sm">{label}</p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-line bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FiShield className="text-lg text-brand-dark" />
                  <h2 className="text-lg font-extrabold text-ink sm:text-xl">
                    Currently logged devices
                  </h2>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Devices with at least one active authenticated customer session.
                </p>
              </div>
              {isIntern && (
                <span className="rounded-full border border-line bg-bg-soft px-3 py-1 text-xs font-bold text-muted">
                  Read only
                </span>
              )}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {activeDevices.length ? (
                activeDevices.map((device) => {
                  const parsed = parseDevice(device.userAgent);
                  const Icon = parsed.isMobile ? FiSmartphone : FiMonitor;
                  return (
                    <article key={device.key} className="rounded-2xl border border-line bg-bg-soft p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-lg text-ink shadow-sm">
                          <Icon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-extrabold text-ink">
                              {parsed.browser} on {parsed.platform}
                            </p>
                            <span className="rounded-full bg-lime-100 px-2.5 py-1 text-xs font-bold text-ink">
                              Logged in
                            </span>
                          </div>
                          <p className="mt-2 break-all text-xs leading-5 text-muted">
                            {device.userAgent || "User agent unavailable"}
                          </p>
                          <div className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-2">
                            <span>Last seen: {formatDateTime(device.lastSeenAt)}</span>
                            <span>Login sessions: {device.sessionCount || 1}</span>
                            <span>First login: {formatDateTime(device.firstLoginAt)}</span>
                            <span>Expires: {formatDateTime(device.expiresAt)}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="lg:col-span-2 rounded-2xl border border-dashed border-line bg-bg-soft p-8 text-center text-sm text-muted">
                  No devices are currently logged in.
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="border-b border-line px-4 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <FiClock className="text-lg text-brand-dark" />
                <h2 className="text-lg font-extrabold text-ink sm:text-xl">Session history</h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                All retained login sessions across every recorded browser or device.
              </p>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {[
                      "Device",
                      "Status",
                      "Logged in",
                      "Last seen",
                      "Expires",
                      "Session",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.length ? (
                    sessions.map((session) => {
                      const parsed = parseDevice(session.userAgent);
                      return (
                        <tr key={session.id} className="border-t border-line align-top">
                          <td className="px-4 py-4">
                            <p className="font-bold text-ink">{parsed.browser} on {parsed.platform}</p>
                            <p className="mt-1 max-w-sm truncate text-xs text-muted" title={session.userAgent || ""}>
                              {session.userAgent || "User agent unavailable"}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${sessionBadge(session.status)}`}>
                              {sessionLabel(session.status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDateTime(session.createdAt)}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDateTime(session.lastSeenAt)}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDateTime(session.expiresAt)}</td>
                          <td className="px-4 py-4 font-mono text-xs text-muted">{session.id.slice(0, 8)}…</td>
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

            <div className="grid gap-3 p-4 md:hidden">
              {sessions.length ? (
                sessions.map((session) => {
                  const parsed = parseDevice(session.userAgent);
                  const Icon = parsed.isMobile ? FiSmartphone : FiMonitor;
                  return (
                    <article key={session.id} className="rounded-xl border border-line bg-bg-soft p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-ink"><Icon /></span>
                          <div className="min-w-0">
                            <p className="font-bold text-ink">{parsed.browser} on {parsed.platform}</p>
                            <p className="mt-1 break-all text-[11px] leading-4 text-muted">{session.userAgent || "User agent unavailable"}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${sessionBadge(session.status)}`}>
                          {sessionLabel(session.status)}
                        </span>
                      </div>
                      <dl className="mt-3 grid gap-1 text-xs text-muted">
                        <div className="flex justify-between gap-3"><dt>Logged in</dt><dd className="text-right">{formatDateTime(session.createdAt)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Last seen</dt><dd className="text-right">{formatDateTime(session.lastSeenAt)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Expires</dt><dd className="text-right">{formatDateTime(session.expiresAt)}</dd></div>
                      </dl>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl bg-bg-soft p-8 text-center text-sm text-muted">No recorded sessions.</div>
              )}
            </div>
          </section>

          <p className="px-1 text-xs leading-5 text-muted">
            Session history follows the server retention policy, so sufficiently old expired or revoked sessions may be cleaned automatically.
          </p>
        </>
      ) : null}
    </div>
  );
}
