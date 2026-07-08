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
      <div className="card-soft rounded-2xl p-5 text-sm text-muted">
        Loading dashboard...
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
      sub: "Saved bookings to pay",
    },
    {
      icon: FiClock,
      label: "Completed",
      number: completedCount,
      sub: "Completed services",
    },
    {
      icon: FiShield,
      label: "Wallet Coins",
      number: wallet?.balance || 0,
      sub: "RovAuto wallet balance",
    },
    {
      icon: FiTruck,
      label: "Vehicles",
      number: currentVehicles.length,
      sub: hasVehicles
        ? vehicle
          ? `${vehicle.brand} ${vehicle.model}`
          : "Manage your vehicles"
        : "Add your first vehicle",
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
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink to-ink-2 p-5 text-white shadow-sm sm:p-6">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              Hello {user?.name || "there"}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              {hasVehicles
                ? "Manage bookings, wallet, vehicles, and service requests."
                : "Add your first vehicle to start booking services."}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => loadDashboard({ force: true })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 px-4 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiRefreshCcw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="relative mt-5 grid gap-3 sm:flex sm:flex-wrap">
          <Link
            to="/booking/vehicle"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-black transition hover:bg-brand-dark hover:text-black"
          >
            {hasVehicles ? "Book a service" : "Add your first vehicle"}
          </Link>

          <Link
            to="/sos"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/15"
          >
            SOS
          </Link>

          {pendingBookingsCount > 0 && (
            <Link
              to="/dashboard/pending-bookings"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Pay pending booking
            </Link>
          )}

          <Link
            to="/dashboard/payments"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/15"
          >
            Wallet: {formatRupees(wallet?.balance || 0)}
          </Link>
        </div>
      </section>

      {!hasVehicles && (
        <section className="rounded-2xl border border-brand/40 bg-brand-soft/60 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-ink">
                Vehicle setup required
              </h3>
              <p className="mt-1 text-sm text-muted">
                Add your vehicle once, then booking services becomes available.
              </p>
            </div>

            <Link
              to="/booking/vehicle"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
            >
              <FiPlusCircle />
              Add Vehicle
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="card-soft rounded-2xl p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-black">
                <Icon />
              </div>

              <div className="mt-3 text-3xl font-bold text-ink">
                {item.number}
              </div>

              <div className="mt-1 text-sm font-semibold text-ink">
                {item.label}
              </div>

              <div className="mt-1 truncate text-xs text-muted">
                {item.sub}
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card-soft rounded-2xl p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-ink">Active service</h3>
              <p className="mt-1 text-xs text-muted">
                Current booking progress
              </p>
            </div>

            {activeBooking && (
              <Link
                to="/tracking"
                state={{ bookingId: activeBooking.id }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-ink"
              >
                Track <FiArrowRight />
              </Link>
            )}
          </div>

          {activeBooking ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl text-black">
                  <FiTruck />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">
                    {activeBooking.services
                      ?.map((item) => item.service?.name)
                      .filter(Boolean)
                      .join(", ") || "Vehicle Service"}
                  </div>

                  <div className="mt-1 text-xs text-muted">
                    {activeBooking.vehicle?.brand}{" "}
                    {activeBooking.vehicle?.model}
                    {activeBooking.garage
                      ? ` · ${activeBooking.garage.name}`
                      : " · Waiting for garage"}
                  </div>
                </div>

                <span className="w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink">
                  {activeBooking.status?.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-soft">
                <div
                  className="h-full bg-brand"
                  style={{ width: getProgress(activeBooking.status) }}
                />
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
              {hasVehicles
                ? "No active service right now. Civilization briefly holds."
                : "No active service yet. Add a vehicle first, because booking a ghost car remains unsupported."}
            </div>
          )}
        </div>

        <div className="card-soft rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-ink">Quick Actions</h3>
          <p className="mt-1 text-xs text-muted">Recent activity and shortcuts</p>

          <ul className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 text-sm">
            {recentActivities.length
              ? recentActivities.map((activity) => (
                  <li key={activity.id}>
                    <Link
                      to={activity.path || "/dashboard"}
                      className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-bg-soft hover:text-ink"
                    >
                      <FiCheckCircle className="mt-0.5 shrink-0 text-brand-dark" />

                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">
                          {activity.title}
                        </div>

                        <div className="truncate text-xs text-muted">
                          {activity.detail ||
                            new Date(activity.createdAt).toLocaleString()}
                        </div>

                        <div className="mt-0.5 text-[11px] text-muted">
                          {new Date(activity.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))
              : fallbackActions.map(([name, desc, to]) => (
                  <li key={name}>
                    <Link
                      to={to}
                      className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-bg-soft hover:text-ink"
                    >
                      <FiCheckCircle className="mt-0.5 shrink-0 text-brand-dark" />

                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{name}</div>
                        <div className="text-xs text-muted">{desc}</div>
                      </div>
                    </Link>
                  </li>
                ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export { Dashboard, Dashboard as CustomerDashboard };
export default Dashboard;
