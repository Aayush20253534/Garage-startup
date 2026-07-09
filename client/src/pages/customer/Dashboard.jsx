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
  FiShield,
  FiTruck,
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
      <div className="flex min-h-[400px] items-center justify-center rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <FiRefreshCcw className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm text-muted">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: FiCalendar,
      label: "Active Bookings",
      number: activeBookingsCount,
      sub: "In progress",
      color: "text-brand",
    },
    {
      icon: FiClock,
      label: "Pending Payments",
      number: pendingBookingsCount,
      sub: "Awaiting action",
      color: "text-amber-600",
    },
    {
      icon: FiCheckCircle,
      label: "Completed",
      number: completedCount,
      sub: "This month",
      color: "text-emerald-600",
    },
    {
      icon: FiTruck,
      label: "Vehicles",
      number: currentVehicles.length,
      sub: hasVehicles
        ? vehicle
          ? `${vehicle.brand} ${vehicle.model}`
          : "Multiple vehicles"
        : "Get started",
      color: "text-brand",
    },
  ];

  const fallbackActions = [
    hasVehicles
      ? {
          label: "Book Service",
          desc: "Request nearby garages",
          to: "/booking/vehicle",
          icon: FiPlusCircle,
        }
      : {
          label: "Add Vehicle",
          desc: "Save your first vehicle",
          to: "/booking/vehicle",
          icon: FiTruck,
        },
    {
      label: "SOS",
      desc: "Emergency roadside help",
      to: "/sos",
      icon: FiShield,
    },
    {
      label: "Manage Vehicles",
      desc: "View & edit fleet",
      to: "/dashboard/vehicles",
      icon: FiTruck,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-8 text-white shadow-xl sm:p-10">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-widest text-white/70">
              WELCOME BACK
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">
              Hello, {user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="mt-3 max-w-md text-lg text-white/70">
              {hasVehicles
                ? "Here's what's happening with your vehicles today."
                : "Let's get your first vehicle set up and start booking services."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => loadDashboard({ force: true })}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <FiRefreshCcw className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <Link
              to="/booking/vehicle"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-brand px-6 font-semibold text-black transition hover:bg-brand/90"
            >
              {hasVehicles ? "Book Service" : "Add Vehicle"}
              <FiArrowRight />
            </Link>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.slice(0, 3).map((stat, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm"
            >
              <div className="text-xs uppercase tracking-widest text-white/60">
                {stat.label}
              </div>
              <div className="mt-1 text-3xl font-semibold text-white">
                {stat.number}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vehicle Warning */}
      {!hasVehicles && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex gap-4">
              <div className="mt-1 rounded-2xl bg-amber-100 p-3 text-amber-600">
                <FiTruck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-ink">
                  Vehicle setup required
                </h3>
                <p className="mt-1.5 text-muted">
                  Add your vehicle to unlock full booking capabilities.
                </p>
              </div>
            </div>
            <Link
              to="/booking/vehicle"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-brand px-6 font-semibold text-black transition hover:bg-brand/90"
            >
              <FiPlusCircle />
              Add Vehicle
            </Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="group rounded-3xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-ink">
                    {item.number}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="font-semibold text-ink">{item.label}</div>
                <div className="mt-1 text-sm text-muted">{item.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Active Service */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-ink">
                  Active Service
                </h2>
                <p className="text-sm text-muted">Real-time tracking</p>
              </div>
              {activeBooking && (
                <Link
                  to="/tracking"
                  state={{ bookingId: activeBooking.id }}
                  className="flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand/80"
                >
                  View full tracking <FiArrowRight />
                </Link>
              )}
            </div>

            {activeBooking ? (
              <div className="mt-8">
                <div className="flex items-center gap-5 rounded-2xl bg-zinc-50 p-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-4xl text-white">
                    <FiTruck />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-lg text-ink">
                          {activeBooking.services
                            ?.map((item) => item.service?.name)
                            .filter(Boolean)
                            .join(", ") || "Vehicle Service"}
                        </p>
                        <p className="text-sm text-muted">
                          {activeBooking.vehicle?.brand}{" "}
                          {activeBooking.vehicle?.model}
                          {activeBooking.garage && (
                            <> • {activeBooking.garage.name}</>
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        {activeBooking.status?.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between text-xs text-muted mb-2">
                        <span>PROGRESS</span>
                        <span>{getProgress(activeBooking.status)}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className="h-full bg-gradient-to-r from-brand to-brand-dark transition-all duration-500"
                          style={{ width: getProgress(activeBooking.status) }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
                <FiTruck className="h-12 w-12 text-zinc-300" />
                <p className="mt-4 font-medium text-ink">
                  No active services
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted">
                  {hasVehicles
                    ? "Your vehicles are ready when you need them."
                    : "Add a vehicle to start booking garage services."}
                </p>
                <Link
                  to="/booking/vehicle"
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
                >
                  {hasVehicles ? "Book Now" : "Add Vehicle"}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Activity */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl bg-white p-8 shadow-sm h-full flex flex-col">
            <h2 className="text-2xl font-semibold text-ink">Quick Actions</h2>
            <p className="text-sm text-muted">Recent activity & shortcuts</p>

            <div className="mt-8 flex-1 overflow-hidden">
              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    <Link
                      key={activity.id}
                      to={activity.path || "/dashboard"}
                      className="group flex gap-4 rounded-2xl border border-transparent p-4 transition hover:border-zinc-100 hover:bg-zinc-50"
                    >
                      <div className="mt-0.5 text-brand">
                        <FiCheckCircle className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink group-hover:text-brand transition-colors">
                          {activity.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                          {activity.detail}
                        </p>
                        <p className="mt-2 text-[10px] text-zinc-400">
                          {new Date(activity.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="space-y-2">
                    {fallbackActions.map((action, i) => {
                      const Icon = action.icon;
                      return (
                        <Link
                          key={i}
                          to={action.to}
                          className="group flex items-center gap-4 rounded-2xl border border-transparent p-4 transition hover:border-zinc-100 hover:bg-zinc-50"
                        >
                          <div className="rounded-xl bg-zinc-100 p-3 text-brand group-hover:bg-brand group-hover:text-white transition-all">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-ink">
                              {action.label}
                            </div>
                            <div className="text-sm text-muted">
                              {action.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Wallet Card */}
            <div className="mt-8 rounded-2xl bg-gradient-to-br from-zinc-900 to-black p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/60">
                    WALLET BALANCE
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    {formatRupees(wallet?.balance || 0)}
                  </p>
                </div>
                <Link
                  to="/dashboard/payments"
                  className="rounded-xl bg-white/10 px-5 py-2 text-sm font-medium hover:bg-white/20 transition"
                >
                  Manage
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Dashboard, Dashboard as CustomerDashboard };
export default Dashboard;