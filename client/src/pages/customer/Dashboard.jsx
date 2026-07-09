import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import { formatRupees } from "@/utils/priceRange";
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
  FiAlertCircle
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
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex items-center space-x-2 text-sm text-muted">
          <FiRefreshCcw className="animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: FiCalendar,
      label: "Active Bookings",
      number: activeBookingsCount,
      sub: "Current service requests",
    },
    {
      icon: FiClock,
      label: "Pending Payments",
      number: pendingBookingsCount,
      sub: "Awaiting checkout",
    },
    {
      icon: FiCheckCircle,
      label: "Completed",
      number: completedCount,
      sub: "Historical services",
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
    },
  ];

  const fallbackActions = [
    hasVehicles
      ? [
          "Book Service",
          "Choose services and request nearby garages",
          "/booking/vehicle",
        ]
      : ["Add Vehicle", "Save your first vehicle to start booking", "/booking/vehicle"],
    ["SOS", "Emergency roadside request", "/sos"],
    [
      "My Vehicles",
      hasVehicles ? "Manage your saved vehicles" : "Add and manage vehicles",
      "/dashboard/vehicles",
    ],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Section */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted">
            Welcome back, {user?.name || "User"}. Here's what's happening with your vehicles today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {pendingBookingsCount > 0 && (
            <Link
              to="/dashboard/pending-bookings"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-100 border border-red-200"
            >
              <FiAlertCircle />
              Pay Pending
            </Link>
          )}

          <Link
            to="/dashboard/payments"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 text-sm font-medium text-ink transition hover:bg-gray-50 shadow-sm"
          >
            <FiCreditCard />
            Wallet: {formatRupees(wallet?.balance || 0)}
          </Link>

          <Link
            to={hasVehicles ? "/booking/vehicle" : "/booking/vehicle"}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-black shadow-sm transition hover:brightness-95"
          >
            {hasVehicles ? "Book Service" : "Add Vehicle"}
          </Link>

          <button
            type="button"
            disabled={loading}
            onClick={() => loadDashboard({ force: true })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white text-ink shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh dashboard"
          >
            <FiRefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </section>

      {/* Alert / Setup Banner */}
      {!hasVehicles && (
        <section className="flex flex-col gap-4 rounded-md border border-brand/30 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Vehicle setup required
            </h3>
            <p className="mt-1 text-sm text-muted">
              Add your vehicle once to unlock service bookings and maintenance tracking.
            </p>
          </div>
          <Link
            to="/booking/vehicle"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-black shadow-sm transition hover:brightness-95"
          >
            <FiPlusCircle />
            Add Vehicle
          </Link>
        </section>
      )}

      {/* Stats Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="card-soft flex flex-col justify-between rounded-lg border border-black/5 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted">{item.label}</span>
                <Icon className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-ink">{item.number}</div>
                <div className="mt-1 truncate text-xs text-muted">{item.sub}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Main Content Area */}
      <section className="grid gap-6 lg:grid-cols-3">
        
        {/* Active Service Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-soft rounded-lg border border-black/5 p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Active Service</h3>
                <p className="text-sm text-muted">Track your current booking progress</p>
              </div>
              {activeBooking && (
                <Link
                  to="/tracking"
                  state={{ bookingId: activeBooking.id }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-dark hover:underline"
                >
                  View Details <FiArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {activeBooking ? (
              <div className="rounded-md border border-black/5 bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand-dark">
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
                        {activeBooking.vehicle?.brand} {activeBooking.vehicle?.model}
                        {activeBooking.garage
                          ? ` • ${activeBooking.garage.name}`
                          : " • Awaiting Garage Assignment"}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-ink">
                    {activeBooking.status?.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between text-xs text-muted mb-2">
                    <span>Progress</span>
                    <span>{getProgress(activeBooking.status)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full bg-brand transition-all duration-500 ease-in-out"
                      style={{ width: getProgress(activeBooking.status) }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed border-black/15 bg-black/5 p-4 text-center">
                <p className="text-sm font-medium text-ink">No active services</p>
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
        <div className="space-y-4">
          <div className="card-soft rounded-lg border border-black/5 p-5 shadow-sm h-full max-h-[400px] flex flex-col">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-ink">Activity & Shortcuts</h3>
              <p className="text-sm text-muted">Recent events and quick links</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <ul className="space-y-3">
                {recentActivities.length > 0
                  ? recentActivities.map((activity) => (
                      <li key={activity.id}>
                        <Link
                          to={activity.path || "/dashboard"}
                          className="group flex items-start gap-3 rounded-md p-2 hover:bg-black/5 transition-colors"
                        >
                          <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-ink transition-colors" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                              {activity.title}
                            </p>
                            <p className="text-xs text-muted truncate">
                              {activity.detail || "System Update"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted">
                              {new Date(activity.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))
                  : fallbackActions.map(([name, desc, to]) => (
                      <li key={name}>
                        <Link
                          to={to}
                          className="group flex items-start gap-3 rounded-md p-2 hover:bg-black/5 transition-colors"
                        >
                          <FiArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-ink transition-colors" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">{name}</p>
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