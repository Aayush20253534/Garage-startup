import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import { payForBooking } from "@/utils/bookingPayment";
import { formatRupees, formatRupeeRange } from "@/utils/priceRange";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiMapPin,
  FiRefreshCw,
  FiTruck,
} from "react-icons/fi";

const getServicesText = (booking) =>
  booking.services
    ?.map((item) => item.service?.name)
    .filter(Boolean)
    .join(", ") || "Vehicle service";

const getVehicleText = (booking) => {
  const vehicle = booking.vehicle;

  if (!vehicle) return "Saved vehicle";

  return (
    `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
    vehicle.registrationNumber ||
    "Saved vehicle"
  );
};

const getServiceRangeText = (booking) => {
  const min = Number(booking.totalServiceAmount || 0);
  const max = Number(booking.totalServiceMaxAmount || min || 0);

  return formatRupeeRange(min, max);
};

const getOnlineAmountText = (booking) =>
  formatRupees(booking.payableAmount || booking.payment?.amount || 0);

const getCreatedText = (booking) => {
  if (!booking.createdAt) return "Recently created";

  return new Date(booking.createdAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getAddressText = (booking) =>
  booking.customerAddress || booking.location?.address || "Saved customer location";

export default function PendingBookings() {
  const nav = useNavigate();
  const { clearBookingCaches } = useApp();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pendingCount = useMemo(() => bookings.length, [bookings]);

  const loadPendingBookings = async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      setError("");

      const response = await api.get("/bookings/pending-payment");
      setBookings(response.data?.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load your pending payment bookings.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPendingBookings();
  }, []);

  const handlePayNow = async (booking) => {
    try {
      setPayingId(booking.id);
      setError("");
      setNotice("");

      const updatedBooking = await payForBooking({ booking });
      clearBookingCaches?.();

      nav("/tracking", {
        state: { bookingId: updatedBooking?.id || booking.id },
      });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Payment was not completed. This booking is still saved here for retry.";

      setNotice(
        /not completed|cancelled|canceled|failed/i.test(message)
          ? "Payment was not completed. Your booking is still pending and you can retry from this page."
          : "Your pending booking is still saved. Please retry payment after fixing the issue.",
      );
      setError(message);
      await loadPendingBookings({ force: true });
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">Pending Bookings</h2>
        <div className="card-soft p-6 text-muted">
          Loading pending bookings...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-dark">
              Customer Pending Payments
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              Pending Bookings
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              These bookings are saved under your account but have not entered
              garage search yet. Complete the online payment to convert one into
              an active booking.
            </p>
          </div>

          <div className="grid gap-3 sm:flex sm:items-center">
            <div className="rounded-2xl border border-line bg-bg-soft px-4 py-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                Pending
              </div>
              <div className="mt-1 text-2xl font-bold text-ink">
                {pendingCount}
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadPendingBookings({ force: true })}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {notice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {bookings.map((booking) => {
          const isPaying = payingId === booking.id;

          return (
            <article
              key={booking.id}
              className="card-soft overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                        #{booking.bookingCode || booking.id}
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-lg font-bold text-ink">
                        {getServicesText(booking)}
                      </h3>
                    </div>

                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                      <FiClock /> Pending Payment
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-bg-soft p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        <FiTruck /> Vehicle
                      </div>
                      <div className="mt-1 truncate font-semibold text-ink">
                        {getVehicleText(booking)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-bg-soft p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        <FiCalendar /> Created
                      </div>
                      <div className="mt-1 truncate font-semibold text-ink">
                        {getCreatedText(booking)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-bg-soft p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        <FiCreditCard /> Online due
                      </div>
                      <div className="mt-1 truncate font-semibold text-ink">
                        {getOnlineAmountText(booking)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-bg-soft p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Service estimate
                      </div>
                      <div className="mt-1 truncate font-semibold text-ink">
                        {getServiceRangeText(booking)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-2xl border border-line bg-white px-3 py-3 text-sm text-muted">
                    <FiMapPin className="mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{getAddressText(booking)}</span>
                  </div>
                </div>

                <div className="grid gap-3 lg:w-56">
                  <button
                    type="button"
                    onClick={() => handlePayNow(booking)}
                    disabled={isPaying || Boolean(payingId)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCreditCard />
                    {isPaying ? "Opening payment..." : "Pay & Activate"}
                  </button>

                </div>
              </div>
            </article>
          );
        })}

        {bookings.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line bg-white p-8 text-center shadow-sm">
            <FiAlertCircle className="mx-auto text-3xl text-muted" />
            <h3 className="mt-3 text-lg font-bold text-ink">
              No pending bookings
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              Bookings that are waiting for payment will appear here, so you can
              return later and complete payment without creating a duplicate
              booking.
            </p>
            <Link
              to="/booking/vehicle"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink-2"
            >
              Book a service
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export { PendingBookings };
