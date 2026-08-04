import { useCallback, useEffect, useRef, useState } from "react";
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
import VideoUpload from "@/components/garage/VideoUpload";
import EvidenceUploadProgress from "@/components/garage/EvidenceUploadProgress";
import InspectionGallery from "@/components/booking/InspectionGallery";
import LiveBookingTracking from "@/components/maps/LiveBookingTracking";
import MapPanel from "@/components/maps/MapPanel";
import { setBookings } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";
import { formatRupees } from "@/utils/priceRange";
import { getBookingTimelineState } from "@/utils/bookingTimeline";
import { isSelfDropOffService } from "@/utils/serviceFulfillment";
import WorkerTaskManager from "@/components/garage/WorkerTaskManager";
import BookingElapsedTimer from "@/components/booking/BookingElapsedTimer";
import useAutoScrollToNextTask from "@/hooks/useAutoScrollToNextTask";



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

const GARAGE_INSPECTION_PHOTO_MAX_SIZE_MB = 5;
const ARRIVAL_UNLOCK_DISTANCE_METERS = 300;
const BOOKING_FLOW_POLL_INTERVAL_MS = 3000;
const GARAGE_DASHBOARD_PATH = "/garage";

const getEvidenceFileSize = (item) =>
  Number(item?.file?.size || item?.size || 0);

const getEvidenceTotalBytes = (images = [], video = null) =>
  images.reduce((total, item) => total + getEvidenceFileSize(item), 0) +
  getEvidenceFileSize(video);

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

const getGarageActionKey = (booking) => {
  if (
    !booking ||
    booking.status === "COMPLETED" ||
    booking.finalPaymentConfirmedAt
  ) {
    return "";
  }

  const selfDropOff = isSelfDropOffService(booking);
  const handoverStage = ["ACCEPTED", "CONFIRMED"].includes(booking.status);

  if (
    booking.finalPaymentSubmittedAt &&
    !booking.finalPaymentConfirmedAt
  ) {
    return "confirm-payment";
  }
  if (booking.deliveredAt && !booking.finalPaymentSubmittedAt) {
    return "awaiting-payment";
  }
  if (!selfDropOff && booking.serviceCompletedAt && !booking.deliveredAt) {
    return "delivery";
  }
  if (
    booking.status === "IN_PROGRESS" &&
    booking.arrivedAtGarageAt &&
    !booking.serviceCompletedAt
  ) {
    return "service";
  }
  if (
    !selfDropOff &&
    booking.handoverOtpVerifiedAt &&
    !booking.arrivedAtGarageAt &&
    !booking.serviceCompletedAt
  ) {
    return "return-to-garage";
  }
  if (handoverStage) return "handover";

  return "";
};

