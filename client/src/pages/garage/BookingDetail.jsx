import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  FiPhone,
  FiMessageSquare,
  FiMapPin,
  FiClock,
  FiCheckCircle,
  FiNavigation,
} from "react-icons/fi";
import ImageUpload from "@/components/garage/ImageUpload";
import InspectionGallery from "@/components/booking/InspectionGallery";
import LiveBookingTracking from "@/components/maps/LiveBookingTracking";
import EmbedMap from "@/components/maps/EmbedMap";
import { setBookings } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";
import { formatRupees } from "@/utils/priceRange";

const timelineSteps = [
  { status: "NEW", label: "Request Sent" },
  { status: "ACCEPTED", label: "Booking Accepted" },
  { status: "CONFIRMED", label: "Vehicle Handover" },
  { status: "IN_PROGRESS", label: "Service In Progress" },
  { status: "DELIVERED", label: "Awaiting Customer Acceptance" },
  { status: "COMPLETED", label: "Completed" },
];


const getWhatsappUrl = (phone) => {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length > 10) digits = digits.replace(/^0+/, "");

  return digits ? `https://wa.me/${digits}` : null;
};

const formatDateTime = (value) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const ARRIVAL_UNLOCK_DISTANCE_METERS = 200;
const CUSTOMER_ACCEPTANCE_POLL_INTERVAL_MS = 3000;
const GARAGE_DASHBOARD_PATH = "/garage";

const toRad = (value) => (Number(value) * Math.PI) / 180;

