import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "@/hooks/useApp";
import { getRecentActivities } from "@/utils/activityLog";
import {
  FiTruck,
  FiCalendar,
  FiShield,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiRefreshCcw,
  FiPlusCircle,
} from "react-icons/fi";

export default function Dashboard() {
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
  const [wallet, setWallet] = useState(() => dashboardCache?.wallet || null);
  const [completedCount, setCompletedCount] = useState(
    () => dashboardCache?.completedBookingsCount || 0
  );
  const [loading, setLoading] = useState(() => !dashboardCache);
  const [recentActivities, setRecentActivities] = useState(() =>
    getRecentActivities().slice(0, 3)
  );

  const currentVehicles = Array.isArray(vehicles) ? vehicles : [];
  const hasVehicles = currentVehicles.length > 0;

  const activeBookings = bookings.filter((booking) =>
    [
      "PENDING_PAYMENT",
      "SEARCHING_GARAGE",
      "GARAGE_ASSIGNED",
      "CONFIRMED",
      "IN_PROGRESS",
    ].includes(booking.status)
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

      const [dashboard, vehicleList] = await Promise.all([
        fetchDashboard({ force }),
        fetchVehicles ? fetchVehicles({ force }) : Promise.resolve([]),
      ]);

      setBookings(dashboard?.activeBookings || []);
      setActiveBookingsCount(
        dashboard?.activeBookingsCount ?? dashboard?.activeBookings?.length ?? 0
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
    const refreshActivities = () => setRecentActivities(getRecentActivities().slice(0, 3));
    window.addEventListener("rov:activity", refreshActivities);
    window.addEventListener("storage", refreshActivities);
    return () => {
      window.removeEventListener("rov:activity", refreshActivities);
      window.removeEventListener("storage", refreshActivities);
    };
  }, []);

  if (loading) {
    return (
      <div className="card-soft p-6">
        <p className="text-muted">Loading dashboard...</p>
      </div>
    );
  }

  const heroButton =
    "btn-primary w-full whitespace-nowrap px-4 py-3 text-sm !text-black hover:!text-black active:!text-black visited:!text-black focus:!text-black sm:w-auto sm:px-8 sm:text-base";

  return (
    <div className="grid gap-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink to-ink-2 p-5 text-white sm:p-8">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />

        <div className="relative grid gap-5 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="max-w-[13rem] text-4xl font-bold leading-tight sm:max-w-none sm:text-3xl">
              Hello {user?.name || "there"} 👋
            </h2>

            <p className="mt-3 max-w-[18rem] text-base leading-relaxed text-white/70 sm:mt-2 sm:max-w-none">
              {hasVehicles
                ? "Manage bookings, wallet, vehicles, and service requests."
                : "Add your first vehicle to start booking services."}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => loadDashboard({ force: true })}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiRefreshCcw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {hasVehicles ? (
            <Link to="/booking/vehicle" className={`${heroButton} col-span-2`}>
              Book a service
            </Link>
          ) : (
            <Link to="/booking/vehicle" className={`${heroButton} col-span-2`}>
              Add your first vehicle
            </Link>
          )}

          <Link to="/sos" className={heroButton}>
            SOS
          </Link>

          <Link to="/dashboard/payments" className={heroButton}>
            Wallet: ₹{wallet?.balance || 0}
          </Link>
        </div>
      </div>

      {!hasVehicles && (
        <div className="rounded-3xl border border-brand/40 bg-brand-soft/60 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Vehicle setup required</h3>
              <p className="mt-1 text-sm text-muted">
                Add your vehicle once, then booking services becomes available.
              </p>
            </div>

            <Link to="/booking/vehicle" className="btn-primary">
              <FiPlusCircle />
              Add Vehicle
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: FiCalendar,
            label: "Active Bookings",
            number: activeBookingsCount,
            sub: "Current service requests",
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
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="card-soft p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-black">
                <Icon />
              </div>

              <div className="mt-3 text-3xl font-bold">{item.number}</div>
              <div className="text-sm">{item.label}</div>
              <div className="mt-1 text-xs text-muted">{item.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card-soft p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Active service</h3>

            {activeBooking && (
              <Link
                to="/tracking"
                state={{ bookingId: activeBooking.id }}
                className="text-sm font-medium text-ink"
              >
                Track <FiArrowRight className="inline" />
              </Link>
            )}
          </div>

          {activeBooking ? (
            <>
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-black">
                  <FiTruck className="text-xl" />
                </span>

                <div className="flex-1">
                  <div className="font-semibold">
                    {activeBooking.services
                      ?.map((item) => item.service?.name)
                      .filter(Boolean)
                      .join(", ") || "Vehicle Service"}
                  </div>

                  <div className="text-xs text-muted">
                    {activeBooking.vehicle?.brand}{" "}
                    {activeBooking.vehicle?.model}
                    {activeBooking.garage
                      ? ` · ${activeBooking.garage.name}`
                      : " · Waiting for garage"}
                  </div>
                </div>

                <span className="chip-brand">
                  {activeBooking.status?.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-soft">
                <div
                  className="h-full bg-brand"
                  style={{
                    width:
                      activeBooking.status === "PENDING_PAYMENT"
                        ? "20%"
                        : activeBooking.status === "SEARCHING_GARAGE"
                        ? "40%"
                        : activeBooking.status === "GARAGE_ASSIGNED"
                        ? "55%"
                        : activeBooking.status === "CONFIRMED"
                        ? "65%"
                        : activeBooking.status === "IN_PROGRESS"
                        ? "80%"
                        : "100%",
                  }}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted">
              {hasVehicles
                ? "No active service right now. Civilization briefly holds."
                : "No active service yet. Add a vehicle first, because booking a ghost car remains unsupported."}
            </div>
          )}
        </div>

        <div className="card-soft p-6">
          <h3 className="mb-3 font-semibold">Quick Actions</h3>

          <ul className="grid gap-3 text-sm">
            {(recentActivities.length
              ? recentActivities.map((activity) => [
                  activity.title,
                  activity.detail || new Date(activity.createdAt).toLocaleString(),
                  activity.path || "/dashboard",
                ])
              : [
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
                hasVehicles
                  ? "Manage your saved vehicles"
                  : "Add and manage vehicles",
                "/dashboard/vehicles",
              ],
            ]).map(([name, desc, to]) => (
              <li key={name}>
                <Link to={to} className="flex items-start gap-3 hover:text-ink">
                  <FiCheckCircle className="mt-0.5 text-brand-dark" />

                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted">{desc}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
