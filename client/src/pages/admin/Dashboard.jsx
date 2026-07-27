import { Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiHome,
  FiMessageSquare,
  FiRefreshCw,
  FiTool,
  FiUsers,
} from "react-icons/fi";
import { adminApi } from "@/api/admin";
import AdminPwaInstall from "@/components/staff/AdminPwaInstall";
import InternPwaInstall from "@/components/staff/InternPwaInstall";

const formatDate = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

const formatDateTime = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const formatStatus = (status) => status?.replaceAll("_", " ") || "-";

const getStatusClass = (status) => {
  if (["COMPLETED", "CONFIRMED"].includes(status)) return "bg-lime-100 text-ink";
  if (["CANCELLED", "EXPIRED"].includes(status)) return "bg-red-50 text-red-700";
  if (["IN_PROGRESS", "GARAGE_ASSIGNED"].includes(status)) return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-800";
};

export default function AdminDashboard() {
  const { pathname } = useLocation();
  const isInternPortal = pathname.startsWith("/intern");
  const portalRoot = isInternPortal ? "/intern" : "/admin";
  const PortalPwaInstall = isInternPortal ? InternPwaInstall : AdminPwaInstall;
  const [stats, setStats] = useState({});
  const [operations, setOperations] = useState({ stats: {}, recentBookings: [], statusCounts: {} });
  const [recentApplications, setRecentApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, liveOperations] = await Promise.all([
        adminApi.getStats(),
        adminApi.getOperations(),
      ]);
      setStats(dashboard.stats || {});
      setRecentApplications(dashboard.recentApplications || []);
      setOperations(liveOperations || { stats: {}, recentBookings: [], statusCounts: {} });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load staff dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [load]);

  const operationCards = [
    {
      icon: FiActivity,
      value: operations.stats?.activeBookings || 0,
      label: "Active bookings",
      caption: "Assigned, confirmed or in service",
      tone: "bg-blue-50 text-blue-700",
    },
    {
      icon: FiClock,
      value: operations.stats?.pendingGarageResponses || 0,
      label: "Awaiting garage",
      caption: "Searching for an accepting garage",
      tone: "bg-amber-50 text-amber-800",
    },
    {
      icon: FiTool,
      value: operations.stats?.vehiclesInService || 0,
      label: "Vehicles in service",
      caption: "Currently marked in progress",
      tone: "bg-lime-100 text-ink",
    },
    {
      icon: FiAlertTriangle,
      value: operations.stats?.delayedBookings || 0,
      label: "Needs attention",
      caption: "Stale search or overdue schedule",
      tone: "bg-red-50 text-red-700",
    },
    {
      icon: FiCheckCircle,
      value: operations.stats?.completedToday || 0,
      label: "Completed today",
      caption: "Finished since midnight",
      tone: "bg-lime-100 text-ink",
    },
    {
      icon: FiCreditCard,
      value: operations.stats?.failedPayments || 0,
      label: "Failed payments",
      caption: `${operations.stats?.pendingPayments || 0} payment(s) still pending`,
      tone: "bg-red-50 text-red-700",
    },
    {
      icon: FiAlertCircle,
      value: operations.stats?.unresolvedComplaints || 0,
      label: "Open complaints",
      caption: "Customer cases awaiting resolution",
      tone: "bg-amber-50 text-amber-800",
    },
    {
      icon: FiMessageSquare,
      value: operations.stats?.openSupportTickets || 0,
      label: "Support tickets",
      caption: "Open support requests and disputes",
      tone: "bg-violet-50 text-violet-700",
      to: `${portalRoot}/support-tickets`,
    },
    {
      icon: FiAlertTriangle,
      value: stats.openSystemIssues || 0,
      label: "System issues",
      caption: `${stats.criticalSystemIssues || 0} critical issue(s)`,
      tone: "bg-red-50 text-red-700",
      to: isInternPortal
        ? "/intern/system-issues"
        : "/admin/system-health?view=issues",
    },
  ];

  const financialCards = [
    {
      icon: FiUsers,
      value: formatCurrency(stats.customerPlatformFeeRevenue),
      label: "Income from customers",
      caption: "Customer platform fees received",
      tone: "bg-blue-50 text-blue-700",
    },
    {
      icon: FiHome,
      value: formatCurrency(stats.garagePlatformFeeRevenue),
      label: "Income from garages",
      caption: "Garage acceptance fees received",
      tone: "bg-amber-50 text-amber-800",
    },
    {
      icon: FiTool,
      value: formatCurrency(stats.totalServiceCost),
      label: "Total service cost",
      caption: "Completed service value, excluding both platform fees",
      tone: "bg-lime-100 text-ink",
    },
  ];

  const businessCards = [
    { icon: FiHome, value: stats.activeGarages || 0, label: "Active garages" },
    { icon: FiUsers, value: stats.customers || 0, label: "Customers" },
    { icon: FiCalendar, value: stats.bookings || 0, label: "All bookings" },
  ];

  const totalStatusCount = useMemo(
    () => Object.values(operations.statusCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0),
    [operations.statusCounts],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 overflow-x-hidden sm:space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Live operations</p>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-ink">
            {isInternPortal ? "Intern dashboard" : "Admin dashboard"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Current booking activity, payment problems and daily platform performance.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <PortalPwaInstall compact />

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">What needs attention now</h3>
            <p className="text-sm text-muted">Automatically refreshes every minute.</p>
          </div>
          <Link to={`${portalRoot}/bookings`} className="text-sm font-bold text-ink hover:underline">
            Manage bookings →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {operationCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                to={card.to || `${portalRoot}/bookings`}
                className="min-w-0 rounded-xl border border-line bg-white p-3 shadow-sm transition-colors hover:border-ink/20 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-bg-soft text-ink sm:h-10 sm:w-10">
                    <Icon />
                  </span>
                  <span className="truncate text-2xl font-bold text-ink sm:text-3xl">{card.value}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-ink sm:text-base">{card.label}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted sm:text-xs">{card.caption}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h3 className="font-bold text-ink">Recent active bookings</h3>
              <p className="mt-0.5 text-xs text-muted">Most recently updated operational jobs.</p>
            </div>
            <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-muted">
              {operations.recentBookings?.length || 0}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {['Booking', 'Customer', 'Garage', 'Status', 'Updated'].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operations.recentBookings?.length ? operations.recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-line hover:bg-bg-soft/70">
                    <td className="px-4 py-3 font-bold text-ink">#{booking.bookingCode}</td>
                    <td className="px-4 py-3 text-muted">{booking.user?.name || '-'}</td>
                    <td className="px-4 py-3 text-muted">{booking.garage?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClass(booking.status)}`}>
                        {formatStatus(booking.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(booking.updatedAt)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-muted">No active bookings right now.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <h3 className="font-bold text-ink">Booking status mix</h3>
          <p className="mt-1 text-xs text-muted">All {totalStatusCount} bookings by current status.</p>
          <div className="mt-4 grid gap-3">
            {Object.entries(operations.statusCounts || {})
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([status, count]) => {
                const width = totalStatusCount ? Math.max(4, (Number(count) / totalStatusCount) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-muted">{formatStatus(status)}</span>
                      <span className="font-bold text-ink">{count}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-soft">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3">
          <h3 className="text-lg font-bold text-ink">Financial overview</h3>
          <p className="mt-1 text-sm text-muted">Platform fee income and completed service value.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {financialCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
                    <Icon />
                  </span>
                  <span className="text-right text-2xl font-bold text-ink sm:text-3xl">{card.value}</span>
                </div>
                <p className="mt-4 font-bold text-ink">{card.label}</p>
                <p className="mt-1 text-xs text-muted">{card.caption}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-ink">Business overview</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {businessCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-bg-soft text-ink"><Icon /></span>
                  <span className="text-2xl font-bold text-ink">{card.value}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-muted">{card.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h3 className="text-lg font-bold text-ink">Recent garage applications</h3>
            <p className="mt-1 text-sm text-muted">Pending garage owners waiting for review.</p>
          </div>
          <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-muted">{recentApplications.length}</span>
        </div>

        {recentApplications.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                <tr>{["Garage", "Owner", "City", "Phone", "Created"].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {recentApplications.map((application) => (
                  <tr key={application.id} className="border-t border-line hover:bg-bg-soft/70">
                    <td className="px-4 py-3 font-semibold text-ink">{application.garageName || "-"}</td>
                    <td className="px-4 py-3 text-muted">{application.ownerName || "-"}</td>
                    <td className="px-4 py-3 text-muted">{application.city || "-"}</td>
                    <td className="px-4 py-3 text-muted">{application.phone || "-"}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(application.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted">Nothing waiting for approval.</div>
        )}
      </section>
    </div>
  );
}
