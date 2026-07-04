import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import { isPaymentAuthError, payForBooking } from "@/utils/bookingPayment";
import {
  FiCheckCircle,
  FiCreditCard,
  FiNavigation,
  FiRefreshCw,
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

  if (booking.status === "PENDING_PAYMENT") return "Payment pending";
  if (booking.status === "SEARCHING_GARAGE") return "Finding nearby garage";

  return "Garage not assigned yet";
};

const getAmount = (booking) => {
  return (
    booking.totalServiceAmount ||
    booking.payment?.amount ||
    booking.payableAmount ||
    0
  );
};

const formatStatus = (status) => {
  return status?.replaceAll("_", " ") || "UNKNOWN";
};

export default function ActiveBookings() {
  const { user, fetchActiveBookings, clearBookingCaches } = useApp();
  const nav = useNavigate();
  const location = useLocation();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [error, setError] = useState("");

  const loadBookings = async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      setError("");

      const data = await fetchActiveBookings({ force });
      setBookings(data || []);
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

  const payBooking = async (booking) => {
    try {
      setPayingId(booking.id);
      setError("");

      const verifiedBooking = await payForBooking({ booking, user });

      clearBookingCaches?.();
      await loadBookings({ force: true });
      nav("/tracking", {
        state: {
          bookingId: verifiedBooking.id,
          bookingCode: verifiedBooking.bookingCode,
        },
      });
    } catch (err) {
      if (isPaymentAuthError(err)) {
        nav("/login", {
          state: {
            from: location,
            message: "Please login to continue payment.",
          },
        });
        return;
      }

      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not complete payment. Please try again.",
      );
    } finally {
      setPayingId(null);
    }
  };

  const acceptDelivery = async (booking) => {
    try {
      setAcceptingId(booking.id);
      setError("");
      await api.post(`/bookings/${booking.id}/accept-delivery`);
      clearBookingCaches?.();
      await loadBookings({ force: true });
      nav("/dashboard/history");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not accept delivery. Please try again.",
      );
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">Active Bookings</h2>
        <div className="card-soft p-6 text-muted">
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
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {bookings.map((booking) => {
          const isPendingPayment = booking.status === "PENDING_PAYMENT";
          const isAwaitingDeliveryAcceptance = Boolean(
            booking.deliveredAt && !booking.customerAcceptedAt,
          );

          return (
            <div
              key={booking.id}
              className="card-soft grid gap-4 p-5 sm:flex sm:flex-wrap sm:items-center"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:contents">
                <div className="min-w-0 sm:flex-1">
                  <div className="break-words text-xs leading-snug text-muted">
                    #{booking.bookingCode}
                  </div>

                  <div className="mt-1 line-clamp-2 font-semibold leading-snug">
                    {getServicesText(booking)}
                  </div>

                  <div className="mt-1 text-sm text-muted">
                    {getGarageText(booking)}
                  </div>
                </div>

                <div className="text-right font-bold sm:text-left">
                  ₹{getAmount(booking)}
                </div>
              </div>

              <span className="chip-brand w-fit max-w-full whitespace-nowrap">
                {formatStatus(booking.status)}
              </span>

              {isPendingPayment ? (
                <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center">
                  <button
                    type="button"
                    onClick={() => payBooking(booking)}
                    disabled={payingId === booking.id}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                  >
                    <FiCreditCard />
                    {payingId === booking.id ? "Processing..." : "Pay Now"}
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-line bg-bg-soft px-3.5 text-sm font-semibold text-muted opacity-70 sm:w-auto"
                    title="Complete payment to enable tracking"
                  >
                    <FiNavigation />
                    Track
                  </button>
                </div>
              ) : isAwaitingDeliveryAcceptance ? (
                <button
                  type="button"
                  onClick={() => acceptDelivery(booking)}
                  disabled={acceptingId === booking.id}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  <FiCheckCircle />
                  {acceptingId === booking.id
                    ? "Accepting..."
                    : "Accept Delivery"}
                </button>
              ) : (
                <Link
                  to="/tracking"
                  state={{ bookingId: booking.id }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-ink px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-2 sm:w-auto"
                >
                  <FiNavigation />
                  Track
                </Link>
              )}
            </div>
          );
        })}

        {bookings.length === 0 && (
          <div className="card-soft p-8 text-center text-muted">
            No active bookings right now.
          </div>
        )}
      </div>
    </div>
  );
}
