import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCalendar,
  FiDollarSign,
  FiHome,
  FiUsers,
} from "react-icons/fi";
import { adminApi } from "@/api/admin";

const formatDate = (date) => {
  if (!date) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

export default function AdminDashboard() {
  const { pathname } = useLocation();
  const portalRoot = pathname.startsWith("/intern") ? "/intern" : "/admin";
  const [stats, setStats] = useState({
    garages: 0,
    activeGarages: 0,
    pendingApplications: 0,
    priceRanges: 0,
    customers: 0,
    bookings: 0,
    openSystemIssues: 0,
    criticalSystemIssues: 0,
  });

  const [recentApplications, setRecentApplications] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");

      try {
        const dashboard = await adminApi.getStats();

        setStats((current) => ({
          ...current,
          ...(dashboard.stats || {}),
        }));

        setRecentApplications(dashboard.recentApplications || []);
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to load staff dashboard"
        );
      }
    };

    load();
  }, []);

  const cards = [
    {
      icon: FiHome,
      number: stats.garages,
      label: "Total Garages",
      caption: `${stats.activeGarages} active`,
    },
    {
      icon: FiHome,
      number: stats.activeGarages,
      label: "Active Garages",
      caption: "Approved garages",
    },
    {
      icon: FiCalendar,
      number: stats.bookings,
      label: "Bookings",
      caption: "Total bookings",
    },
    {
      icon: FiUsers,
      number: stats.customers,
      label: "Customers",
      caption: "Registered users",
    },
    {
      icon: FiDollarSign,
      number: stats.priceRanges,
      label: "Price Ranges",
      caption: "Configured ranges",
    },
    {
      icon: FiCalendar,
      number: stats.pendingApplications,
      label: "Pending Applications",
      caption: "Needs review",
    },
    {
      icon: FiAlertTriangle,
      number: stats.openSystemIssues,
      label: "System Issues",
      caption: `${stats.criticalSystemIssues || 0} critical`,
      to: `${portalRoot}/system-issues`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Dashboard</h2>
          <p className="mt-1 text-sm text-muted">
            Overview of Rovauto platform activity.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-muted">
          {new Date().toLocaleDateString()}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${
                    card.to
                      ? "bg-red-50 text-red-700"
                      : "bg-lime-100 text-ink"
                  }`}
                >
                  <Icon />
                </div>

                <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-semibold text-muted">
                  {card.caption}
                </span>
              </div>

              <div className="mt-4 text-3xl font-bold text-ink">
                {card.number}
              </div>

              <p className="mt-1 text-sm text-muted">{card.label}</p>
            </>
          );

          return card.to ? (
            <Link
              key={card.label}
              to={card.to}
              className="card-soft rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {content}
            </Link>
          ) : (
            <div
              key={card.label}
              className="card-soft rounded-2xl p-4 shadow-sm transition hover:shadow-md"
            >
              {content}
            </div>
          );
        })}
      </div>

      <section className="card-soft overflow-hidden rounded-2xl shadow-sm">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h3 className="text-lg font-bold text-ink">
              Recent Garage Applications
            </h3>
            <p className="mt-1 text-sm text-muted">
              Pending garage owners waiting for review.
            </p>
          </div>

          <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-ink">
            {recentApplications.length}
          </span>
        </div>

        {recentApplications.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {["Garage", "Owner", "City", "Phone", "Created"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-4 py-3 font-bold"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {recentApplications.map((application) => (
                  <tr
                    key={application.id}
                    className="border-t border-line transition hover:bg-bg-soft/70"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                      {application.garageName || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {application.ownerName || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {application.city || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {application.phone || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatDate(application.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-soft text-xl text-muted">
              <FiHome />
            </div>

            <h4 className="font-semibold text-ink">
              Nothing waiting for approval
            </h4>

            <p className="mt-1 text-sm text-muted">
              New garage applications will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}