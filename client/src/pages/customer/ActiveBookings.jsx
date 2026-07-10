import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import {
  FiNavigation,
  FiRefreshCw,
  FiTool,
  FiTruck,
} from "react-icons/fi";

const getServicesText = (booking) => {
  return (
    booking.services
      ?.map((item) => item.service?.name)
      .filter(Boolean)
      .join(", ") || "Vehicle Service"
  );
};

const getGarageText = (booking) => {
  if (booking.garage?.name) return booking.garage.name;

  if (booking.status === "PENDING_PAYMENT") return "Preparing garage search";
  if (booking.status === "SEARCHING_GARAGE") return "Finding nearby garage";

  return "Garage not assigned yet";
};

const getVehicleText = (booking) => {
  const vehicle = booking.vehicle;

  if (!vehicle) return "Saved vehicle";

  return (
    `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
    vehicle.registrationNumber ||
    "Saved vehicle"
  );
};

const getAmount = (booking) => {
  const min = Number(booking.totalServiceAmount || 0);
  const max = Number(booking.totalServiceMaxAmount || min || 0);

  if (min > 0 && max > 0 && min !== max) {
    return `\u20b9${min.toLocaleString("en-IN")} - \u20b9${max.toLocaleString("en-IN")}`;
  }

  return `\u20b9${Number(max || min || 0).toLocaleString("en-IN")}`;
};

const ACTIVE_BOOKING_STATUSES = new Set([
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
]);

const formatStatus = (status) => {
  return status?.replaceAll("_", " ") || "UNKNOWN";
};

export default function ActiveBookings() {
  const { fetchActiveBookings } = useApp();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadBookings = async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      setError("");

      const data = await fetchActiveBookings({ force });
      setBookings(
        (data || []).filter((booking) =>
          ACTIVE_BOOKING_STATUSES.has(booking.status),
        ),
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load active bookings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">Active Bookings</h2>
        <div className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-sm">
          Loading active bookings...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="min-w-0 text-2xl font-bold sm:text-3xl">
          Active Bookings
        </h2>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadBookings({ force: true })}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3.5 text-sm font-medium text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((booking) => {
          const isAwaitingDeliveryAcceptance = Boolean(
            booking.deliveredAt && !booking.customerAcceptedAt,
          );
          const statusText = isAwaitingDeliveryAcceptance
            ? "DELIVERY READY"
            : formatStatus(booking.status);

          return (
            <article
              key={booking.id}
              className="overflow-hidden rounded-lg border border-line bg-white shadow-sm transition hover:border-ink/15 hover:shadow-md"
            >
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="break-words text-xs font-medium leading-snug text-muted">
                        #{booking.bookingCode || booking.id}
                      </div>

                      <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-ink">
                        {getServicesText(booking)}
                      </h3>
                    </div>

                    <span className="inline-flex h-7 w-fit shrink-0 items-center rounded-md border border-brand/30 bg-brand/10 px-2.5 text-[11px] font-bold text-ink">
                      {statusText}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
                      <FiTruck className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          Vehicle
                        </p>
                        <p className="truncate font-medium text-ink">
                          {getVehicleText(booking)}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
                      <FiTool className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          Garage
                        </p>
                        <p className="truncate font-medium text-ink">
                          {getGarageText(booking)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="flex flex-col justify-center border-t border-line bg-bg-soft/50 p-4 sm:p-5 lg:border-l lg:border-t-0">
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted">
                      Estimated amount
                    </p>
                    <p className="mt-1 text-lg font-bold text-ink">
                      {getAmount(booking)}
                    </p>
                  </div>

                  {isAwaitingDeliveryAcceptance ? (
                    <Link
                      to="/tracking"
                      state={{ bookingId: booking.id }}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand px-3.5 text-sm font-semibold text-black shadow-sm transition hover:bg-brand-dark"
                    >
                      <FiNavigation />
                      Review Delivery
                    </Link>
                  ) : (
                    <Link
                      to="/tracking"
                      state={{ bookingId: booking.id }}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-ink px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-2"
                    >
                      <FiNavigation />
                      Track
                    </Link>
                  )}
                </aside>
              </div>
            </article>
          );
        })}

        {bookings.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-muted shadow-sm">
            No active bookings right now.
          </div>
        )}
      </div>
    </div>
  );
}