const getDistanceMeters = (origin, destination) => {
  const lat1 = Number(origin?.latitude);
  const lon1 = Number(origin?.longitude);
  const lat2 = Number(destination?.latitude);
  const lon2 = Number(destination?.longitude);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters)) return "Waiting for live location";
  if (meters < 1000) return `${meters} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
};

export default function GarageBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { garageToken } = useApp();
  const { bookings } = useSelector((state) => state.garage);
  const [preServiceImages, setPreServiceImages] = useState([]);
  const [postServiceImages, setPostServiceImages] = useState([]);
  const [otp, setOtp] = useState("");
  const [trackingSummary, setTrackingSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remoteBooking, setRemoteBooking] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const cachedBooking = bookings.find(
    (item) => item.id === id || item.requestId === id || item.bookingId === id,
  );
  const booking = cachedBooking || remoteBooking;

  const handleTrackingUpdate = useCallback((tracking) => {
    setTrackingSummary(tracking);
  }, []);

  const mergeBookingIntoStore = useCallback(
    (updatedBooking) => {
      setRemoteBooking(updatedBooking);
      dispatch(
        setBookings(
          bookings.some(
            (item) =>
              item.id === updatedBooking.id ||
              item.requestId === updatedBooking.requestId ||
              item.bookingId === updatedBooking.bookingId,
          )
            ? bookings.map((item) =>
                item.id === updatedBooking.id ||
                item.requestId === updatedBooking.requestId ||
                item.bookingId === updatedBooking.bookingId
                  ? updatedBooking
                  : item,
              )
            : [updatedBooking, ...bookings],
        ),
      );
    },
    [bookings, dispatch],
  );

  useEffect(() => {
    let mounted = true;

    const loadBookingDetail = async () => {
      if (cachedBooking || !garageToken || !id) return;

      setDetailLoading(true);
      setError("");

      try {
        const fetchedBooking = await garageApi.getRequest(id);

        if (!mounted) return;

        mergeBookingIntoStore(fetchedBooking);
      } catch (err) {
        if (mounted) {
          setError(
            err.response?.data?.message ||
              "Unable to load this booking. It may no longer belong to your garage.",
          );
        }
      } finally {
        if (mounted) setDetailLoading(false);
      }
    };

    loadBookingDetail();

    return () => {
      mounted = false;
    };
  }, [cachedBooking, garageToken, id, mergeBookingIntoStore]);

  useEffect(() => {
    if (!booking) return;

    if (booking.status === "COMPLETED" || booking.customerAcceptedAt) {
      if (booking.status !== "COMPLETED") {
        mergeBookingIntoStore({ ...booking, status: "COMPLETED" });
      }

      navigate(GARAGE_DASHBOARD_PATH, {
        replace: true,
        state: { message: "Booking completed by customer." },
      });
    }
  }, [
    booking,
    booking?.customerAcceptedAt,
    booking?.status,
    mergeBookingIntoStore,
    navigate,
  ]);

  useEffect(() => {
    const waitingForCustomerAcceptance = Boolean(
      booking?.deliveredAt &&
        !booking.customerAcceptedAt &&
        booking.status !== "COMPLETED",
    );

    if (!waitingForCustomerAcceptance || !garageToken) return undefined;

    let cancelled = false;

    const refreshCompletionStatus = async () => {
      try {
        const refreshedBooking = await garageApi.getRequest(
          booking.requestId || booking.id,
        );

        if (cancelled) return;

        if (
          refreshedBooking.status === "COMPLETED" ||
          refreshedBooking.customerAcceptedAt
        ) {
          mergeBookingIntoStore({
            ...refreshedBooking,
            status: "COMPLETED",
          });
          navigate(GARAGE_DASHBOARD_PATH, {
            replace: true,
            state: { message: "Booking completed by customer." },
          });
        }
      } catch {
        // Keep the delivered screen usable if a silent completion refresh fails.
      }
    };

    void refreshCompletionStatus();
    const interval = window.setInterval(
      refreshCompletionStatus,
      CUSTOMER_ACCEPTANCE_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    booking?.customerAcceptedAt,
    booking?.deliveredAt,
    booking?.id,
    booking?.requestId,
    booking?.status,
    garageToken,
    mergeBookingIntoStore,
    navigate,
  ]);

  if (!booking) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/garage/bookings")}
          className="text-muted hover:text-ink"
        >
          Back to Bookings
        </button>
        <div className="card-soft p-6 text-muted">
          {detailLoading
            ? "Loading booking details..."
            : error ||
              "Booking not found. Open it from the bookings list after refreshing."}
        </div>
      </div>
    );
  }

  const updateLocalBooking = (patch) => {
    const updatedBooking = { ...booking, ...patch };

    mergeBookingIntoStore(updatedBooking);
  };

  const verifyHandover = async () => {
    if (!isNearCustomer || preServiceImages.length !== 5 || !otp.trim()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await garageApi.verifyHandoverOtp(
        garageToken,
        booking.requestId || booking.id,
        otp.trim(),
        preServiceImages,
      );

      updateLocalBooking({
        status: "IN_PROGRESS",
        inspectionImages:
          result?.booking?.inspectionImages || booking.inspectionImages || [],
      });
      setOtp("");
      setPreServiceImages([]);
      setSuccess("Vehicle handover verified and service started.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify handover OTP");
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async () => {
    if (postServiceImages.length !== 5) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await garageApi.markDelivered(
        garageToken,
        booking.requestId || booking.id,
        postServiceImages,
      );

      updateLocalBooking({
        status: "DELIVERED",
        deliveredAt: result?.booking?.deliveredAt || new Date().toISOString(),
        totalServiceAmount:
          result?.booking?.totalServiceAmount || booking.totalServiceAmount,
        totalServiceMaxAmount:
          result?.booking?.totalServiceMaxAmount || booking.totalServiceMaxAmount,
        inspectionImages:
          result?.booking?.inspectionImages || booking.inspectionImages || [],
      });
      setPostServiceImages([]);
      setSuccess(
        "Vehicle marked delivered. The customer must now inspect, enter the final amount, and accept delivery.",
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to mark booking delivered",
      );
    } finally {
      setLoading(false);
    }
  };

  const openGoogleMaps = () => {
    const { lat, lng } = booking.customer.location || {};

    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    }
  };

  const currentStepIndex = Math.max(
    0,
    timelineSteps.findIndex((step) => step.status === booking.status),
  );
  const inspectionImages = booking.inspectionImages || [];
  const isCompletedByCustomer =
    booking.status === "COMPLETED" || Boolean(booking.customerAcceptedAt);
  const isAwaitingCustomerAcceptance =
    booking.status === "DELIVERED" && !booking.customerAcceptedAt;
  const bookingDisplayId =
    booking.bookingCode || booking.bookingId || booking.id;
  const isHandoverStage = ["ACCEPTED", "CONFIRMED"].includes(booking.status);
  const liveTrackingEnabled = ["ACCEPTED", "CONFIRMED", "IN_PROGRESS", "DELIVERED"].includes(booking.status);
  const distanceToCustomerMeters =
    getDistanceMeters(
      trackingSummary?.latestLocation,
      trackingSummary?.customerLocation,
    ) ??
    (Number.isFinite(Number(trackingSummary?.route?.distanceMeters))
      ? Math.round(Number(trackingSummary.route.distanceMeters))
      : null);
  const isNearCustomer =
    Number.isFinite(distanceToCustomerMeters) &&
    distanceToCustomerMeters <= ARRIVAL_UNLOCK_DISTANCE_METERS;
  const hasCompleteOtp = otp.length === 6;

  if (isCompletedByCustomer) {
    return (
      <div className="card-soft p-6 text-sm font-semibold text-muted">
        Opening garage dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/garage/bookings")}
        className="flex items-center gap-2 text-muted hover:text-ink"
      >
        Back to Bookings
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 p-4 text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="card-soft p-5 sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Booking status
                </p>
                <h1 className="mt-1 break-words text-2xl font-bold leading-tight sm:text-3xl">
                  {bookingDisplayId}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {new Date(booking.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="chip-brand shrink-0">
                {booking.status.replaceAll("_", " ")}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-bg-soft p-4">
                <h3 className="mb-3 font-bold">Vehicle Details</h3>
                <div className="space-y-2 text-sm leading-6">
                  <p>
                    <span className="text-muted">Make & Model:</span>{" "}
                    {booking.vehicle.brand} {booking.vehicle.model}
                  </p>
                  <p>
                    <span className="text-muted">Year:</span>{" "}
                    {booking.vehicle.year || "N/A"}
                  </p>
                  <p>
                    <span className="text-muted">Number:</span>{" "}
                    {booking.vehicle.number || "N/A"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-bg-soft p-4">
                <h3 className="mb-3 font-bold">Services</h3>
                <div className="space-y-2 text-sm">
                  {booking.services.map((service, index) => (
                    <div
                      key={service.id || index}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4"
                    >
                      <span className="min-w-0">{service.name}</span>
                      <span className="font-semibold">
                        {formatRupees(service.price || 0)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3 border-t border-line pt-3">
                    <div className="flex justify-between font-bold">
                      <span>Estimated Total</span>
                      <span>
                        {formatRupees(booking.estimatedBill || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {liveTrackingEnabled && (
            <LiveBookingTracking
              bookingId={booking.bookingId}
              canShare
              autoStart
              onTrackingUpdate={handleTrackingUpdate}
              title="Live route to customer"
            />
          )}

          {isHandoverStage ? (
            <div className="card-soft p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold">Receive Vehicle</h3>
                  <p className="mt-1 text-sm text-muted">
                    Share live location first. The handover OTP unlocks when
                    you are within {ARRIVAL_UNLOCK_DISTANCE_METERS}m of the
                    customer location.
                  </p>
                </div>
                <span
                  className={[
                    "inline-flex h-8 w-fit items-center rounded-lg px-3 text-xs font-bold",
                    isNearCustomer
                      ? "bg-brand text-black"
                      : "bg-bg-soft text-muted",
                  ].join(" ")}
                >
                  {formatDistance(distanceToCustomerMeters)}
                </span>
              </div>

              {!isNearCustomer ? (
                <div className="mt-5 rounded-xl border border-line bg-bg-soft p-4 text-sm text-muted">
                  <div className="flex items-start gap-3">
                    <FiNavigation className="mt-0.5 shrink-0 text-brand-dark" />
                    <p>
                      Keep live sharing on and navigate to the customer. The OTP
                      box appears automatically once you are very close.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-4 text-xs text-muted">
                    OTP expiry: {formatDateTime(booking.handoverOtpExpiresAt)}.
                    The customer can generate a new OTP from booking tracking if
                    needed.
                  </p>
                  <input
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit handover OTP"
                    className="mt-4 w-full rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
                  />

                  {hasCompleteOtp && (
                    <div className="mt-4">
                      <p className="mb-3 text-sm text-muted">
                        Upload exactly five pickup photos after entering the
                        OTP. Each photo must be 1 MB or less.
                      </p>
                      <ImageUpload
                        min={5}
                        max={5}
                        value={preServiceImages}
                        onChange={setPreServiceImages}
                      />
                    </div>
                  )}

                  <button
                    onClick={verifyHandover}
                    disabled={
                      loading ||
                      !hasCompleteOtp ||
                      preServiceImages.length !== 5
                    }
                    className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Verifying..." : "Verify Handover & Start Service"}
                  </button>
                </>
              )}
            </div>
          ) : null}

          {booking.status === "IN_PROGRESS" && !booking.deliveredAt ? (
            <div className="card-soft p-6">
              <h3 className="mb-2 text-xl font-bold">Complete Service</h3>
              <p className="mb-4 text-muted">
                Upload exactly five post-service photos, each 1 MB or less.
                The customer enters the final amount while accepting delivery.
              </p>
              <ImageUpload
                min={5}
                max={5}
                value={postServiceImages}
                onChange={setPostServiceImages}
              />
              <button
                onClick={markDelivered}
                disabled={
                  loading ||
                  postServiceImages.length !== 5
                }
                className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Completing..." : "Mark Ready for Customer"}
              </button>
            </div>
          ) : null}

          {isAwaitingCustomerAcceptance && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              The vehicle is marked delivered. This booking becomes completed
              only after the customer receives the vehicle and accepts delivery.
            </div>
          )}

          {inspectionImages.some((image) => image.phase === "PICKUP") && (
            <InspectionGallery
              images={inspectionImages}
              phase="PICKUP"
              title="Pickup inspection photos"
              description="Evidence recorded before the garage started service."
            />
          )}

          {inspectionImages.some((image) => image.phase === "DELIVERY") && (
            <InspectionGallery
              images={inspectionImages}
              phase="DELIVERY"
              title="Delivery inspection photos"
              description="Evidence recorded after the service was completed."
            />
          )}

          <div className="card-soft p-6">
            <h3 className="mb-4 text-xl font-bold">Live Timeline</h3>
            <div className="space-y-4">
              {timelineSteps
                .slice(0, currentStepIndex + 1)
                .map((step, index) => (
                  <div key={step.status} className="flex gap-4">
                    <div
                      className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center ${
                        index === currentStepIndex
                          ? "bg-brand text-black"
                          : "bg-line text-muted"
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <FiCheckCircle />
                      ) : (
                        <FiClock />
                      )}
                    </div>
                    <div className="-ml-1 mt-1 border-l-2 border-line pb-4 pl-4">
                      <p className="font-semibold">{step.label}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-soft p-6">
            <h3 className="mb-4 font-bold">Customer Details</h3>
            <div className="mb-4 space-y-3 text-sm">
              <p>
                <span className="text-muted">Name:</span>{" "}
                <span className="font-semibold">{booking.customer.name}</span>
              </p>
              <p>
                <span className="text-muted">Phone:</span>{" "}
                <span className="font-semibold">
                  {booking.customer.phone || "N/A"}
                </span>
              </p>
              <p>
                <span className="text-muted">Address:</span>{" "}
                <span className="font-semibold">
                  {booking.customer.address || "N/A"}
                </span>
              </p>
            </div>
            <EmbedMap
              latitude={booking.customer.location?.lat}
              longitude={booking.customer.location?.lng}
              height={220}
              title="Customer service destination"
              className="mb-4"
            />
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  booking.customer.phone &&
                  window.open(`tel:${booking.customer.phone}`, "_blank")
                }
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft"
              >
                <FiPhone className="h-5 w-5" />
                <span className="text-xs font-semibold">Call</span>
              </button>
              <button
                onClick={() =>
                  getWhatsappUrl(booking.customer.phone) &&
                  window.open(
                    getWhatsappUrl(booking.customer.phone),
                    "_blank",
                  )
                }
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft"
              >
                <FiMessageSquare className="h-5 w-5" />
                <span className="text-xs font-semibold">WhatsApp</span>
              </button>
              <button
                onClick={openGoogleMaps}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-3 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark"
              >
                <FiMapPin className="h-5 w-5" />
                <span className="text-xs font-semibold">Navigate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