export default function GarageBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { garageToken, garage } = useApp();
  const { bookings } = useSelector((state) => state.garage);
  const [preServiceImages, setPreServiceImages] = useState([]);
  const [preServiceVideo, setPreServiceVideo] = useState(null);
  const [postServiceImages, setPostServiceImages] = useState([]);
  const [postServiceVideo, setPostServiceVideo] = useState(null);
  const [otp, setOtp] = useState("");
  const [trackingSummary, setTrackingSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remoteBooking, setRemoteBooking] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [evidenceUpload, setEvidenceUpload] = useState(null);
  const handoverTaskRef = useRef(null);
  const returnJourneyTaskRef = useRef(null);
  const serviceTaskRef = useRef(null);
  const deliveryTaskRef = useRef(null);
  const awaitingPaymentTaskRef = useRef(null);
  const confirmPaymentTaskRef = useRef(null);

  const cachedBooking = bookings.find(
    (item) => item.id === id || item.requestId === id || item.bookingId === id,
  );
  const booking = cachedBooking || remoteBooking;

  const garageActionKey = getGarageActionKey(booking);
  const garageActionRef =
    garageActionKey === "handover"
      ? handoverTaskRef
      : garageActionKey === "return-to-garage"
        ? returnJourneyTaskRef
        : garageActionKey === "service"
          ? serviceTaskRef
          : garageActionKey === "delivery"
            ? deliveryTaskRef
            : garageActionKey === "awaiting-payment"
              ? awaitingPaymentTaskRef
              : garageActionKey === "confirm-payment"
                ? confirmPaymentTaskRef
                : null;

  useAutoScrollToNextTask(garageActionKey, garageActionRef, {
    ready:
      Boolean(booking) && !detailLoading && !loading && !evidenceUpload,
  });

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

    if (booking.status === "COMPLETED" || booking.finalPaymentConfirmedAt) {
      navigate(GARAGE_DASHBOARD_PATH, {
        replace: true,
        state: { message: "Payment confirmed and booking completed." },
      });
    }
  }, [booking, booking?.finalPaymentConfirmedAt, booking?.status, navigate]);

  useEffect(() => {
    setTrackingSummary(null);
  }, [
    booking?.arrivedAtGarageAt,
    booking?.deliveredAt,
    booking?.handoverOtpVerifiedAt,
    booking?.serviceCompletedAt,
  ]);

  useEffect(() => {
    const shouldPoll = Boolean(
      booking?.status === "IN_PROGRESS" &&
        (booking.serviceCompletedAt || booking.deliveredAt),
    );

    if (!shouldPoll || !garageToken) return undefined;

    let cancelled = false;

    const refreshFlowStatus = async () => {
      try {
        const refreshedBooking = await garageApi.getRequest(
          booking.requestId || booking.id,
        );
        if (!cancelled) mergeBookingIntoStore(refreshedBooking);
      } catch {
        // Keep the operational controls usable if a silent refresh fails.
      }
    };

    void refreshFlowStatus();
    const interval = window.setInterval(
      refreshFlowStatus,
      BOOKING_FLOW_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    booking?.deliveredAt,
    booking?.id,
    booking?.requestId,
    booking?.serviceCompletedAt,
    booking?.status,
    garageToken,
    mergeBookingIntoStore,
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

  const applyLifecycleResult = (result, fallbackPatch = {}) => {
    const updatedBooking = result?.booking || result;
    if (updatedBooking?.id) {
      mergeBookingIntoStore(
        updatedBooking.requestId
          ? updatedBooking
          : { ...booking, ...updatedBooking, ...fallbackPatch },
      );
      return;
    }
    updateLocalBooking(fallbackPatch);
  };

  const beginEvidenceUpload = (label) => {
    setEvidenceUpload({
      label,
      progress: 0,
      stage: "uploading",
    });
  };

  const createEvidenceProgressHandler = (images, video) => {
    const expectedTotalBytes = getEvidenceTotalBytes(images, video);

    return (event) => {
      const loaded = Number(event?.loaded || 0);
      const total = Number(event?.total || expectedTotalBytes || 0);
      const progress =
        total > 0
          ? Math.min(100, Math.round((loaded / total) * 100))
          : 0;

      setEvidenceUpload((current) => {
        if (!current) return current;

        return {
          ...current,
          progress: Math.max(current.progress || 0, progress),
          stage: progress >= 100 ? "verifying" : "uploading",
        };
      });
    };
  };

  const markEvidenceFinalizing = async () => {
    setEvidenceUpload((current) =>
      current
        ? {
            ...current,
            progress: 100,
            stage: "finalizing",
          }
        : current,
    );

    await new Promise((resolve) => window.setTimeout(resolve, 350));
  };

  const verifyHandover = async () => {
    const validImageCount =
      preServiceImages.length >= 5 && preServiceImages.length <= 15;
    if (
      isSelfDropOff ||
      !isNearDestination ||
      !validImageCount ||
      !preServiceVideo ||
      !otp.trim()
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    beginEvidenceUpload("Pickup inspection evidence");

    try {
      const result = await garageApi.verifyHandoverOtp(
        booking.requestId || booking.id,
        otp.trim(),
        preServiceImages,
        preServiceVideo,
        {
          onUploadProgress: createEvidenceProgressHandler(
            preServiceImages,
            preServiceVideo,
          ),
        },
      );

      await markEvidenceFinalizing();
      applyLifecycleResult(result, {
        status: "IN_PROGRESS",
        handoverOtpVerifiedAt: new Date().toISOString(),
        arrivedAtGarageAt: null,
      });
      setOtp("");
      setPreServiceImages([]);
      setPreServiceVideo(null);
      setSuccess(
        "Vehicle handover verified. Keep live tracking on while returning to the garage.",
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify handover OTP");
    } finally {
      setLoading(false);
      setEvidenceUpload(null);
    }
  };

  const confirmSelfDropArrival = async () => {
    const validImageCount =
      preServiceImages.length >= 5 && preServiceImages.length <= 15;
    if (!isSelfDropOff || !isNearDestination || !validImageCount || !preServiceVideo) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    beginEvidenceUpload("Arrival inspection evidence");

    try {
      const result = await garageApi.confirmSelfDropArrival(
        booking.requestId || booking.id,
        preServiceImages,
        preServiceVideo,
        {
          onUploadProgress: createEvidenceProgressHandler(
            preServiceImages,
            preServiceVideo,
          ),
        },
      );

      await markEvidenceFinalizing();
      applyLifecycleResult(result, {
        status: "IN_PROGRESS",
        arrivedAtGarageAt: new Date().toISOString(),
      });
      setPreServiceImages([]);
      setPreServiceVideo(null);
      setSuccess(
        "Customer arrival confirmed. The travel timer stopped and service can begin.",
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to confirm the self drop-off arrival.",
      );
    } finally {
      setLoading(false);
      setEvidenceUpload(null);
    }
  };

  const markArrivedAtGarage = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await garageApi.markArrivedAtGarage(
        booking.requestId || booking.id,
      );
      applyLifecycleResult(result, {
        arrivedAtGarageAt: new Date().toISOString(),
      });
      setSuccess("Vehicle arrival at the garage confirmed. Service work can begin.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to confirm that the vehicle reached the garage.",
      );
    } finally {
      setLoading(false);
    }
  };

  const markServiceComplete = async () => {
    const validImageCount =
      postServiceImages.length >= 5 && postServiceImages.length <= 15;
    if (!validImageCount || !postServiceVideo) return;

    setLoading(true);
    setError("");
    setSuccess("");
    beginEvidenceUpload("Post-service inspection evidence");

    try {
      const result = await garageApi.markServiceComplete(
        booking.requestId || booking.id,
        postServiceImages,
        postServiceVideo,
        {
          onUploadProgress: createEvidenceProgressHandler(
            postServiceImages,
            postServiceVideo,
          ),
        },
      );

      await markEvidenceFinalizing();
      applyLifecycleResult(result, {
        status: "IN_PROGRESS",
        serviceCompletedAt: new Date().toISOString(),
        deliveryStartedAt: isSelfDropOff ? null : new Date().toISOString(),
        deliveredAt: isSelfDropOff ? new Date().toISOString() : null,
      });
      setPostServiceImages([]);
      setPostServiceVideo(null);
      setSuccess(
        isSelfDropOff
          ? "Service evidence uploaded. The customer has been notified that the vehicle is ready for collection."
          : "Service evidence uploaded. The customer has been emailed and return delivery tracking is now active.",
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to complete the service stage",
      );
    } finally {
      setLoading(false);
      setEvidenceUpload(null);
    }
  };

  const markArrivedAtCustomer = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await garageApi.markArrivedAtCustomer(
        booking.requestId || booking.id,
      );
      applyLifecycleResult(result, {
        deliveredAt: new Date().toISOString(),
      });
      setSuccess(
        "Arrival at the customer address confirmed. Ask the customer to submit Cash or UPI payment from their booking page.",
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to confirm arrival at the customer address.",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmFinalPayment = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await garageApi.confirmFinalPayment(
        booking.requestId || booking.id,
      );
      applyLifecycleResult(result, {
        status: "COMPLETED",
        finalPaymentConfirmedAt: new Date().toISOString(),
      });
      setSuccess("Payment confirmed. The booking is complete and warranty is active.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to confirm the final payment.",
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

  const {
    currentIndex: currentStepIndex,
    steps: timelineSteps,
  } = getBookingTimelineState(booking);
  const isSelfDropOff = isSelfDropOffService(booking);
  const inspectionImages = booking.inspectionImages || [];
  const isCompletedByCustomer =
    booking.status === "COMPLETED" || Boolean(booking.finalPaymentConfirmedAt);
  const bookingDisplayId =
    booking.bookingCode || booking.bookingId || booking.id;
  const isHandoverStage = ["ACCEPTED", "CONFIRMED"].includes(booking.status);
  const isReturningToGarage = Boolean(
    !isSelfDropOff &&
      booking.handoverOtpVerifiedAt &&
      !booking.arrivedAtGarageAt &&
      !booking.serviceCompletedAt,
  );
  const isServiceStage = Boolean(
    booking.status === "IN_PROGRESS" &&
      booking.arrivedAtGarageAt &&
      !booking.serviceCompletedAt,
  );
  const isDeliveryJourney = Boolean(
    !isSelfDropOff && booking.serviceCompletedAt && !booking.deliveredAt,
  );
  const isAwaitingCustomerPayment = Boolean(
    booking.deliveredAt && !booking.finalPaymentSubmittedAt,
  );
  const isFinalPaymentPending = Boolean(
    booking.finalPaymentSubmittedAt &&
      !booking.finalPaymentConfirmedAt &&
      booking.status !== "COMPLETED",
  );
  const liveTrackingEnabled = Boolean(
    !booking.deliveredAt &&
      (isSelfDropOff
        ? isHandoverStage && !booking.arrivedAtGarageAt
        : isHandoverStage || isReturningToGarage || isDeliveryJourney),
  );
  const trackingPhase = isSelfDropOff
    ? "SELF_DROP_TO_GARAGE"
    : isDeliveryJourney
      ? "DELIVERY_TO_CUSTOMER"
    : isReturningToGarage
      ? "RETURN_TO_GARAGE"
      : "PICKUP_TO_CUSTOMER";
  const trackingTitle =
    trackingPhase === "SELF_DROP_TO_GARAGE"
      ? "Customer route to garage"
      : trackingPhase === "RETURN_TO_GARAGE"
      ? "Live route back to garage"
      : trackingPhase === "DELIVERY_TO_CUSTOMER"
        ? "Live delivery route to customer"
        : "Live pickup route to customer";
  const distanceToDestinationMeters =
    getDistanceMeters(
      trackingSummary?.latestLocation,
      trackingSummary?.destination,
    ) ??
    (Number.isFinite(Number(trackingSummary?.route?.distanceMeters))
      ? Math.round(Number(trackingSummary.route.distanceMeters))
      : null);
  const isNearDestination =
    Number.isFinite(distanceToDestinationMeters) &&
    distanceToDestinationMeters <= ARRIVAL_UNLOCK_DISTANCE_METERS;
  const hasCompleteOtp = otp.length === 6;

  if (isCompletedByCustomer) {
    return (
      <div className="card-soft p-6 text-sm font-semibold text-muted">
        Completing booking...
      </div>
    );
  }

  return (
    <>
      <EvidenceUploadProgress
        visible={Boolean(evidenceUpload)}
        progress={evidenceUpload?.progress || 0}
        stage={evidenceUpload?.stage || "uploading"}
        label={evidenceUpload?.label || "Inspection evidence"}
      />
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

      <WorkerTaskManager booking={booking} garage={garage} />

      <BookingElapsedTimer booking={booking} />

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
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="chip-brand">
                  {booking.status.replaceAll("_", " ")}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  isSelfDropOff
                    ? "bg-violet-100 text-violet-800"
                    : "bg-sky-100 text-sky-800"
                }`}>
                  {isSelfDropOff ? "Customer self drop-off" : "Garage pickup"}
                </span>
              </div>
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
              key={`${booking.bookingId}:${trackingPhase}`}
              bookingId={booking.bookingId}
              canShare={!isSelfDropOff}
              autoStart={!isSelfDropOff}
              onTrackingUpdate={handleTrackingUpdate}
              title={trackingTitle}
            />
          )}

          {isHandoverStage && isSelfDropOff && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm leading-6 text-violet-900">
              <div className="flex items-start gap-3">
                <FiMapPin className="mt-1 shrink-0" />
                <div>
                  <p className="font-bold">Wait for the customer at your garage</p>
                  <p className="mt-1">
                    This is a self drop-off booking. The customer shares the one-time route from home to the garage. When they arrive, capture 5–15 before-service photos and one video, then confirm arrival. No OTP is required.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isHandoverStage ? (
            <div
              ref={handoverTaskRef}
              className="card-soft scroll-mt-24 overflow-hidden ring-1 ring-brand/10"
            >
              <div className="border-b border-line bg-gradient-to-r from-white to-bg-soft/70 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                      Vehicle handover
                    </p>
                    <h3 className="mt-1 text-xl font-bold sm:text-2xl">
                      {isSelfDropOff ? "Receive Customer Drop-off" : "Receive Vehicle"}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                      {isSelfDropOff
                        ? "Watch the customer route to the garage. When they arrive, capture the vehicle condition and start service without an OTP."
                        : `Share live location first. The handover OTP unlocks when you are within ${ARRIVAL_UNLOCK_DISTANCE_METERS}m of the customer location.`}
                    </p>
                  </div>
                  <span
                    className={[
                      "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-extrabold shadow-sm",
                      isNearDestination
                        ? "border-brand/50 bg-brand/20 text-ink"
                        : "border-line bg-white text-muted",
                    ].join(" ")}
                  >
                    {isSelfDropOff ? (
                      <>
                        <FiMapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDistance(distanceToDestinationMeters)}
                      </>
                    ) : (
                      <>
                        <FiNavigation className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDistance(distanceToDestinationMeters)}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {!isNearDestination ? (
                  <div className="rounded-xl border border-line bg-bg-soft p-4 text-sm text-muted">
                    <div className="flex items-start gap-3">
                      <FiNavigation className="mt-0.5 shrink-0 text-brand-dark" />
                      <p>
                        {isSelfDropOff
                          ? "The customer must keep live sharing on while travelling to the garage. Arrival evidence unlocks when they are nearby."
                          : "Keep live sharing on and navigate to the customer. The OTP box appears automatically once you are very close."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {!isSelfDropOff && (
                      <>
                        <div className="rounded-xl border border-line bg-bg-soft px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                            OTP valid until
                          </p>
                          <p className="mt-1 text-sm font-semibold text-ink">
                            {formatDateTime(booking.handoverOtpExpiresAt)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted">
                            The OTP expires exactly two hours after generation. The customer can generate a new one from booking tracking.
                          </p>
                        </div>

                        <label htmlFor="garage-handover-otp" className="mt-5 block text-sm font-bold text-ink">
                          6-digit handover OTP
                        </label>
                        <input
                          id="garage-handover-otp"
                          value={otp}
                          onChange={(event) =>
                            setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="Enter customer OTP"
                          className="mt-2 h-12 w-full rounded-xl border border-line px-4 text-base tracking-[0.08em] focus:border-ink focus:outline-none"
                        />
                      </>
                    )}

                    {(isSelfDropOff || hasCompleteOtp) && (
                      <div className="mt-5">
                        <p className="mb-3 text-sm leading-6 text-muted">
                          Upload 5–15 {isSelfDropOff ? "before-service" : "pickup"} photos and exactly one video. Each photo must be 5 MB or less; the video must be 50 MB or less.
                        </p>
                        <div className="space-y-4">
                          <ImageUpload
                            min={5}
                            max={15}
                            value={preServiceImages}
                            onChange={setPreServiceImages}
                            maxSizeMb={GARAGE_INSPECTION_PHOTO_MAX_SIZE_MB}
                          />
                          <VideoUpload value={preServiceVideo} onChange={setPreServiceVideo} />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={isSelfDropOff ? confirmSelfDropArrival : verifyHandover}
                      disabled={
                        loading ||
                        (!isSelfDropOff && !hasCompleteOtp) ||
                        preServiceImages.length < 5 ||
                        preServiceImages.length > 15 ||
                        !preServiceVideo
                      }
                      className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading
                        ? isSelfDropOff
                          ? "Confirming arrival..."
                          : "Verifying..."
                        : isSelfDropOff
                          ? "Confirm Arrival & Start Service"
                          : "Verify Handover & Start Service"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {isReturningToGarage && (
            <section
              ref={returnJourneyTaskRef}
              className="card-soft scroll-mt-24 p-5 ring-1 ring-brand/10 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
                  <FiNavigation className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    Pickup return journey
                  </p>
                  <h3 className="mt-1 text-xl font-bold">Take the vehicle to the garage</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    The customer handover is verified. Keep live tracking active until the vehicle reaches the assigned garage. Service evidence stays locked until arrival is confirmed.
                  </p>
                  <div className="mt-4 rounded-lg border border-line bg-bg-soft p-3 text-sm font-semibold text-ink">
                    {formatDistance(distanceToDestinationMeters)} from the garage
                  </div>
                  <button
                    type="button"
                    onClick={markArrivedAtGarage}
                    disabled={loading || !isNearDestination}
                    className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCheckCircle />
                    {loading ? "Confirming arrival..." : "Reached Garage — Start Service"}
                  </button>
                  {!isNearDestination && (
                    <p className="mt-2 text-xs leading-5 text-muted">
                      This button unlocks within approximately {ARRIVAL_UNLOCK_DISTANCE_METERS} metres of the garage. Keep GPS and live sharing enabled.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {isServiceStage && (
            <div
              ref={serviceTaskRef}
              className="card-soft scroll-mt-24 p-5 ring-1 ring-brand/10 sm:p-6"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                Service completion evidence
              </p>
              <h3 className="mt-1 text-xl font-bold">Complete Service</h3>
              <p className="mb-4 mt-2 text-sm leading-6 text-muted">
                Upload 5–15 post-service photos and exactly one video. Each photo must be 5 MB or less and the video must be 50 MB or less. After upload, the customer receives a completion email. {isSelfDropOff
                  ? "The vehicle becomes ready for collection at the garage."
                  : "Return delivery tracking starts immediately."}
              </p>
              <div className="space-y-4">
                <ImageUpload
                  min={5}
                  max={15}
                  value={postServiceImages}
                  onChange={setPostServiceImages}
                  maxSizeMb={GARAGE_INSPECTION_PHOTO_MAX_SIZE_MB}
                />
                <VideoUpload
                  value={postServiceVideo}
                  onChange={setPostServiceVideo}
                />
              </div>
              <button
                onClick={markServiceComplete}
                disabled={
                  loading ||
                  postServiceImages.length < 5 ||
                  postServiceImages.length > 15 ||
                  !postServiceVideo
                }
                className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Uploading evidence..."
                  : isSelfDropOff
                    ? "Complete Service & Notify Customer"
                    : "Complete Service & Start Delivery"}
              </button>
            </div>
          )}

          {isDeliveryJourney && (
            <section
              ref={deliveryTaskRef}
              className="card-soft scroll-mt-24 p-5 ring-1 ring-brand/10 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/20 text-brand-dark">
                  <FiNavigation className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    Return delivery
                  </p>
                  <h3 className="mt-1 text-xl font-bold">Vehicle is on the way to the customer</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    The completion email has been sent. Keep the live map active during delivery, then confirm arrival near the customer address.
                  </p>
                  <div className="mt-4 rounded-lg border border-line bg-bg-soft p-3 text-sm font-semibold text-ink">
                    {formatDistance(distanceToDestinationMeters)} from the customer
                  </div>
                  <button
                    type="button"
                    onClick={markArrivedAtCustomer}
                    disabled={loading || !isNearDestination}
                    className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCheckCircle />
                    {loading ? "Confirming arrival..." : "Arrived at Customer"}
                  </button>
                  {!isNearDestination && (
                    <p className="mt-2 text-xs leading-5 text-muted">
                      This button unlocks within approximately {ARRIVAL_UNLOCK_DISTANCE_METERS} metres of the customer address.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {isAwaitingCustomerPayment && (
            <div
              ref={awaitingPaymentTaskRef}
              className="scroll-mt-24 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 ring-1 ring-amber-200/60"
            >
              <p className="font-bold">Waiting for customer payment submission</p>
              <p className="mt-1">
                {isSelfDropOff
                  ? "The vehicle is ready at the garage. Ask the customer to open their booking, choose Cash or UPI, enter the amount and press Send."
                  : "The vehicle has reached the customer. Ask them to open their booking, choose Cash or UPI, enter the amount and press Send."}
              </p>
            </div>
          )}

          {isFinalPaymentPending && (
            <section
              ref={confirmPaymentTaskRef}
              className="scroll-mt-24 overflow-hidden rounded-xl border border-amber-300 bg-white shadow-sm ring-2 ring-amber-200/70"
            >
              <div className="border-b border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
                  Customer payment pending confirmation
                </p>
                <h3 className="mt-1 text-xl font-bold text-ink">
                  {booking.finalPaymentMethod === "UPI" ? "UPI" : "Cash"} · {formatRupees(booking.finalPaymentAmount || 0)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Submitted {formatDateTime(booking.finalPaymentSubmittedAt)}. Confirm only after the amount has actually been received.
                </p>
              </div>
              <div className="p-5">
                <button
                  type="button"
                  onClick={confirmFinalPayment}
                  disabled={loading}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiCheckCircle />
                  {loading ? "Completing booking..." : "Payment Received — Complete Booking"}
                </button>
                <p className="mt-2 text-xs leading-5 text-muted">
                  This finalises the booking, stops the timer, releases the assigned controller and activates the customer warranty.
                </p>
              </div>
            </section>
          )}

          {inspectionImages.some((image) => image.phase === "PICKUP") && (
            <InspectionGallery
              images={inspectionImages}
              phase="PICKUP"
              title={isSelfDropOff ? "Drop-off inspection evidence" : "Pickup inspection evidence"}
              description={
                isSelfDropOff
                  ? "Evidence recorded when the customer handed over the vehicle at the garage."
                  : "Evidence recorded before the garage started service."
              }
            />
          )}

          {inspectionImages.some((image) => image.phase === "DELIVERY") && (
            <InspectionGallery
              images={inspectionImages}
              phase="DELIVERY"
              title={isSelfDropOff ? "Post-service inspection evidence" : "Delivery inspection evidence"}
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
              {isSelfDropOff ? (
                <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-violet-900">
                  Customer will bring the vehicle to this garage. Their home/service address is not a pickup destination.
                </p>
              ) : (
                <p>
                  <span className="text-muted">Address:</span>{" "}
                  <span className="font-semibold">
                    {booking.customer.address || "N/A"}
                  </span>
                </p>
              )}
            </div>
            {!isSelfDropOff && (
              <MapPanel
                center={booking.customer.location}
                height={220}
                className="mb-4"
                zoom={16}
              />
            )}
            <div className={`grid gap-2 ${isSelfDropOff ? "grid-cols-2" : "grid-cols-3"}`}>
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
              {!isSelfDropOff && (
                <button
                  onClick={openGoogleMaps}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-3 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark"
                >
                  <FiMapPin className="h-5 w-5" />
                  <span className="text-xs font-semibold">Navigate</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
