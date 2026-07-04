import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import {
  FiAlertCircle,
  FiCalendar,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";

const statuses = [
  "",
  "PENDING_PAYMENT",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];

const formatStatus = (status) => status?.replaceAll("_", " ") || "-";

const formatAmount = (booking) =>
  Number(booking.payableAmount || booking.payment?.amount || 0).toLocaleString();

const formatVehicle = (vehicle) => {
  if (!vehicle) return "-";

  return `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "-";
};

const getStatusClass = (status) => {
  if (["COMPLETED", "CONFIRMED"].includes(status)) {
    return "bg-lime-100 text-ink";
  }

  if (["CANCELLED", "EXPIRED"].includes(status)) {
    return "bg-red-50 text-red-700";
  }

  if (["IN_PROGRESS", "GARAGE_ASSIGNED"].includes(status)) {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-bg-soft text-muted";
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      const data = await adminApi.getBookings(params);
      setBookings(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Bookings</h2>
          <p className="mt-1 text-sm text-muted">
            Inspect bookings across customers and garages.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="hidden h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]">
          <label className="relative min-w-0">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              placeholder="Search booking, customer, garage"
              className="h-10 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            {statuses.map((status) => (
              <option key={status || "all"} value={status}>
                {status ? formatStatus(status) : "All statuses"}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Search
          </button>
        </div>
      </section>

      <section className="card-soft overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                {[
                  "Booking",
                  "Customer",
                  "Garage",
                  "Vehicle",
                  "Status",
                  "Amount",
                  "Created",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 font-bold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-sm text-muted">
                    Loading bookings...
                  </td>
                </tr>
              ) : bookings.length ? (
                bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="border-t border-line transition hover:bg-bg-soft/70"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                      <div className="flex items-center gap-2">
                        <FiCalendar className="text-muted" />
                        <span>
                          #{booking.bookingCode || booking.id?.slice(0, 8)}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {booking.user?.name || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {booking.garage?.name || "Unassigned"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatVehicle(booking.vehicle)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          getStatusClass(booking.status),
                        ].join(" ")}
                      >
                        {formatStatus(booking.status)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      ₹{formatAmount(booking)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {booking.createdAt
                        ? new Date(booking.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-sm text-muted">
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}