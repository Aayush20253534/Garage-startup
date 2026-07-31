import { useEffect, useMemo, useState } from "react";
import {
  FiArchive,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiTool,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import InspectionGallery from "@/components/booking/InspectionGallery";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { formatRupees } from "@/utils/priceRange";
import { isSelfDropOffService } from "@/utils/serviceFulfillment";

const formatDateTime = (value) => {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value) => {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getVehicleName = (booking) => {
  const vehicle = booking?.vehicle || {};
  return (
    `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
    vehicle.registrationNumber ||
    "Vehicle"
  );
};

const getServiceNames = (booking) =>
  (booking?.services || [])
    .map((item) => item.service?.name)
    .filter(Boolean)
    .join(", ") || "Vehicle service";

const getCompletionDate = (booking) =>
  booking.finalPaymentConfirmedAt ||
  booking.customerAcceptedAt ||
  booking.serviceCompletedAt ||
  booking.updatedAt;

const getPaymentAmount = (booking) =>
  Number(
    booking.finalPaymentAmount ??
      booking.payment?.amount ??
      booking.totalServiceAmount ??
      0,
  );

const getSearchText = (booking) =>
  [
    booking.bookingCode,
    booking.id,
    booking.user?.name,
    booking.user?.phone,
    booking.vehicle?.brand,
    booking.vehicle?.model,
    booking.vehicle?.registrationNumber,
    booking.garageController?.name,
    getServiceNames(booking),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const detailRows = (booking) => [
  ["Booking created", booking.createdAt],
  ["Garage accepted", booking.acceptedAt],
  ["Vehicle handover", booking.handoverOtpVerifiedAt],
  ["Arrived at garage", booking.arrivedAtGarageAt],
  ["Service completed", booking.serviceCompletedAt],
  ["Delivery started", booking.deliveryStartedAt],
  ["Vehicle delivered", booking.deliveredAt],
  ["Payment submitted", booking.finalPaymentSubmittedAt],
  ["Payment confirmed", booking.finalPaymentConfirmedAt],
  ["Customer accepted", booking.customerAcceptedAt],
].filter(([, value]) => value);

function SummaryItem({ icon: Icon, label, value, valueClassName = "" }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-bg-soft p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <Icon className="shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-2 break-words text-sm font-bold text-ink ${valueClassName}`}>
        {value || "Not recorded"}
      </p>
    </div>
  );
}

function ServiceLine({ item, index }) {
  const estimatedMin = Number(item.estimatedMinPrice || item.estimatedPrice || 0);
  const estimatedMax = Number(item.estimatedMaxPrice || item.estimatedPrice || 0);
  const finalPrice = Number(item.finalPrice || 0);

  return (
    <article className="min-w-0 rounded-lg border border-line bg-white p-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold text-ink">
            {index + 1}. {item.service?.name || "Service"}
          </p>
          <p className="mt-1 break-words text-xs text-muted">
            {item.service?.category?.name || "General service"}
            {Number(item.quantity || 1) > 1 ? ` · Qty ${item.quantity}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-extrabold text-ink">
            {finalPrice > 0
              ? formatRupees(finalPrice)
              : estimatedMax > 0
                ? `${formatRupees(estimatedMin)}–${formatRupees(estimatedMax)}`
                : "Price not recorded"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {finalPrice > 0 ? "Final service price" : "Estimated range"}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function GarageServiceHistory() {
  const { garage } = useApp();
  const [history, setHistory] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async ({ append = false, cursor = "" } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const result = await garageApi.getServiceHistory({ cursor, limit: 20 });
      setHistory((current) =>
        append ? [...current, ...(result.items || [])] : result.items || [],
      );
      setNextCursor(result.nextCursor || null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load service history",
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return history;
    return history.filter((booking) =>
      getSearchText(booking).includes(normalizedQuery),
    );
  }, [history, query]);

  const toggleExpanded = (bookingId) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-soft">
        <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line bg-bg-soft text-xl text-ink">
              <FiArchive />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                Garage records
              </p>
              <h1 className="mt-1 break-words text-2xl font-extrabold text-ink">
                Service History
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                {garage?.isControllerSession
                  ? "Completed services assigned to you, including customer details, service prices, payment records, timeline, photos, and videos."
                  : "Every completed service handled by this garage, including assigned controller, customer, vehicle, payment, timeline, photos, and videos."}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadHistory()}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh history
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search booking, customer, phone, vehicle, service or controller"
              className="h-11 w-full min-w-0 rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-muted focus:border-ink"
            />
          </label>
          <p className="shrink-0 text-sm font-semibold text-muted">
            {filteredHistory.length} shown · {history.length} loaded
          </p>
        </div>
      </section>

      {error && (
        <div className="break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-line bg-white px-4 py-12 text-center text-sm text-muted shadow-soft">
          Loading completed service records…
        </div>
      ) : (
        <div className="min-w-0 space-y-4">
          {filteredHistory.map((booking) => {
            const expanded = expandedIds.has(booking.id);
            const inspectionMedia = (booking.inspectionImages || []).map(
              (item) => ({ ...item, imageUrl: resolveMediaUrl(item) }),
            );
            const selfDropOff = isSelfDropOffService(booking);
            const paymentAmount = getPaymentAmount(booking);
            const payment = booking.payment || {};

            return (
              <article
                key={booking.id}
                className="min-w-0 overflow-hidden rounded-xl border border-line bg-white shadow-soft"
              >
                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="break-all text-lg font-extrabold text-ink">
                          {booking.bookingCode || booking.id}
                        </h2>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                          <FiCheckCircle /> COMPLETED
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm text-muted">
                        {getServiceNames(booking)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-muted">
                      {formatDate(getCompletionDate(booking))}
                    </p>
                  </div>

                  <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryItem
                      icon={FiTruck}
                      label="Vehicle"
                      value={`${getVehicleName(booking)}${
                        booking.vehicle?.registrationNumber
                          ? ` · ${booking.vehicle.registrationNumber}`
                          : ""
                      }`}
                    />
                    <SummaryItem
                      icon={FiUser}
                      label="Customer"
                      value={`${booking.user?.name || "Customer"}${
                        booking.user?.phone ? ` · ${booking.user.phone}` : ""
                      }`}
                    />
                    <SummaryItem
                      icon={FiTool}
                      label="Handled by"
                      value={booking.garageController?.name || "Garage owner / central account"}
                    />
                    <SummaryItem
                      icon={FiCreditCard}
                      label="Final amount"
                      value={paymentAmount > 0 ? formatRupees(paymentAmount) : "Not recorded"}
                      valueClassName="text-base"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(booking.id)}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft sm:w-auto"
                    aria-expanded={expanded}
                  >
                    {expanded ? <FiChevronUp /> : <FiChevronDown />}
                    {expanded ? "Hide full record" : "View complete service record"}
                  </button>
                </div>

                {expanded && (
                  <div className="min-w-0 space-y-5 border-t border-line bg-bg-soft/60 p-4 sm:p-5">
                    <section className="min-w-0 rounded-xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2">
                        <FiTool className="shrink-0" />
                        <h3 className="font-bold text-ink">Services performed</h3>
                      </div>
                      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
                        {(booking.services || []).map((item, index) => (
                          <ServiceLine key={item.id || index} item={item} index={index} />
                        ))}
                      </div>
                    </section>

                    <section className="min-w-0 rounded-xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2">
                        <FiFileText className="shrink-0" />
                        <h3 className="font-bold text-ink">Booking and payment details</h3>
                      </div>
                      <dl className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["Fulfilment", selfDropOff ? "Customer self drop-off" : "Pickup and delivery"],
                          ["Request type", booking.requestType || "NORMAL"],
                          ["Payment method", booking.finalPaymentMethod || payment.status || "Not recorded"],
                          ["Payment status", payment.status || (booking.finalPaymentConfirmedAt ? "CONFIRMED" : "Not recorded")],
                          ["Service total", formatRupees(Number(booking.totalServiceAmount || 0))],
                          ["Maximum estimate", formatRupees(Number(booking.totalServiceMaxAmount || 0))],
                          ["Handling fee", formatRupees(Number(booking.handlingFee || 0))],
                          ["Customer wallet used", formatRupees(Number(booking.walletAmountUsed || 0))],
                          ["Scheduled date", formatDateTime(booking.scheduledDate)],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0 rounded-lg border border-line bg-bg-soft p-3">
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
                              {label}
                            </dt>
                            <dd className="mt-1 break-words text-sm font-semibold text-ink">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {(payment.cashfreeOrderId || payment.cashfreePaymentId) && (
                        <div className="mt-3 min-w-0 rounded-lg border border-line bg-bg-soft p-3 text-xs text-muted">
                          {payment.cashfreeOrderId && (
                            <p className="break-all">
                              <strong className="text-ink">Cashfree order:</strong>{" "}
                              {payment.cashfreeOrderId}
                            </p>
                          )}
                          {payment.cashfreePaymentId && (
                            <p className="mt-1 break-all">
                              <strong className="text-ink">Cashfree payment:</strong>{" "}
                              {payment.cashfreePaymentId}
                            </p>
                          )}
                        </div>
                      )}
                    </section>

                    <section className="min-w-0 rounded-xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2">
                        <FiUser className="shrink-0" />
                        <h3 className="font-bold text-ink">Customer, vehicle and notes</h3>
                      </div>
                      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
                        <div className="min-w-0 space-y-2 text-sm">
                          <p className="break-words"><strong>Customer:</strong> {booking.user?.name || "Not recorded"}</p>
                          <p className="break-all"><strong>Phone:</strong> {booking.user?.phone || "Not recorded"}</p>
                          <p className="break-all"><strong>Email:</strong> {booking.user?.email || "Not recorded"}</p>
                          <p className="break-words"><strong>Address:</strong> {booking.customerAddress || "Not recorded"}</p>
                        </div>
                        <div className="min-w-0 space-y-2 text-sm">
                          <p className="break-words"><strong>Vehicle:</strong> {getVehicleName(booking)}</p>
                          <p className="break-all"><strong>Registration:</strong> {booking.vehicle?.registrationNumber || "Not recorded"}</p>
                          <p className="break-words"><strong>Fuel type:</strong> {booking.vehicle?.fuelType || "Not recorded"}</p>
                          <p className="break-words"><strong>Controller:</strong> {booking.garageController?.name || "Central garage account"}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
                        <div className="min-w-0 rounded-lg border border-line bg-bg-soft p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Customer note</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{booking.customerNote || "No customer note"}</p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-line bg-bg-soft p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Garage note</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{booking.garageNote || "No garage note"}</p>
                        </div>
                      </div>
                    </section>

                    <section className="min-w-0 rounded-xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2">
                        <FiClock className="shrink-0" />
                        <h3 className="font-bold text-ink">Service timeline</h3>
                      </div>
                      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {detailRows(booking).map(([label, value]) => (
                          <div key={label} className="min-w-0 rounded-lg border border-line bg-bg-soft p-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
                            <p className="mt-1 break-words text-sm font-semibold text-ink">{formatDateTime(value)}</p>
                          </div>
                        ))}
                      </div>

                      {(booking.events || []).length > 0 && (
                        <div className="mt-5 min-w-0 space-y-3 border-t border-line pt-4">
                          <h4 className="text-sm font-bold text-ink">Recorded activity</h4>
                          {(booking.events || []).map((event) => (
                            <div key={event.id} className="min-w-0 rounded-lg border border-line bg-bg-soft p-3">
                              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <p className="break-words text-sm font-bold text-ink">{event.title || event.eventType}</p>
                                <p className="shrink-0 text-xs text-muted">{formatDateTime(event.createdAt)}</p>
                              </div>
                              {event.detail && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted">{event.detail}</p>}
                              {(event.actorName || event.actorRole) && (
                                <p className="mt-1 break-words text-[11px] font-semibold text-muted">
                                  By {event.actorName || "System"}{event.actorRole ? ` · ${event.actorRole}` : ""}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <InspectionGallery
                      images={inspectionMedia}
                      phase="PICKUP"
                      title={selfDropOff ? "Drop-off inspection photos and videos" : "Pickup inspection photos and videos"}
                      description="Evidence captured before service work began. Select a photo to open the full image; videos play directly in the record."
                      emptyMessage="No pre-service inspection media was recorded for this booking."
                    />

                    <InspectionGallery
                      images={inspectionMedia}
                      phase="DELIVERY"
                      title={selfDropOff ? "Post-service photos and videos" : "Delivery photos and videos"}
                      description="Evidence captured after the work was completed."
                      emptyMessage="No post-service inspection media was recorded for this booking."
                    />

                    {booking.review && (
                      <section className="min-w-0 rounded-xl border border-line bg-white p-4">
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="font-bold text-ink">Customer review</h3>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">
                              {booking.review.comment || "No written review"}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-extrabold text-amber-800">
                            {Number(booking.review.rating || 0).toFixed(1)} / 5
                          </span>
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {!filteredHistory.length && (
            <div className="rounded-xl border border-dashed border-line bg-white px-4 py-12 text-center shadow-soft">
              <FiArchive className="mx-auto text-3xl text-muted" />
              <h2 className="mt-3 font-bold text-ink">
                {query ? "No matching service record" : "No completed services yet"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {query
                  ? "Try another booking code, customer, vehicle, service or controller name."
                  : "Completed bookings will appear here with their full service evidence."}
              </p>
            </div>
          )}

          {nextCursor && !query && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() =>
                void loadHistory({ append: true, cursor: nextCursor })
              }
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink shadow-soft transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiCalendar />
              {loadingMore ? "Loading more history…" : "Load older service records"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
