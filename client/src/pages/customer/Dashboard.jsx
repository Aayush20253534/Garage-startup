import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import { formatRupees } from "@/utils/priceRange";
import CustomerPwaInstall from "@/components/pwa/CustomerPwaInstall";
import {
  fetchRecentActivities,
  getRecentActivities,
} from "@/utils/activityLog";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiPlusCircle,
  FiRefreshCcw,
  FiTruck,
  FiCreditCard,
  FiAlertCircle,
} from "react-icons/fi";

const activeStatuses = [
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const getProgress = (status) => {
  if (status === "SEARCHING_GARAGE") return "40%";
  if (status === "GARAGE_ASSIGNED") return "55%";
  if (status === "CONFIRMED") return "65%";
  if (status === "IN_PROGRESS") return "80%";
  return "100%";
};

function Dashboard() {
  const {
    user,
    vehicle,
    vehicles,
    setVehicle,
    setVehicles,
    fetchDashboard,
    fetchVehicles,
    dashboardCache,
  } = useApp();

  const [bookings, setBookings] = useState(
    () => dashboardCache?.activeBookings || []
  );

  const [activeBookingsCount, setActiveBookingsCount] = useState(
    () =>
      dashboardCache?.activeBookingsCount ??
      dashboardCache?.activeBookings?.length ??
      0
  );

  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [wallet, setWallet] = useState(() => dashboardCache?.wallet || null);
  const [completedCount, setCompletedCount] = useState(
    () => dashboardCache?.completedBookingsCount || 0
  );
  const [loading, setLoading] = useState(() => !dashboardCache);
  const [recentActivities, setRecentActivities] = useState(() =>
    getRecentActivities()
  );

  const currentVehicles = Array.isArray(vehicles) ? vehicles : [];
  const hasVehicles = currentVehicles.length > 0;

  const activeBookings = bookings.filter((booking) =>
    activeStatuses.includes(booking.status)
  );
  const activeBooking = activeBookings[0];

  const syncVehicleState = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];
    setVehicles?.(safeList);

    const defaultVehicle =
      safeList.find((item) => item.isDefault) || safeList[0] || null;

    setVehicle?.(defaultVehicle);
  };

  const loadDashboard = async ({ force = false } = {}) => {
    try {
      if (force || !dashboardCache) {
        setLoading(true);
      }

      const [dashboard, vehicleList, pendingBookings] = await Promise.all([
        fetchDashboard({ force }),
        fetchVehicles ? fetchVehicles({ force }) : Promise.resolve([]),
        api
          .get("/bookings/pending-payment")
          .then((response) => response.data?.data || [])
          .catch(() => []),
      ]);

      setBookings(dashboard?.activeBookings || []);
      setPendingBookingsCount(pendingBookings.length || 0);
      setActiveBookingsCount(
        dashboard?.activeBookingsCount ??
          dashboard?.activeBookings?.length ??
          0
      );
      setWallet(dashboard?.wallet || null);
      setCompletedCount(dashboard?.completedBookingsCount || 0);

      syncVehicleState(vehicleList || []);
    } catch (error) {
      console.error("Dashboard load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const refreshActivities = () => {
      setRecentActivities(getRecentActivities());
    };

    const refreshActivitiesFromDb = async () => {
      const activities = await fetchRecentActivities();
      setRecentActivities(activities);
    };

    refreshActivitiesFromDb();

    window.addEventListener("rov:activity", refreshActivities);
    window.addEventListener("rov:activity-sync", refreshActivities);
    window.addEventListener("storage", refreshActivities);

    return () => {
      window.removeEventListener("rov:activity", refreshActivities);
      window.removeEventListener("rov:activity-sync", refreshActivities);
      window.removeEventListener("storage", refreshActivities);
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] py-6">
        <div className="flex items-center space-x-2 text-sm text-muted">
          <FiRefreshCcw className="animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const cardTone =
    "border-brand/20 bg-gradient-to-br from-brand/5 via-white to-brand/10";
  const cardIconTone =
    "bg-brand/15 text-brand-dark ring-1 ring-brand/20";
  const cardAccent = "bg-brand/60";

  const statCards = [
    {
      icon: FiCalendar,
      label: "Active Bookings",
      number: activeBookingsCount,
      sub: "Current service requests",
      tone: cardTone,
      iconTone: cardIconTone,
      accent: cardAccent,
    },
    {
      icon: FiClock,
      label: "Pending Payments",
      number: pendingBookingsCount,
      sub: "Awaiting checkout",
      tone: cardTone,
      iconTone: cardIconTone,
      accent: cardAccent,
    },
    {
      icon: FiCheckCircle,
      label: "Completed",
      number: completedCount,
      sub: "Historical services",
      tone: cardTone,
      iconTone: cardIconTone,
      accent: cardAccent,
    },
    {
      icon: FiTruck,
      label: "Vehicles",
      number: currentVehicles.length,
      sub: hasVehicles
        ? vehicle
          ? `${vehicle.brand} ${vehicle.model}`
          : "Manage vehicles"
        : "No vehicles added",
      tone: cardTone,
      iconTone: cardIconTone,
      accent: cardAccent,
    },
  ];

  const fallbackActions = [
    hasVehicles
      ? [
          "Book Service",
          "Choose services and request nearby garages",
          "/booking/vehicle",
        ]
      : [
          "Add Vehicle",
          "Save your first vehicle to start booking",
          "/booking/vehicle",
        ],
    ["SOS", "Emergency roadside request", "/sos"],
    [
      "My Vehicles",
      hasVehicles ? "Manage your saved vehicles" : "Add and manage vehicles",
      "/dashboard/vehicles",
    ],
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-6">
      {/* Header Section */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Overview
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Welcome back, {user?.name || "User"}. Here's what's happening
              with your vehicles today.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3 lg:justify-end">
            {pendingBookingsCount > 0 && (
              <Link
                to="/dashboard/pending-bookings"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 sm:w-auto"
              >
                <FiAlertCircle />
                Pay Pending
              </Link>
            )}

            <Link
              to="/dashboard/payments"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:bg-bg-soft sm:w-auto"
            >
              <FiCreditCard />
              Wallet: {formatRupees(wallet?.balance || 0)}
            </Link>

            <Link
              to="/booking/vehicle"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-black shadow-sm transition hover:brightness-95 sm:w-auto"
            >
              {hasVehicles ? "Book Service" : "Add Vehicle"}
            </Link>

            <button
              type="button"
              disabled={loading}
              onClick={() => loadDashboard({ force: true })}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-white text-ink shadow-sm transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50 sm:w-11"
              aria-label="Refresh dashboard"
            >
              <FiRefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </section>

      <CustomerPwaInstall compact />

      {/* Alert / Setup Banner */}
      {!hasVehicles && (
        <section className="flex flex-col gap-4 rounded-2xl border border-brand/25 bg-gradient-to-r from-brand/10 via-white to-brand/5 p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Vehicle setup required
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Add your vehicle once to unlock service bookings and maintenance
              tracking.
            </p>
          </div>

          <Link
            to="/booking/vehicle"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-black shadow-sm transition hover:-translate-y-0.5 hover:brightness-95"
          >
            <FiPlusCircle />
            Add Vehicle
          </Link>
        </section>
      )}

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className={`group relative min-w-0 overflow-hidden rounded-2xl border ${item.tone} p-3 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4`}
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 ${item.accent}`}
                aria-hidden="true"
              />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold leading-5 text-slate-700 sm:text-sm">
                    {item.label}
                  </span>

                  <div className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                    {item.number}
                  </div>
                </div>

                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconTone} shadow-sm transition-transform group-hover:scale-105 sm:h-11 sm:w-11`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-slate-600 sm:text-sm">
                {item.sub}
              </div>
            </div>
          );
        })}
      </section>

      {/* Main Content Area */}
      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        {/* Active Service Column */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Active Service
                </h3>
                <p className="text-sm text-muted">
                  Track your current booking progress
                </p>
              </div>

              {activeBooking && (
                <Link
                  to="/tracking"
                  state={{ bookingId: activeBooking.id }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-brand-dark transition hover:bg-brand/10"
                >
                  View Details <FiArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {activeBooking ? (
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand-dark shadow-sm">
                      <FiTruck className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="font-medium text-ink">
                        {activeBooking.services
                          ?.map((item) => item.service?.name)
                          .filter(Boolean)
                          .join(", ") || "Vehicle Service"}
                      </div>

                      <div className="mt-1 text-sm text-muted">
                        {activeBooking.vehicle?.brand}{" "}
                        {activeBooking.vehicle?.model}
                        {activeBooking.garage
                          ? ` • ${activeBooking.garage.name}`
                          : " • Awaiting Garage Assignment"}
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
                    {activeBooking.status?.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-xs text-muted">
                    <span>Progress</span>
                    <span>{getProgress(activeBooking.status)}</span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500 ease-in-out"
                      style={{ width: getProgress(activeBooking.status) }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-center">
                <p className="text-sm font-semibold text-ink">
                  No active services
                </p>
                <p className="mt-1 text-xs text-muted">
                  {hasVehicles
                    ? "Your vehicles are currently up to date."
                    : "Add a vehicle to book your first service."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Activity Sidebar */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-ink">
                Activity & Shortcuts
              </h3>
              <p className="text-sm text-muted">
                Recent events and quick links
              </p>
            </div>

            <div>
              <ul className="space-y-2">
                {recentActivities.length > 0
                  ? recentActivities.slice(0, 5).map((activity) => (
                      <li key={activity.id}>
                        <Link
                          to={activity.path || "/dashboard"}
                          className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                        >
                          <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-brand-dark" />

                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold text-ink">
                              {activity.title}
                            </p>
                            <p className="line-clamp-2 text-xs leading-5 text-muted">
                              {activity.detail || "System Update"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted">
                              {new Date(
                                activity.createdAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))
                  : fallbackActions.map(([name, desc, to]) => (
                      <li key={name}>
                        <Link
                          to={to}
                          className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                        >
                          <FiArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-brand-dark" />

                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {name}
                            </p>
                            <p className="text-xs text-muted">{desc}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export { Dashboard, Dashboard as CustomerDashboard };
export default Dashboard;
