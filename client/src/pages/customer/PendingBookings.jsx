import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import { isSelfDropOffService } from "@/utils/serviceFulfillment";
import BookingPaymentLoader from "@/components/payment/BookingPaymentLoader";
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
  const [paymentProgress, setPaymentProgress] = useState(null);
  const paymentAttemptRef = useRef(false);

  const pendingCount = useMemo(() => bookings.length, [bookings]);
  const walletBalance = Number(wallet?.balance || 0);

  const loadWallet = async () => {
    try {
      const response = await api.get("/wallet");
      setWallet(response.data?.data || null);
    } catch {
      setWallet(null);
    }
  };

  const loadPendingBookings = async ({
    force = false,
    preserveMessage = false,
  } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      if (!preserveMessage) setError("");

      const response = await api.get("/bookings/pending-payment");
      setBookings(response.data?.data || []);
    } catch (err) {
      if (!preserveMessage) {
        setError(
          err.response?.data?.message ||
            "Unable to load your pending payment bookings.",
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    preloadCashfreeCheckout();
    void Promise.allSettled([loadPendingBookings(), loadWallet()]);
  }, []);

  const refreshPendingData = async ({ preserveMessage = false } = {}) => {
    await Promise.allSettled([
      loadPendingBookings({ force: true, preserveMessage }),
      loadWallet(),
    ]);
  };

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
    if (paymentAttemptRef.current) return;

    paymentAttemptRef.current = true;
    try {
      setPayingId(booking.id);
      setError("");
      setNotice("");

      const updatedBooking = await payForBooking({
        booking,
        useWallet: isWalletSelected(booking),
        onProgress: setPaymentProgress,
      });
      clearBookingCaches?.();

      nav("/tracking", {
        state: { bookingId: updatedBooking?.id || booking.id },
      });
    } catch (err) {
      const errorCode = getPaymentErrorCode(err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Payment was not completed. This booking is still saved here for retry.";

      if (errorCode === "PAYMENT_REFUNDED_TO_WALLET") {
        setNotice(
          message ||
            "The payment was safely returned to your Rovauto wallet. Your updated balance is shown below.",
        );
        setError("");
      } else if (isServiceHoursError(err)) {
        setNotice(SERVICE_HOURS_MESSAGE);
        setError("");
      } else if (isPaymentSessionPreparingError(err)) {
        setNotice(
          "Cashfree could not prepare a usable payment session right now. No money was deducted. Please try again.",
        );
        setError("");
      } else if (isPaymentIncompleteError(err)) {
        setNotice(
          "Payment was not completed. Your booking remains pending and the secure payment session can be retried.",
        );
        setError("");
      } else {
        const referenceId = err.response?.data?.referenceId;
        setNotice("");
        setError(
          [message, errorCode && `Code: ${errorCode}`, referenceId && `Reference: ${referenceId}`]
            .filter(Boolean)
            .join(" • "),
        );
      }

      await refreshPendingData({ preserveMessage: true });
    } finally {
      paymentAttemptRef.current = false;
      setPaymentProgress(null);
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
    <>
      <BookingPaymentLoader phase={paymentProgress} />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Section */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-line pb-6">
        <div>
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-2xl font-bold text-ink">
              Pending Bookings
            </h1>
            {pendingCount > 0 && (
              <div className="min-w-[92px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Pending
                </p>
                <p className="mt-0.5 text-sm font-black text-amber-900">
                  {pendingCount} {pendingCount === 1 ? "booking" : "bookings"}
                </p>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-muted max-w-2xl">
            These bookings are saved under your account but have not entered
            garage search yet. Complete the payment to activate them.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refreshPendingData()}
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
          const isSelfDropOff = isSelfDropOffService(booking);

          return (
            <article
              key={booking.id}
              className="card-soft overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
            >
              <div className="flex flex-col lg:flex-row lg:items-stretch">
                
                {/* Main Content Area */}
                <div className="flex-1 p-5 sm:p-6">
                  <div className="border-b border-line pb-4">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Booking #{booking.bookingCode || booking.id}
                      </span>
                      <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          <FiClock className="h-3.5 w-3.5" /> Status
                        </p>
                        <p className="mt-0.5 text-xs font-black text-amber-900">
                          Payment pending
                        </p>
                      </div>
                    </div>
                    <h3 className="mt-3 text-xl font-bold leading-tight text-ink">
                      {getServicesText(booking)}
                    </h3>
                    <span className={`mt-2 inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      isSelfDropOff
                        ? "border-violet-200 bg-violet-50 text-violet-800"
                        : "border-sky-200 bg-sky-50 text-sky-800"
                    }`}>
                      {isSelfDropOff ? "Self drop-off & pickup" : "Pickup & delivery"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <div className="flex min-w-0 flex-col rounded-xl border border-line/70 bg-white px-3 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <FiTruck className="h-3.5 w-3.5" /> Vehicle
                      </span>
                      <span className="mt-1.5 truncate text-sm font-semibold text-ink">
                        {getVehicleText(booking)}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-col rounded-xl border border-line/70 bg-white px-3 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <FiCalendar className="h-3.5 w-3.5" /> Created
                      </span>
                      <span className="mt-1.5 text-sm font-semibold leading-5 text-ink">
                        {getCreatedText(booking)}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-col rounded-xl bg-bg-soft px-3 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <FiCreditCard className="h-3.5 w-3.5" /> Online Due
                      </span>
                      <span className="mt-1.5 truncate text-base font-bold text-ink">
                        {formatRupees(onlineAmount)}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-col rounded-xl bg-bg-soft px-3 py-3">
                      <span className="text-xs font-medium text-muted">
                        Service Estimate
                      </span>
                      <span className="mt-1.5 truncate text-base font-bold text-ink">
                        {getServiceRangeText(booking)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 text-sm text-muted">
                    <FiMapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="line-clamp-2">
                      {isSelfDropOff
                        ? "Location used only to find a nearby garage; customer transports the vehicle."
                        : getAddressText(booking)}
                    </span>
                  </div>
                </div>

                {/* Sidebar / Action Area */}
                <aside className="flex w-full flex-col justify-center border-t border-line bg-bg-soft/50 p-5 sm:p-6 lg:w-80 lg:border-l lg:border-t-0">
                  <div className="mb-4">
                    <h4 className="text-base font-bold text-ink">Complete payment</h4>
                    <p className="mt-1 text-sm leading-5 text-muted">
                      Complete the online payment to activate garage search for this booking.
                    </p>
                  </div>

                  <label
                    className={`mb-3 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition ${
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
                      className="mt-0.5 h-5 w-5 rounded border-line accent-black disabled:cursor-not-allowed"
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

                  <div className="mb-3 rounded-xl border border-line bg-white p-3.5 text-xs">
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
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/30 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
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
    </>
  );
}

export { PendingBookings };
