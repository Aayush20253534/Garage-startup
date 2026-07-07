import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import {
  FiAlertCircle,
  FiCalendar,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const CLEAR_CONFIRMATION = "CLEAR ALL BOOKINGS";

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
  Number(
    booking.payableAmount ||
      booking.payment?.amount ||
      0,
  ).toLocaleString();

const formatVehicle = (vehicle) => {
  if (!vehicle) return "-";

  return (
    `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
    "-"
  );
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
  const { user } = useApp();

  const [bookings, setBookings] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
  });
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] =
    useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin =
    user?.accountType === "STAFF" &&
    user?.role === "ADMIN";

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(
          ([, value]) => value,
        ),
      );

      const data = await adminApi.getBookings(params);
      setBookings(data || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load bookings",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openClearDialog = () => {
    setConfirmation("");
    setError("");
    setSuccess("");
    setShowClearDialog(true);
  };

  const closeClearDialog = () => {
    if (clearing) return;

    setShowClearDialog(false);
    setConfirmation("");
  };

  const clearAllBookings = async (event) => {
    event.preventDefault();

    if (
      !isAdmin ||
      confirmation !== CLEAR_CONFIRMATION
    ) {
      return;
    }

    setClearing(true);
    setError("");
    setSuccess("");

    try {
      const result = await adminApi.clearAllBookings(
        confirmation,
      );

      const deletedBookings = Number(
        result?.deletedBookings || 0,
      );

      const failedCloudImages = Number(
        result?.cloudinaryInspectionImages?.failed || 0,
      );

      setSuccess(
        deletedBookings
          ? `${deletedBookings} booking${
              deletedBookings === 1 ? "" : "s"
            } cleared across all customers and garages.${
              failedCloudImages
                ? ` ${failedCloudImages} inspection image${
                    failedCloudImages === 1 ? "" : "s"
                  } could not be removed from Cloudinary.`
                : ""
            }`
          : "There were no bookings to clear.",
      );

      setBookings([]);
      setFilters({ search: "", status: "" });
      setShowClearDialog(false);
      setConfirmation("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to clear all bookings",
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-bold text-ink">
            Bookings
          </h2>
          <p className="mt-1 text-sm text-muted">
            Inspect bookings across customers and garages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={openClearDialog}
              disabled={loading || clearing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiTrash2 />
              Clear all bookings
            </button>
          )}

          <button
            type="button"
            onClick={load}
            disabled={loading || clearing}
            className="hidden h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
          >
            <FiRefreshCw
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]">
          <label className="relative min-w-0">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  search: event.target.value,
                })
              }
              placeholder="Search booking, customer, garage"
              className="h-10 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: event.target.value,
              })
            }
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            {statuses.map((status) => (
              <option
                key={status || "all"}
                value={status}
              >
                {status
                  ? formatStatus(status)
                  : "All statuses"}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={load}
            disabled={loading || clearing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw
              className={loading ? "animate-spin" : ""}
            />
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
                  <td
                    colSpan="7"
                    className="px-4 py-6 text-sm text-muted"
                  >
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
                          #
                          {booking.bookingCode ||
                            booking.id?.slice(0, 8)}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {booking.user?.name || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {booking.garage?.name ||
                        "Unassigned"}
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
                        ? new Date(
                            booking.createdAt,
                          ).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-6 text-sm text-muted"
                  >
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showClearDialog && isAdmin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-8"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeClearDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-bookings-title"
            className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                  Admin-only destructive action
                </p>
                <h3
                  id="clear-bookings-title"
                  className="mt-1 text-xl font-bold text-ink"
                >
                  Clear every booking?
                </h3>
              </div>

              <button
                type="button"
                onClick={closeClearDialog}
                disabled={clearing}
                aria-label="Close"
                className="rounded-lg p-2 text-muted transition hover:bg-bg-soft hover:text-ink disabled:opacity-50"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-800">
              <p>
                This removes bookings for every customer and
                garage, including related payments, selected
                services, broadcasts, reviews, and inspection
                image records.
              </p>
              <p className="mt-2">
                Complaints are preserved but detached from their
                deleted booking. Wallet balances and wallet
                transaction history are not changed.
              </p>
              <p className="mt-2 font-semibold">
                This action cannot be undone.
              </p>
            </div>

            <form
              onSubmit={clearAllBookings}
              className="mt-5"
            >
              <label className="grid gap-2 text-sm font-medium text-ink">
                Type{" "}
                <span className="font-mono font-bold text-red-700">
                  {CLEAR_CONFIRMATION}
                </span>{" "}
                to confirm
                <input
                  autoFocus
                  value={confirmation}
                  onChange={(event) =>
                    setConfirmation(event.target.value)
                  }
                  autoComplete="off"
                  className="h-11 rounded-lg border border-line px-3 font-mono text-sm outline-none transition focus:border-red-500"
                />
              </label>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeClearDialog}
                  disabled={clearing}
                  className="h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    clearing ||
                    confirmation !==
                      CLEAR_CONFIRMATION
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiTrash2 />
                  {clearing
                    ? "Clearing bookings..."
                    : "Clear all bookings"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
