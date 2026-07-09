import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import { payForBooking } from "@/utils/bookingPayment";
import { isServiceHoursError, SERVICE_HOURS_MESSAGE } from "@/utils/serviceHours";
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

      if (isServiceHoursError(err)) {
        setNotice(SERVICE_HOURS_MESSAGE);
        setError("");
        return;
      }

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
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-dark">
                Customer Pending Payments
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
                Pending Bookings
              </h2>
            </div>
            <div className="h-10 w-28 rounded-xl bg-bg-soft" />
          </div>
        </section>

        <div className="card-soft rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-36 rounded bg-bg-soft" />
            <div className="h-6 w-3/4 rounded bg-bg-soft" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-16 rounded-xl bg-bg-soft" />
              <div className="h-16 rounded-xl bg-bg-soft" />
              <div className="h-16 rounded-xl bg-bg-soft" />
              <div className="h-16 rounded-xl bg-bg-soft" />
            </div>
          </div>
          <p className="mt-5 text-sm font-medium text-muted">
            Loading pending bookings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-dark">
                Customer Pending Payments
              </p>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {pendingCount} pending
              </span>
            </div>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Pending Bookings
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              These bookings are saved under your account but have not entered
              garage search yet. Complete the online payment to convert one into
              an active booking.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadPendingBookings({ force: true })}
            disabled={refreshing}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/20 hover:bg-bg-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 shadow-sm">
          <FiAlertCircle className="mt-1 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 shadow-sm">
          <FiAlertCircle className="mt-1 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4">
        {bookings.map((booking) => {
          const isPaying = payingId === booking.id;

          return (
            <article
              key={booking.id}
              className="card-soft overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:border-ink/10 hover:shadow-md"
            >
              <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
                <div className="min-w-0 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                          #{booking.bookingCode || booking.id}
                        </span>
                      </div>

                      <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-7 text-ink sm:text-xl">
                        {getServicesText(booking)}
                      </h3>
                    </div>

                    <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      <FiClock className="text-sm" />
                      Pending Payment
                    </span>
                  </div>

                  <div className="grid gap-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        <FiTruck className="shrink-0" />
                        Vehicle
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-ink">
                        {getVehicleText(booking)}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        <FiCalendar className="shrink-0" />
                        Created
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-ink">
                        {getCreatedText(booking)}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-xl border border-line bg-bg-soft px-3 py-2.5 sm:bg-white">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        <FiCreditCard className="shrink-0" />
                        Online due
                      </div>
                      <div className="mt-1 truncate text-base font-bold text-ink">
                        {getOnlineAmountText(booking)}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-xl border border-line bg-bg-soft px-3 py-2.5 sm:bg-white">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Service estimate
                      </div>
                      <div className="mt-1 truncate text-base font-bold text-ink">
                        {getServiceRangeText(booking)}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line pt-4">
                    <div className="flex min-w-0 items-start gap-2 text-sm leading-6 text-muted">
                      <FiMapPin className="mt-1 shrink-0" />
                      <span className="line-clamp-2 break-words">
                        {getAddressText(booking)}
                      </span>
                    </div>
                  </div>
                </div>

                <aside className="border-t border-line bg-bg-soft p-5 sm:p-6 lg:border-l lg:border-t-0">
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Next step
                      </p>
                      <p className="mt-1 text-sm leading-6 text-ink">
                        Complete the online payment to activate garage search for
                        this booking.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePayNow(booking)}
                      disabled={isPaying || Boolean(payingId)}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/20 transition hover:bg-brand-dark hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm"
                    >
                      <FiCreditCard className="shrink-0" />
                      {isPaying ? "Opening payment..." : "Pay & Activate"}
                      {!isPaying && <FiArrowRight className="shrink-0" />}
                    </button>
                  </div>
                </aside>
              </div>
            </article>
          );
        })}

        {bookings.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center shadow-sm sm:px-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-bg-soft">
              <FiAlertCircle className="text-2xl text-muted" />
            </div>

            <h3 className="mt-4 text-lg font-bold text-ink">
              No pending bookings
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              Bookings that are waiting for payment will appear here, so you can
              return later and complete payment without creating a duplicate
              booking.
            </p>

            <Link
              to="/booking/vehicle"
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-2 active:scale-[0.99] sm:w-auto"
            >
              Book a service
              <FiArrowRight />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export { PendingBookings };