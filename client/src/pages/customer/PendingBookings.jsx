import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import {
  getPaymentErrorCode,
  isPaymentIncompleteError,
  isPaymentSessionPreparingError,
  payForBooking,
  preloadCashfreeCheckout,
} from "@/utils/bookingPayment";
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
  const [wallet, setWallet] = useState(null);
  const [useWalletByBookingId, setUseWalletByBookingId] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pendingCount = useMemo(() => bookings.length, [bookings]);
  const walletBalance = Number(wallet?.balance || 0);

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
          "Unable to load your pending payment bookings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    preloadCashfreeCheckout();
    loadPendingBookings();

    let mounted = true;

    api
      .get("/wallet")
      .then((response) => {
        if (mounted) setWallet(response.data?.data || null);
      })
      .catch(() => {
        if (mounted) setWallet(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getBookingOnlineAmount = (booking) =>
    Number(booking.payment?.amount || booking.handlingFee || booking.payableAmount || 0);

  const getExistingWalletAmount = (booking) =>
    Number(booking.payment?.walletAmountUsed || booking.walletAmountUsed || 0);

  const hasActiveCashfreeOrder = (booking) =>
    booking.payment?.status === "CREATED" &&
    Boolean(booking.payment?.cashfreeOrderId);

  const hasWalletSelectionOverride = (bookingId) =>
    Object.prototype.hasOwnProperty.call(
      useWalletByBookingId,
      bookingId,
    );

  const isWalletSelected = (booking) => {
    if (hasWalletSelectionOverride(booking.id)) {
      return Boolean(useWalletByBookingId[booking.id]) && walletBalance > 0;
    }

    return getExistingWalletAmount(booking) > 0 && walletBalance > 0;
  };

  const getWalletAmountForBooking = (booking) =>
    isWalletSelected(booking)
      ? Math.min(walletBalance, getBookingOnlineAmount(booking))
      : 0;

  const getCashfreeAmountForBooking = (booking) =>
    Math.max(
      getBookingOnlineAmount(booking) - getWalletAmountForBooking(booking),
      0,
    );

  const toggleWalletForBooking = (bookingId, checked) => {
    setUseWalletByBookingId((current) => ({
      ...current,
      [bookingId]: checked,
    }));
  };

  const handlePayNow = async (booking) => {
    try {
      setPayingId(booking.id);
      setError("");
      setNotice("");

      const updatedBooking = await payForBooking({
        booking,
        useWallet: isWalletSelected(booking),
      });
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

      if (isPaymentSessionPreparingError(err)) {
        setNotice(
          "Your secure payment session is still being prepared. Wait a few seconds, then tap Pay again.",
        );
        setError("");
      } else if (isPaymentIncompleteError(err)) {
        setNotice(
          "Payment was not completed. Your booking remains pending and the secure payment session can be retried.",
        );
        setError("");
      } else {
        const referenceId = err.response?.data?.referenceId;
        const errorCode = getPaymentErrorCode(err);

        setNotice("");
        setError(
          [message, errorCode && `Code: ${errorCode}`, referenceId && `Reference: ${referenceId}`]
            .filter(Boolean)
            .join(" • "),
        );
      }

      await loadPendingBookings({ force: true });
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-2 text-sm text-muted">
          <FiRefreshCw className="animate-spin" />
          <span>Loading pending bookings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Section */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink">
              Pending Bookings
            </h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted max-w-2xl">
            These bookings are saved under your account but have not entered
            garage search yet. Complete the payment to activate them.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadPendingBookings({ force: true })}
          disabled={refreshing}
          className="inline-flex h-9 w-fit self-start items-center justify-center gap-2 rounded-md border border-line bg-white px-3.5 text-sm font-medium text-ink shadow-sm transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto sm:px-4"
        >
          <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {/* Alerts */}
      {notice && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bookings List */}
      <div className="space-y-4">
        {bookings.map((booking) => {
          const isPaying = payingId === booking.id;
          const onlineAmount = getBookingOnlineAmount(booking);
          const walletAmountUsed = getWalletAmountForBooking(booking);
          const cashfreeAmount = getCashfreeAmountForBooking(booking);

          return (
            <article
              key={booking.id}
              className="card-soft overflow-hidden rounded-lg border border-line bg-white shadow-sm"
            >
              <div className="flex flex-col lg:flex-row lg:items-stretch">
                
                {/* Main Content Area */}
                <div className="flex-1 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-line pb-4">
                    <div>
                      <span className="text-xs font-medium text-muted">
                        #{booking.bookingCode || booking.id}
                      </span>
                      <h3 className="mt-1 text-lg font-semibold text-ink">
                        {getServicesText(booking)}
                      </h3>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <FiClock className="h-3.5 w-3.5" />
                      Pending Payment
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <FiTruck className="h-3.5 w-3.5" /> Vehicle
                      </span>
                      <span className="mt-1 text-sm font-medium text-ink truncate">
                        {getVehicleText(booking)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <FiCalendar className="h-3.5 w-3.5" /> Created
                      </span>
                      <span className="mt-1 text-sm font-medium text-ink truncate">
                        {getCreatedText(booking)}
                      </span>
                    </div>

                    <div className="flex flex-col rounded-md bg-bg-soft px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <FiCreditCard className="h-3.5 w-3.5" /> Online Due
                      </span>
                      <span className="mt-1 text-sm font-semibold text-ink truncate">
                        {formatRupees(onlineAmount)}
                      </span>
                    </div>

                    <div className="flex flex-col rounded-md bg-bg-soft px-3 py-2">
                      <span className="text-xs font-medium text-muted">
                        Service Estimate
                      </span>
                      <span className="mt-1 text-sm font-semibold text-ink truncate">
                        {getServiceRangeText(booking)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 text-sm text-muted">
                    <FiMapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="line-clamp-2">
                      {getAddressText(booking)}
                    </span>
                  </div>
                </div>

                {/* Sidebar / Action Area */}
                <aside className="flex flex-col justify-center w-full lg:w-72 border-t border-line bg-bg-soft/50 p-5 sm:p-6 lg:border-l lg:border-t-0">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-ink">Action Required</h4>
                    <p className="mt-1 text-xs text-muted">
                      Complete the online payment to activate garage search for this booking.
                    </p>
                  </div>

                  <label
                    className={`mb-3 flex cursor-pointer items-start gap-3 rounded-md border p-3 text-xs transition ${
                      walletBalance > 0
                        ? "border-brand/40 bg-brand/10 hover:bg-brand/15"
                        : "border-line bg-white text-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isWalletSelected(booking)}
                      disabled={
                        walletBalance <= 0 ||
                        onlineAmount <= 0 ||
                        Boolean(payingId)
                      }
                      onChange={(event) =>
                        toggleWalletForBooking(booking.id, event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-line accent-black disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">
                        Use wallet balance
                      </span>
                      <span className="mt-0.5 block text-muted">
                        {hasActiveCashfreeOrder(booking)
                          ? "Changing this option safely refreshes the payment amount"
                          : `Available: ${formatRupees(walletBalance)}`}
                      </span>
                    </span>
                  </label>

                  <div className="mb-3 rounded-md border border-line bg-white p-3 text-xs">
                    {walletAmountUsed > 0 && (
                      <div className="mb-1 flex items-center justify-between gap-2 text-muted">
                        <span>Wallet applied</span>
                        <span className="font-semibold text-green-700">
                          -{formatRupees(walletAmountUsed)}
                        </span>
                      </div>
                    )}
                    {hasActiveCashfreeOrder(booking) && (
                      <p className="mb-2 text-[11px] leading-4 text-muted">
                        An older Cashfree session is replaced if this amount changes.
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-ink">Pay now</span>
                      <span className="font-bold text-ink">
                        {formatRupees(cashfreeAmount)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePayNow(booking)}
                    disabled={isPaying || Boolean(payingId)}
                    className="inline-flex w-full h-9 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-black shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCreditCard className="h-4 w-4 shrink-0" />
                    {isPaying
                      ? cashfreeAmount > 0
                        ? "Opening payment..."
                        : "Activating booking..."
                      : cashfreeAmount > 0
                        ? `Pay ${formatRupees(cashfreeAmount)} & Activate`
                        : "Pay with wallet"}
                  </button>
                </aside>
              </div>
            </article>
          );
        })}

        {/* Empty State */}
        {bookings.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-soft">
              <FiAlertCircle className="h-5 w-5 text-muted" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">
              No pending bookings
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Bookings awaiting payment will appear here. You can safely return later to complete them.
            </p>
            <Link
              to="/booking/vehicle"
              className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white shadow-sm transition hover:bg-ink/90"
            >
              Book a service
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export { PendingBookings };
