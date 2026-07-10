import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiCreditCard,
  FiMapPin,
  FiTruck,
  FiUser,
  FiX,
} from "react-icons/fi";
import { formatRupees } from "@/utils/priceRange";

const statusColors = {
  NEW: "border-yellow-200 bg-yellow-50 text-yellow-700",
  SENT: "border-yellow-200 bg-yellow-50 text-yellow-700",
  ACCEPTED: "border-blue-200 bg-blue-50 text-blue-700",
  CONFIRMED: "border-blue-200 bg-blue-50 text-blue-700",
  IN_PROGRESS: "border-brand/40 bg-brand/10 text-ink",
  VEHICLE_RECEIVED: "border-purple-200 bg-purple-50 text-purple-700",
  SERVICE_STARTED: "border-brand/40 bg-brand/10 text-ink",
  INSPECTION_COMPLETED: "border-pink-200 bg-pink-50 text-pink-700",
  READY_FOR_DELIVERY: "border-green-200 bg-green-50 text-green-700",
  DELIVERED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  COMPLETED: "border-green-200 bg-green-50 text-green-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  EXPIRED: "border-slate-200 bg-slate-50 text-slate-600",
};

const getServicesText = (booking) =>
  Array.isArray(booking.services)
    ? booking.services.map((service) => service.name).filter(Boolean).join(", ")
    : "";

const getVehicleText = (booking) => {
  const vehicle = booking.vehicle || {};

  return (
    `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
    vehicle.number ||
    "Vehicle"
  );
};

const getCustomerText = (booking) =>
  booking.customer?.name || booking.customer?.phone || "Customer";

const getStatusText = (status) => String(status || "UNKNOWN").replaceAll("_", " ");

export default function BookingCard({
  booking,
  onAccept,
  onDecline,
  walletBalance = null,
  onRecharge,
}) {
  const navigate = useNavigate();
  const isNewBooking = booking.status === "NEW" || booking.status === "SENT";
  const acceptFee = Number(booking.acceptFee || 0);
  const numericWalletBalance = Number(walletBalance);
  const hasWalletBalance = Number.isFinite(numericWalletBalance);
  const needsRecharge =
    isNewBooking &&
    acceptFee > 0 &&
    hasWalletBalance &&
    numericWalletBalance < acceptFee;
  const servicesText = getServicesText(booking) || "Service request";
  const statusText = getStatusText(booking.status);
  const bookingLabel = booking.bookingCode || booking.bookingId || booking.id;
  const distanceText = Number.isFinite(Number(booking.distance))
    ? `${Number(booking.distance || 0).toFixed(1)} km away`
    : "Distance unavailable";

  const openBooking = () => {
    navigate(`/garage/bookings/${booking.id}`);
  };

  const handleAccept = (event) => {
    event.stopPropagation();
    if (needsRecharge) {
      onRecharge?.();
      return;
    }
    onAccept?.(booking);
  };

  const handleDecline = (event) => {
    event.stopPropagation();
    onDecline?.(booking);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-lg border border-line bg-white shadow-sm transition hover:border-ink/15 hover:shadow-md"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_220px]">
        <button
          type="button"
          onClick={openBooking}
          className="min-w-0 p-4 text-left sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="break-words text-xs font-medium leading-snug text-muted">
                #{bookingLabel}
              </div>

              <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-ink">
                {servicesText}
              </h3>
            </div>

            <span
              className={[
                "inline-flex h-7 w-fit shrink-0 items-center rounded-md border px-2.5 text-[11px] font-bold",
                statusColors[booking.status] || "border-slate-200 bg-slate-50 text-slate-600",
              ].join(" ")}
            >
              {statusText}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
              <FiTruck className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase text-muted">
                  Vehicle
                </p>
                <p className="truncate font-medium text-ink">
                  {getVehicleText(booking)}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
              <FiUser className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase text-muted">
                  Customer
                </p>
                <p className="truncate font-medium text-ink">
                  {getCustomerText(booking)}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
              <FiMapPin className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase text-muted">
                  Distance
                </p>
                <p className="truncate font-medium text-ink">{distanceText}</p>
              </div>
            </div>
          </div>
        </button>

        <aside className="flex flex-col justify-center border-t border-line bg-bg-soft/50 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="mb-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <FiCreditCard className="h-3.5 w-3.5" />
              Estimated amount
            </p>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatRupees(booking.estimatedBill || 0)}
            </p>
          </div>

          {isNewBooking && acceptFee > 0 && (
            <div
              className={[
                "mb-3 rounded-md border px-3 py-2 text-xs leading-5",
                needsRecharge
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-green-200 bg-green-50 text-green-700",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <FiAlertCircle className="mt-0.5 shrink-0" />
                <span>
                  Accept fee: <strong>{formatRupees(acceptFee)}</strong>
                  {hasWalletBalance ? (
                    <>
                      {" "}
                      - Wallet: <strong>{formatRupees(numericWalletBalance)}</strong>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
          )}

          {isNewBooking && onAccept && onDecline ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleAccept}
                className={[
                  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white transition disabled:opacity-60",
                  needsRecharge
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-green-600 hover:bg-green-700",
                ].join(" ")}
              >
                <FiCheck className="h-4 w-4" />
                {needsRecharge ? "Recharge" : "Accept"}
              </button>

              <button
                type="button"
                onClick={handleDecline}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-600 px-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <FiX className="h-4 w-4" />
                Decline
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openBooking}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-ink px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-2"
            >
              View Details
              <FiArrowRight className="h-4 w-4" />
            </button>
          )}
        </aside>
      </div>
    </motion.article>
  );
}
