import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/api/axios";
import InspectionGallery from "@/components/booking/InspectionGallery";
import LiveBookingTracking from "@/components/maps/LiveBookingTracking";
import ReviewModal from "@/components/reviews/ReviewModal";
import { useApp } from "@/hooks/useApp";
import { formatRupees } from "@/utils/priceRange";
import {
  FiCheck,
  FiClock,
  FiMapPin,
  FiMessageCircle,
  FiNavigation,
  FiPhone,
  FiRefreshCw,
  FiShield,
  FiStar,
  FiTool,
  FiX,
} from "react-icons/fi";

const TRACKING_STEPS = [
  {
    key: "searching",
    label: "Selecting a Garage",
    desc: "Nearby verified garages are receiving your request.",
  },
  {
    key: "confirmed",
    label: "Garage Confirmed",
    desc: "A garage accepted the booking and received your service details.",
  },
  {
    key: "progress",
    label: "Service In Progress",
    desc: "The garage verified handover and started working on your vehicle.",
  },
  {
    key: "delivery",
    label: "Ready for Delivery",
    desc: "The garage uploaded the post-service inspection photos.",
  },
  {
    key: "completed",
    label: "Service Completed",
    desc: "Delivery was accepted and the booking is complete.",
  },
];

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

const getWhatsappUrl = (phone) => {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length > 10) digits = digits.replace(/^0+/, "");

  return digits ? `https://wa.me/${digits}` : null;
};


const getServicesTotal = (booking) => {
  const total = Number(booking?.totalServiceAmount || 0);
  const maxTotal = Number(booking?.totalServiceMaxAmount || 0);

  if (total > 0 && total === maxTotal) return total;

  return (
    booking?.services?.reduce((sum, item) => {
    return (
      sum +
      Number(
        item.finalPrice ??
          item.estimatedMaxPrice ??
          item.estimatedPrice ??
          0,
      )
    );
    }, 0) || maxTotal
  );
};

const getCurrentStep = (booking) => {
  if (!booking) return 0;
  if (booking.status === "COMPLETED") return 4;
  if (booking.deliveredAt) return 3;
  if (booking.status === "IN_PROGRESS") return 2;
  if (["GARAGE_ASSIGNED", "CONFIRMED"].includes(booking.status)) return 1;
  return 0;
};

const getHeaderCopy = (booking, remainingSeconds) => {
  if (!booking) {
    return {
      title: "Loading booking",
      description: "Fetching the latest booking state.",
    };
  }

  if (booking.status === "CANCELLED") {
    return {
      title: "Booking Cancelled",
      description: "Garage matching has stopped for this booking.",
    };
  }

  if (booking.status === "PENDING_PAYMENT") {
    return {
      title: "Preparing Garage Search",
      description:
        "This booking is being moved into the normal garage search flow.",
    };
  }

  if (booking.status === "SEARCHING_GARAGE") {
    if (remainingSeconds <= 0) {
      return {
        title: "Trying Again",
        description:
          "No garage accepted that round. We are selecting the next nearby garages automatically.",
      };
    }

    return {
      title: "Selecting Nearby Garages",
      description:
        "Verified garages are being contacted in a two-minute acceptance round.",
    };
  }

  if (["GARAGE_ASSIGNED", "CONFIRMED"].includes(booking.status)) {
    return {
      title: "Garage Accepted Your Booking",
      description:
        "Your garage is confirmed. Customer details are now unlocked for the garage.",
    };
  }

  if (booking.status === "IN_PROGRESS" && booking.deliveredAt) {
    return {
      title: "Vehicle Ready for Delivery",
      description:
        "Review the completed service and accept delivery when you receive the vehicle.",
    };
  }

  if (booking.status === "IN_PROGRESS") {
    return {
      title: "Service In Progress",
      description:
        "The handover OTP was verified and the garage is servicing your vehicle.",
    };
  }

  if (booking.status === "COMPLETED") {
    return {
      title: "Service Completed",
      description: "Your service history and warranty are now active.",
    };
  }

  return {
    title: booking.status?.replaceAll("_", " ") || "Booking Tracking",
    description: "Showing the latest status reported by the backend.",
  };
};

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const getBookingId = (location) => {
  const params = new URLSearchParams(location.search);
  return (
    location.state?.bookingId ||
    params.get("bookingId") ||
    sessionStorage.getItem("rovautoTrackingBookingId") ||
    ""
  );
};

