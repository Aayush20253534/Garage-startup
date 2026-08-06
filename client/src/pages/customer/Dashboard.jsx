import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import AcceptedGarageCard from "@/components/booking/AcceptedGarageCard";
import { formatRupees } from "@/utils/priceRange";
import CustomerPwaInstall from "@/components/pwa/CustomerPwaInstall";
import {
  BOOKING_TIMELINE_STEPS,
  getBookingTimelineState,
} from "@/utils/bookingTimeline";
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
  FiDollarSign,
  FiAlertCircle,
  FiBell,
  FiList,
  FiMapPin,
  FiRotateCcw,
  FiTool,
  FiUser,
  FiXCircle,
} from "react-icons/fi";

const activeStatuses = [
  "PENDING_VERIFICATION",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const ACTIVITY_ICON_MAP = {
  BOOKING_CREATED: FiCalendar,
  BOOKING_CANCELLED: FiXCircle,
  BOOKING_EXPIRED: FiClock,
  PAYMENT_PAID: FiCreditCard,
  PAYMENT_FAILED: FiAlertCircle,
  PAYMENT_REFUNDED: FiRotateCcw,
  WALLET_PAYMENT: FiCreditCard,
  WALLET_REFUND: FiRotateCcw,
  WALLET_RECHARGE: FiDollarSign,
  WALLET_CASHBACK: FiDollarSign,
  WALLET_CREDIT: FiDollarSign,
  WALLET_DEBIT: FiCreditCard,
  WALLET_PENDING: FiClock,
  WALLET_FAILED: FiAlertCircle,
  SOS_PAYMENT: FiAlertCircle,
  GARAGE_ACCEPTED: FiMapPin,
  SERVICE_STARTED: FiTool,
  READY_FOR_DELIVERY: FiTruck,
  BOOKING_COMPLETED: FiCheckCircle,
  LOCATION: FiMapPin,
  PROFILE: FiUser,
  SOS: FiAlertCircle,
};

const formatActivityTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  const activeTimeline = activeBooking
    ? getBookingTimelineState(activeBooking)
    : null;

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

      const [dashboard, vehicleList, pendingBookings, activities] =
        await Promise.all([
          fetchDashboard({ force }),
          fetchVehicles ? fetchVehicles({ force }) : Promise.resolve([]),
          api
            .get("/bookings/pending-payment")
            .then((response) => response.data?.data || [])
            .catch(() => []),
          fetchRecentActivities(),
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
      setRecentActivities(Array.isArray(activities) ? activities : []);

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

  const quickActions = (() => {
    const actions = [];

    if (activeBooking) {
      actions.push({
        name: "Track Active Service",
        description: `${activeTimeline?.step?.label || "View current progress"} for ${activeBooking.bookingCode || "your booking"}`,
        to: `/tracking?bookingId=${activeBooking.id}`,
        icon: FiMapPin,
      });
    }

    if (pendingBookingsCount > 0) {
      actions.push({
        name: "Pay Pending Booking",
        description: `${pendingBookingsCount} booking${pendingBookingsCount === 1 ? " is" : "s are"} waiting for payment`,
        to: "/dashboard/pending-bookings",
        icon: FiCreditCard,
      });
    }

    actions.push(
      hasVehicles
        ? {
            name: "Book Service",
            description: "Choose services and request nearby garages",
            to: "/booking/vehicle",
            icon: FiPlusCircle,
          }
        : {
            name: "Add Vehicle",
            description: "Save your first vehicle to start booking",
            to: "/booking/vehicle",
            icon: FiPlusCircle,
          },
      {
        name: "SOS Assistance",
        description: "Start an emergency roadside request",
        to: "/sos",
        icon: FiAlertCircle,
      },
      {
        name: "My Vehicles",
        description: hasVehicles
          ? "Manage your saved vehicles"
          : "Add and manage vehicles",
        to: "/dashboard/vehicles",
        icon: FiTruck,
      },
      {
        name: "Service History",
        description: "View completed services and warranty records",
        to: "/dashboard/history",
        icon: FiList,
      },
    );

    return actions.slice(0, 6);
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
      {/* Header Section */}
      <section className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Customer dashboard</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Welcome, {user?.name || "User"}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Manage bookings, vehicles, payments and service updates from one place.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3 lg:justify-end">
            {pendingBookingsCount > 0 && (
              <Link
                to="/dashboard/pending-bookings"
                className="col-span-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 sm:col-span-1 sm:w-auto"
              >
                <FiAlertCircle />
                Pay Pending
              </Link>
            )}

            <Link
              to="/dashboard/payments"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:bg-bg-soft sm:w-auto sm:px-4"
            >
              <FiCreditCard />
              Wallet: {formatRupees(wallet?.balance || 0)}
            </Link>

            <Link
              to="/booking/vehicle"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-ink-2 sm:w-auto"
            >
              {hasVehicles ? "Book Service" : "Add Vehicle"}
            </Link>

            <button
              type="button"
              disabled={loading}
              onClick={() => loadDashboard({ force: true })}
              className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-line bg-white text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1 sm:w-10"
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
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink-2"
          >
            <FiPlusCircle />
            Add Vehicle
          </Link>
        </section>
      )}

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="group min-w-0 rounded-xl border border-line bg-white p-3 shadow-sm transition-colors hover:border-ink/20 sm:p-4"
            >
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-soft text-ink sm:h-10 sm:w-10"
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 min-h-10 break-words text-xs font-medium leading-5 text-slate-600 [overflow-wrap:anywhere] sm:text-sm">
                {item.sub}
              </div>
            </div>
          );
        })}
      </section>

      {/* Main Content Area */}
      <section className="grid gap-4 2xl:grid-cols-[1.35fr_0.85fr]">
        {/* Active Service Column */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
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
              <div className="rounded-xl border border-line bg-bg-soft/50 p-4">
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
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-muted">Current stage</span>
                      <p className="mt-0.5 text-sm font-bold text-ink">
                        {activeTimeline.step.label}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand/15 px-2.5 py-1 font-bold text-brand-dark">
                      {activeTimeline.percent}%
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500 ease-in-out"
                      style={{ width: `${activeTimeline.percent}%` }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-1" aria-label="Booking progress timeline">
                    {BOOKING_TIMELINE_STEPS.map((step, index) => {
                      const reached = index <= activeTimeline.currentIndex;
                      const current = index === activeTimeline.currentIndex;

                      return (
                        <div key={step.key} className="min-w-0 text-center">
                          <div
                            className={`mx-auto h-2.5 w-2.5 rounded-full ${
                              reached ? "bg-brand" : "bg-slate-200"
                            } ${current ? "ring-4 ring-brand/20" : ""}`}
                          />
                          <p
                            className={`mt-2 hidden truncate text-[10px] font-semibold sm:block ${
                              reached ? "text-ink" : "text-muted"
                            }`}
                            title={step.label}
                          >
                            {step.shortLabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {activeBooking.garage && (
                  <div className="mt-5 border-t border-line pt-5">
                    <AcceptedGarageCard
                      garage={activeBooking.garage}
                      compact
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-bg-soft/60 p-4 text-center">
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
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-ink">
                Activity & Shortcuts
              </h3>
              <p className="text-sm text-muted">
                Recent events and quick links
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    Recent Activity
                  </h4>
                  <Link
                    to="/dashboard/notifications"
                    className="text-xs font-semibold text-brand-dark hover:underline"
                  >
                    Notifications
                  </Link>
                </div>

                {recentActivities.length > 0 ? (
                  <ul className="space-y-1">
                    {recentActivities.slice(0, 6).map((activity) => {
                      const ActivityIcon =
                        ACTIVITY_ICON_MAP[activity.type] || FiBell;

                      return (
                        <li key={activity.id}>
                          <Link
                            to={activity.path || "/dashboard"}
                            className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                          >
                            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-muted transition-colors group-hover:bg-brand/15 group-hover:text-brand-dark">
                              <ActivityIcon className="h-4 w-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-semibold text-ink">
                                {activity.title}
                              </p>
                              <p className="line-clamp-2 text-xs leading-5 text-muted">
                                {activity.detail || "System update"}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted">
                                {formatActivityTime(activity.createdAt)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-line bg-slate-50 p-3 text-xs leading-5 text-muted">
                    Booking, payment, cancellation, refund and service updates will appear here.
                  </div>
                )}
              </div>

              <div className="border-t border-line pt-4">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  Shortcuts
                </h4>
                <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                  {quickActions.map((action) => {
                    const ActionIcon = action.icon;

                    return (
                      <li key={`${action.name}-${action.to}`}>
                        <Link
                          to={action.to}
                          className="group flex h-full items-start gap-3 rounded-lg border border-line p-2.5 transition hover:border-ink/20 hover:bg-bg-soft"
                        >
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg-soft text-ink">
                            <ActionIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">
                              {action.name}
                            </p>
                            <p className="text-xs leading-5 text-muted">
                              {action.description}
                            </p>
                          </div>
                          <FiArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-dark" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export { Dashboard, Dashboard as CustomerDashboard };
export default Dashboard;