function SearchMap({ retrying }) {
  const garagePoints = [
    { left: "15%", top: "23%", delay: 0 },
    { left: "72%", top: "18%", delay: 0.25 },
    { left: "79%", top: "68%", delay: 0.5 },
    { left: "21%", top: "72%", delay: 0.75 },
    { left: "50%", top: "10%", delay: 1 },
  ];

  return (
    <div
      className="relative h-72 overflow-hidden rounded-3xl border border-line bg-bg-soft"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand/50"
        animate={{ scale: [0.65, 1.15], opacity: [0.9, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand"
        animate={{ scale: [0.75, 1.2], opacity: [0.8, 0] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: 0.7,
          ease: "easeOut",
        }}
      />

      {garagePoints.map((point, index) => (
        <motion.div
          key={`${point.left}-${point.top}`}
          className="absolute grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white shadow-soft"
          style={{ left: point.left, top: point.top }}
          animate={{ y: [0, -7, 0], scale: [1, 1.06, 1] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: point.delay,
          }}
        >
          <FiTool className="text-brand-dark" />
          <span className="sr-only">Nearby garage {index + 1}</span>
        </motion.div>
      ))}

      <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink text-white shadow-xl">
        <FiMapPin className="text-2xl" />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-line bg-white/95 px-4 py-2 text-xs font-semibold shadow-soft backdrop-blur">
        {retrying ? "Refreshing nearby garage batch..." : "Contacting nearby verified garages"}
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={`text-right ${bold ? "font-bold" : "font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}

function Tracking() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearBookingCaches } = useApp();
  const bookingId = useMemo(() => getBookingId(location), [location]);

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(Boolean(bookingId));
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [handoverOtpResult, setHandoverOtpResult] = useState(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (!bookingId) return;
    sessionStorage.setItem("rovautoTrackingBookingId", bookingId);
  }, [bookingId]);

  const loadBooking = useCallback(
    async ({ initial = false } = {}) => {
      if (!bookingId || requestInFlight.current) return;

      requestInFlight.current = true;

      if (initial) setLoading(true);
      else setRefreshing(true);

      try {
        const response = await api.get(`/bookings/${bookingId}`, {
          params: { tracking: 1, timestamp: Date.now() },
        });

        setBooking(response.data.data);
        setError("");
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to refresh booking status.",
        );
      } finally {
        requestInFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    loadBooking({ initial: true });
  }, [loadBooking]);

  useEffect(() => {
    if (!bookingId || TERMINAL_STATUSES.has(booking?.status)) return undefined;

    const interval = window.setInterval(() => {
      loadBooking();
    }, 3000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadBooking();
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [bookingId, booking?.status, loadBooking]);

  useEffect(() => {
    if (
      booking?.status !== "SEARCHING_GARAGE" ||
      !booking.searchExpiresAt
    ) {
      setRemainingSeconds(0);
      return undefined;
    }

    const updateCountdown = () => {
      const milliseconds =
        new Date(booking.searchExpiresAt).getTime() - Date.now();
      setRemainingSeconds(Math.max(0, Math.ceil(milliseconds / 1000)));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [booking?.status, booking?.searchExpiresAt]);

  const cancelBooking = async () => {
    if (!bookingId) return;

    try {
      setActionLoading("cancel");
      setError("");

      const response = await api.patch(`/bookings/${bookingId}/cancel`);
      setBooking(response.data.data);
      clearBookingCaches?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not cancel this booking.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const acceptDelivery = async () => {
    try {
      setActionLoading("delivery");
      setError("");
      const response = await api.post(
        `/bookings/${bookingId}/accept-delivery`,
      );
      setBooking(response.data.data);
      clearBookingCaches?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not accept vehicle delivery.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const regenerateHandoverOtp = async () => {
    try {
      setActionLoading("otp");
      setError("");
      setSuccess("");

      const response = await api.post(
        `/bookings/${bookingId}/handover-otp/regenerate`,
      );
      const result = response.data.data;

      setBooking((current) => ({
        ...current,
        handoverOtpExpiresAt: result.expiresAt,
      }));
      setHandoverOtpResult(result);
      setSuccess(
        "A new handover OTP was generated and sent to your notifications and WhatsApp.",
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not generate a new handover OTP.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleReviewSaved = (savedReview) => {
    setBooking((current) => ({
      ...current,
      review: savedReview,
    }));
    clearBookingCaches?.();
    setSuccess(
      booking.review
        ? "Your garage review was updated."
        : "Your garage review was submitted.",
    );
  };

  if (!bookingId) {
    return (
      <div className="container-x max-w-3xl py-12">
        <div className="card-soft p-8 text-center">
          <h1 className="text-2xl font-bold">Select a booking to track</h1>
          <p className="mt-2 text-muted">
            Open tracking from an active booking after checkout.
          </p>
          <Link to="/dashboard/bookings" className="btn-primary mt-5">
            View Active Bookings
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !booking) {
    return (
      <div className="container-x max-w-3xl py-12">
        <div className="card-soft p-8 text-muted">Loading booking...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container-x max-w-3xl py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Booking could not be loaded."}
        </div>
      </div>
    );
  }


  const currentStep = getCurrentStep(booking);
  const header = getHeaderCopy(booking, remainingSeconds);
  const searching = booking.status === "SEARCHING_GARAGE";
  const retrying = searching && remainingSeconds <= 0;
  const currentRoundRequests =
    booking.broadcasts?.filter((request) => request.status === "SENT") || [];
  const servicesTotal = getServicesTotal(booking);
  const bookingCode =
    booking.bookingCode || location.state?.bookingCode || "Booking";
  const inspectionImages = booking.inspectionImages || [];
  const pickupImages = inspectionImages.filter(
    (image) => image.phase === "PICKUP",
  );
  const deliveryImages = inspectionImages.filter(
    (image) => image.phase === "DELIVERY",
  );

  return (
    <div className="container-x grid max-w-6xl gap-8 py-12 lg:grid-cols-[1fr_380px]">
      <main>
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip-brand">Booking #{bookingCode}</span>
          {refreshing && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <FiRefreshCw className="animate-spin" /> Refreshing
            </span>
          )}
        </div>

        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          {header.title}
        </h1>
        <p className="mt-2 text-muted">{header.description}</p>

        {error && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {searching && (
          <div className="mt-8">
            <SearchMap retrying={retrying} />

            <div className="card-soft mt-4 grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Round timer
                </div>
                <div className="mt-1 font-mono text-3xl font-bold">
                  {retrying ? "00:00" : formatCountdown(remainingSeconds)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Garages contacted
                </div>
                <div className="mt-1 text-3xl font-bold">
                  {currentRoundRequests.length}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Search mode
                </div>
                <div className="mt-2 font-semibold">
                  {retrying ? "Starting next round" : "Waiting for acceptance"}
                </div>
              </div>
            </div>

            {retrying && (
              <div className="mt-4 rounded-2xl border border-brand bg-brand-soft p-4 text-sm">
                <div className="flex items-start gap-3">
                  <FiRefreshCw className="mt-0.5 shrink-0 animate-spin" />
                  <div>
                    <div className="font-semibold">
                      No garage accepted the previous round.
                    </div>
                    <div className="mt-1 text-muted">
                      Selecting the next nearest garages and sending fresh notifications. You do not need to restart checkout.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!searching && booking.garage && (
          <div className="mt-8">
            <LiveBookingTracking
              bookingId={booking.id}
              title={booking.requestType === "SOS" ? "Live SOS response route" : "Live garage route"}
            />
          </div>
        )}

        <div className="card-soft mt-8 p-6">
          <h2 className="mb-5 text-lg font-semibold">Live booking timeline</h2>
          <div className="grid gap-1">
            {TRACKING_STEPS.map((step, index) => {
              const completed = index < currentStep;
              const current = index === currentStep;

              return (
                <div key={step.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={current ? { scale: [0.92, 1.08, 1] } : {}}
                      className={`grid h-9 w-9 place-items-center rounded-full ${
                        completed || current
                          ? "bg-brand text-ink"
                          : "bg-bg-soft text-muted"
                      }`}
                    >
                      {completed ? (
                        <FiCheck />
                      ) : current ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-ink" />
                      ) : (
                        index + 1
                      )}
                    </motion.div>
                    {index < TRACKING_STEPS.length - 1 && (
                      <div
                        className={`my-1 min-h-10 w-px flex-1 ${
                          completed ? "bg-brand" : "bg-line"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pb-6">
                    <div
                      className={`font-semibold ${
                        completed || current ? "text-ink" : "text-muted"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-sm text-muted">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {pickupImages.length > 0 && (
          <div className="mt-6">
            <InspectionGallery
              images={pickupImages}
              phase="PICKUP"
              title="Pickup inspection photos"
              description="These photos were recorded before the garage started working on your vehicle."
            />
          </div>
        )}

        {deliveryImages.length > 0 && (
          <div className="mt-6">
            <InspectionGallery
              images={deliveryImages}
              phase="DELIVERY"
              title="Delivery inspection photos"
              description="These photos were recorded after the garage completed the selected services."
            />
          </div>
        )}

        {booking.deliveredAt && booking.status !== "COMPLETED" && (
          <div className="card-soft mt-6 p-6">
            <h2 className="text-xl font-bold">Vehicle delivery ready</h2>
            <p className="mt-2 text-sm text-muted">
              Accept only after you receive the vehicle and review the completed work.
            </p>
            <button
              type="button"
              onClick={acceptDelivery}
              disabled={actionLoading === "delivery"}
              className="btn-primary mt-5"
            >
              {actionLoading === "delivery"
                ? "Accepting..."
                : "Accept Vehicle Delivery"}
            </button>
          </div>
        )}

        {booking.status === "COMPLETED" && (
          <>
            <div className="card-soft mt-6 p-6">
              <h3 className="mb-2 text-xl font-bold">Service completed</h3>
              <p className="text-sm text-muted">
                The garage has recorded the final amount and the booking is now
                in your service history.
              </p>
              <button
                type="button"
                onClick={() => setReviewOpen(true)}
                className="btn-primary mt-5"
              >
                <FiStar /> {booking.review ? "Edit Review" : "Rate Garage"}
              </button>

              {booking.review && (
                <div className="mt-5 rounded-2xl bg-bg-soft p-4">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <FiStar
                        key={value}
                        fill={
                          value <= Number(booking.review.rating || 0)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {booking.review.comment || "No written review added."}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl bg-gradient-to-br from-ink to-ink-2 p-6 text-white">
              <span className="chip-brand">Active</span>
              <h3 className="mt-3 flex items-center gap-2 text-2xl font-bold">
                <FiShield /> 30-Day Warranty Card
              </h3>
              <p className="mt-2 text-sm text-white/70">
                Your service warranty is active after booking completion.
              </p>
            </div>
          </>
        )}
      </main>

      <aside className="card-soft h-fit p-6 lg:sticky lg:top-24">
        {searching ? (
          <div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand">
              {retrying ? (
                <FiRefreshCw className="animate-spin text-2xl" />
              ) : (
                <FiNavigation className="text-2xl" />
              )}
            </div>
            <h3 className="mt-4 text-center font-semibold">
              {retrying ? "Trying another garage batch" : "Waiting for a garage"}
            </h3>
            <p className="mt-2 text-center text-xs text-muted">
              In-app and WhatsApp notifications are sent to eligible garage owners for each round.
            </p>

            <div className="mt-5 grid gap-3 rounded-2xl bg-bg-soft p-4 text-sm">
              <Row
                label="Time remaining"
                value={formatCountdown(remainingSeconds)}
              />
              <Row
                label="Active requests"
                value={currentRoundRequests.length}
              />
              <Row label="Round duration" value="2 minutes" />
            </div>

            <button
              type="button"
              onClick={() => loadBooking()}
              disabled={refreshing}
              className="btn-ghost mt-4 w-full"
            >
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
              Refresh Status
            </button>

            <button
              type="button"
              onClick={cancelBooking}
              disabled={actionLoading === "cancel"}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              <FiX />
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel Booking"}
            </button>
          </div>
        ) : booking.garage ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-lg font-bold text-white">
                {booking.garage.name?.slice(0, 2).toUpperCase() || "RG"}
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold">
                  {booking.garage.name}
                </div>
                <div className="truncate text-xs text-muted">
                  {booking.garage.area || booking.garage.city}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                  <FiStar fill="currentColor" />
                  {Number(booking.garage.ratingAvg || 0).toFixed(1)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm">
              <Row label="Phone" value={booking.garage.phone || "Not provided"} />
              <Row
                label="Address"
                value={booking.garage.address || booking.garage.area || "Not provided"}
              />
              <Row
                label="Handover OTP"
                value={
                  handoverOtpResult?.otp ||
                  "Available in your booking notification"
                }
              />
              {booking.handoverOtpExpiresAt && (
                <Row
                  label="OTP expires"
                  value={new Date(booking.handoverOtpExpiresAt).toLocaleString(
                    "en-IN",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
                />
              )}
            </div>

            {booking.status === "CONFIRMED" &&
              !booking.handoverOtpVerifiedAt && (
                <button
                  type="button"
                  onClick={regenerateHandoverOtp}
                  disabled={actionLoading === "otp"}
                  className="btn-ghost mt-4 w-full disabled:opacity-60"
                >
                  <FiRefreshCw
                    className={actionLoading === "otp" ? "animate-spin" : ""}
                  />
                  {actionLoading === "otp"
                    ? "Generating..."
                    : "Generate New Handover OTP"}
                </button>
              )}

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  booking.garage.phone &&
                  window.open(`tel:${booking.garage.phone}`, "_self")
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <FiPhone className="text-base" />
                <span>Call</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const phone =
                    booking.garage.whatsappNo || booking.garage.phone;
                  const whatsappUrl = getWhatsappUrl(phone);
                  if (whatsappUrl) {
                    window.open(whatsappUrl, "_blank");
                  }
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <FiMessageCircle className="text-base" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps?q=${booking.garage.latitude},${booking.garage.longitude}`,
                    "_blank",
                  )
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-3 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                <FiNavigation className="text-base" />
                <span>Navigate</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-5 text-center">
            <FiClock className="mx-auto text-3xl text-muted" />
            <p className="mt-3 text-sm text-muted">
              Garage information will appear after acceptance.
            </p>
          </div>
        )}

        <hr className="my-6 border-line" />

        <div className="grid gap-3 text-sm">
          <Row
            label="Vehicle"
            value={`${booking.vehicle?.brand || ""} ${booking.vehicle?.model || ""}`.trim() || "Vehicle"}
          />
          <Row
            label="Services"
            value={
              booking.services
                ?.map((item) => item.service?.name)
                .filter(Boolean)
                .join(", ") || "Selected services"
            }
          />
          <Row label="Estimated service" value={formatRupees(servicesTotal)} />
        </div>
      </aside>

      <ReviewModal
        open={reviewOpen}
        booking={booking}
        review={booking.review}
        onClose={() => setReviewOpen(false)}
        onSaved={handleReviewSaved}
      />
    </div>
  );
}

export { Tracking };
export default Tracking;
