import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import api from "@/api/axios";
import InspectionGallery from "@/components/booking/InspectionGallery";
import LiveBookingTracking from "@/components/maps/LiveBookingTracking";
import ReviewModal from "@/components/reviews/ReviewModal";
import { useApp } from "@/hooks/useApp";
import { formatRupees } from "@/utils/priceRange";
import {
  BOOKING_TIMELINE_STEPS,
  getBookingTimelineState,
} from "@/utils/bookingTimeline";
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
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


const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);
const SEARCH_RADIUS_BY_ROUND = Object.freeze({ 1: 5, 2: 10, 3: 20 });

const getSearchRound = (booking) =>
  Math.min(3, Math.max(1, Number(booking?.garageSearchRound) || 1));

const getSearchRadiusKm = (booking) =>
  Number(booking?.searchRadiusKm) ||
  SEARCH_RADIUS_BY_ROUND[getSearchRound(booking)];

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
    const round = getSearchRound(booking);
    const radiusKm = getSearchRadiusKm(booking);
    const cycle = Math.max(1, Number(booking.garageSearchCycle) || 1);

    if (remainingSeconds <= 0) {
      if (round === 3) {
        return {
          title: "Restarting the Nearby Search",
          description:
            "No verified garage accepted within 20 km in this pass. We are restarting automatically from 5 km, and you will not be charged again.",
        };
      }

      return {
        title: `Expanding Search to ${SEARCH_RADIUS_BY_ROUND[round + 1]} km`,
        description:
          "The current radius did not produce an acceptance, so Rovauto is moving to the next verified-garage radius automatically.",
      };
    }

    if (cycle > 1 && round === 1) {
      return {
        title: "Nearby Search Restarted",
        description:
          "No garage accepted during the previous 5 km, 10 km, and 20 km pass. We have restarted from 5 km and will expand again automatically.",
      };
    }

    return {
      title: `Searching Within ${radiusKm} km`,
      description:
        "We are contacting every newly eligible verified garage in this radius. The first partner to accept will be assigned automatically.",
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

function SearchMap({
  contactedCount,
  remainingSeconds,
  retrying,
  radiusKm,
  nextRadiusKm,
}) {
  const reduceMotion = useReducedMotion();
  const garagePoints = [
    { left: "15%", top: "25%", delay: 0 },
    { left: "78%", top: "22%", delay: 0.22 },
    { left: "82%", top: "68%", delay: 0.44 },
    { left: "20%", top: "72%", delay: 0.66 },
    { left: "52%", top: "14%", delay: 0.88 },
  ];
  const statusMessage = retrying
    ? `Preparing the ${nextRadiusKm} km search round`
    : contactedCount > 0
      ? `Waiting for ${contactedCount} ${contactedCount === 1 ? "garage" : "garages"} to respond`
      : "Contacting nearby verified garages";

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            <span className="relative flex h-2.5 w-2.5">
              {!reduceMotion && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-dark opacity-40" />
              )}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-dark" />
            </span>
            Live garage search
          </div>
          <h2 className="mt-1.5 text-lg font-bold sm:text-xl">
            Matching your booking with nearby experts
          </h2>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-bg-soft px-3 py-1.5 text-xs font-semibold text-ink">
          <FiCheckCircle className="text-brand-dark" /> Verified network
        </span>
      </div>

      <div
        className="relative h-[270px] overflow-hidden sm:h-[310px]"
        style={{
          backgroundColor: "#f8f9f6",
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(185,240,0,0.16), transparent 35%), linear-gradient(rgba(17,17,17,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.055) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <path d="M50 52 C38 38 28 31 15 25" fill="none" stroke="rgba(17,17,17,0.14)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d="M50 52 C61 37 68 28 78 22" fill="none" stroke="rgba(17,17,17,0.14)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d="M50 52 C64 58 72 64 82 68" fill="none" stroke="rgba(17,17,17,0.14)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d="M50 52 C40 60 31 67 20 72" fill="none" stroke="rgba(17,17,17,0.14)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d="M50 52 C50 37 51 25 52 14" fill="none" stroke="rgba(17,17,17,0.14)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        </svg>

        <div
          aria-hidden="true"
          className="absolute left-1/2 top-[52%] h-44 w-44 -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div
            className="absolute inset-0 rounded-full border border-brand-dark/35"
            animate={
              reduceMotion
                ? undefined
                : { scale: [0.58, 1.12], opacity: [0.75, 0] }
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-8 rounded-full border border-brand-dark/60"
            animate={
              reduceMotion
                ? undefined
                : { scale: [0.62, 1.2], opacity: [0.7, 0] }
            }
            transition={{
              duration: 2.2,
              repeat: Infinity,
              delay: 0.75,
              ease: "easeOut",
            }}
          />
        </div>

        {garagePoints.map((point, index) => (
          <div
            key={`${point.left}-${point.top}`}
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: point.left, top: point.top }}
          >
            <motion.div
              className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white bg-white text-ink shadow-[0_8px_24px_rgba(17,17,17,0.11)] sm:h-12 sm:w-12"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.72 }}
              animate={
                reduceMotion
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 1, scale: [1, 1.05, 1], y: [0, -4, 0] }
              }
              transition={{
                opacity: { duration: 0.35, delay: point.delay },
                scale: { duration: 2.6, repeat: Infinity, delay: point.delay },
                y: { duration: 2.6, repeat: Infinity, delay: point.delay },
              }}
            >
              <FiTool className="text-brand-dark" />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand-dark" />
              <span className="sr-only">Nearby garage {index + 1}</span>
            </motion.div>
          </div>
        ))}

        <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2">
          <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-[6px] border-white bg-ink text-white shadow-[0_14px_32px_rgba(17,17,17,0.24)]">
            <FiMapPin className="text-2xl" />
          </div>
        </div>

        <div
          className="absolute inset-x-4 bottom-4 mx-auto flex max-w-max items-center gap-2 rounded-full border border-line bg-white/95 px-4 py-2.5 text-center text-xs font-semibold shadow-soft backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <FiRefreshCw
            className={retrying ? "motion-safe:animate-spin text-brand-dark" : "text-brand-dark"}
          />
          {statusMessage}
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-line sm:grid-cols-3">
        <div className="border-b border-r border-line p-4 sm:border-b-0 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            <FiClock /> Round timer
          </div>
          <div
            className="mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl"
            role="timer"
            aria-label={`${remainingSeconds} seconds remaining in this garage search round`}
          >
            {retrying ? "00:00" : formatCountdown(remainingSeconds)}
          </div>
          <p className="mt-1 text-xs text-muted">Live countdown</p>
        </div>

        <div className="border-b border-line p-4 sm:border-b-0 sm:border-r sm:p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            Garages contacted
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">
            {contactedCount}
          </div>
          <p className="mt-1 text-xs text-muted">Active in this round</p>
        </div>

        <div className="col-span-2 p-4 sm:col-span-1 sm:p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            Search mode
          </div>
          <div className="mt-2 flex items-center gap-2 font-bold">
            <span className="h-2 w-2 rounded-full bg-brand-dark" />
            {retrying ? `${nextRadiusKm} km next` : `${radiusKm} km radius`}
          </div>
          <p className="mt-1 text-xs text-muted">Automatic matching</p>
        </div>
      </div>
    </section>
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
  const [finalAmount, setFinalAmount] = useState("");
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
    const amount = Math.round(Number(finalAmount));

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter the final amount paid to the garage before accepting delivery.");
      return;
    }

    try {
      setActionLoading("delivery");
      setError("");
      const response = await api.post(
        `/bookings/${bookingId}/accept-delivery`,
        { finalAmount: amount },
      );
      setBooking(response.data.data);
      setFinalAmount("");
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
        "A new handover OTP was generated and sent to your notifications, WhatsApp, and email.",
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


  const { currentIndex: currentStep } = getBookingTimelineState(booking);
  const searching = booking.status === "SEARCHING_GARAGE";
  const searchRound = getSearchRound(booking);
  const searchRadiusKm = getSearchRadiusKm(booking);
  const searchCycle = Math.max(1, Number(booking.garageSearchCycle) || 1);
  const searchRestarted = searching && searchCycle > 1 && searchRound === 1;
  const nextSearchRadiusKm =
    searchRound === 3 ? 5 : SEARCH_RADIUS_BY_ROUND[searchRound + 1];
  const searchExpiry = booking.searchExpiresAt
    ? new Date(booking.searchExpiresAt).getTime()
    : 0;
  const now = Date.now();
  const retrying =
    searching &&
    remainingSeconds <= 0 &&
    searchExpiry > 0 &&
    searchExpiry <= now;
  const displayedRemainingSeconds =
    searching && remainingSeconds <= 0 && searchExpiry > now
      ? Math.max(1, Math.ceil((searchExpiry - now) / 1000))
      : remainingSeconds;
  const header = getHeaderCopy(
    booking,
    retrying ? 0 : Math.max(1, displayedRemainingSeconds),
  );
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
    <>
      <div className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#fafcf6_0px,#ffffff_300px)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[52rem] max-w-full -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="container-x py-8 sm:py-10 lg:py-12">
        <div className="mx-auto w-full max-w-[74rem]">
          <header className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip-brand">Booking #{bookingCode}</span>
              {searching && (
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-brand-dark" />
                  Matching in progress · {searchRadiusKm} km
                </span>
              )}
              {refreshing && (
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <FiRefreshCw className="motion-safe:animate-spin" /> Updating status
                </span>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-[2.75rem]">
              {header.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              {header.description}
            </p>
          </header>

          {error && (
            <div className="mt-5 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-5 max-w-3xl rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {success}
            </div>
          )}

          {searchRestarted && (
            <div className="mt-5 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              No verified garage accepted during the previous search up to 20 km.
              Rovauto has restarted automatically from 5 km using the same paid
              booking. No additional payment or action is required.
            </div>
          )}

          <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-7">
            <main className="min-w-0">

        {searching && (
          <div>
            <SearchMap
              contactedCount={currentRoundRequests.length}
              remainingSeconds={displayedRemainingSeconds}
              retrying={retrying}
              radiusKm={searchRadiusKm}
              nextRadiusKm={nextSearchRadiusKm}
            />

            {retrying && (
              <div className="mt-4 rounded-2xl border border-brand bg-brand-soft/70 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white">
                    <FiRefreshCw className="motion-safe:animate-spin" />
                  </span>
                  <div>
                    <div className="font-bold">
                      Expanding the search automatically
                    </div>
                    <div className="mt-1 leading-5 text-muted">
                      {searchRound === 3
                        ? "No garage accepted within 20 km, so the search is restarting at 5 km. No action or extra payment is needed."
                        : `No garage accepted in the ${searchRadiusKm} km round, so the search is expanding to ${nextSearchRadiusKm} km automatically.`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!searching && booking.garage && (
          <div>
            <LiveBookingTracking
              bookingId={booking.id}
              title={booking.requestType === "SOS" ? "Live SOS response route" : "Live garage route"}
            />
          </div>
        )}

        <div className="card-soft mt-8 p-6">
          <h2 className="mb-5 text-lg font-semibold">Live booking timeline</h2>
          <div className="grid gap-1">
            {BOOKING_TIMELINE_STEPS.map((step, index) => {
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
                    {index < BOOKING_TIMELINE_STEPS.length - 1 && (
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
                    <div className="text-sm text-muted">{step.description}</div>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">Vehicle delivery ready</h2>
                <p className="mt-2 text-sm text-muted">
                  Review the delivery photos, enter the final amount you paid
                  to the garage, then accept delivery.
                </p>
              </div>
              <span className="chip-brand w-fit">Customer confirmation</span>
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                <FiDollarSign className="text-brand-dark" />
                Final amount paid to garage
              </span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={finalAmount}
                onChange={(event) =>
                  setFinalAmount(event.target.value.replace(/\D/g, ""))
                }
                placeholder="Enter final amount"
                className="w-full rounded-xl border border-line px-4 py-3 text-sm font-semibold outline-none transition focus:border-ink"
              />
            </label>

            <button
              type="button"
              onClick={acceptDelivery}
              disabled={actionLoading === "delivery" || Number(finalAmount) <= 0}
              className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
                You confirmed the final amount and the booking is now in your
                service history.
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

      <aside className="card-soft h-fit min-w-0 p-5 sm:p-6 lg:sticky lg:top-24">
        {searching ? (
          <div>
            <div className="rounded-2xl bg-ink p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-xl text-ink">
                  {retrying ? (
                    <FiRefreshCw className="motion-safe:animate-spin" />
                  ) : (
                    <FiNavigation />
                  )}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
                  Automatic
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold">
                {retrying ? "Finding more garages" : "Your request is live"}
              </h3>
              <p className="mt-1.5 text-sm leading-5 text-white/65">
                {retrying
                  ? searchRound === 3
                    ? "The 20 km pass ended without an acceptance, so matching is restarting at 5 km."
                    : `Matching is expanding from ${searchRadiusKm} km to ${nextSearchRadiusKm} km.`
                  : `Every newly eligible verified garage within ${searchRadiusKm} km can receive this request.`}
              </p>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-bold">What happens next</h3>
              <div className="mt-4 grid gap-0">
                {[
                  {
                    label: retrying
                      ? `${nextSearchRadiusKm} km round starts`
                      : `${searchRadiusKm} km garages are notified`,
                    description: "Only verified, eligible partners receive the request.",
                  },
                  {
                    label: "First qualified garage accepts",
                    description: "Availability and service coverage are checked again.",
                  },
                  {
                    label: "You get instant confirmation",
                    description: "Garage details will appear here automatically.",
                  },
                ].map((item, index) => (
                  <div key={item.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          index === 0
                            ? "bg-brand text-ink"
                            : "bg-bg-soft text-muted"
                        }`}
                      >
                        {index + 1}
                      </span>
                      {index < 2 && <span className="my-1 h-full min-h-7 w-px bg-line" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-1 flex items-start gap-3 rounded-2xl bg-brand-soft/55 p-4">
              <FiShield className="mt-0.5 shrink-0 text-brand-dark" />
              <p className="text-xs leading-5 text-muted">
                Your booking stays active during matching. You do not need to keep this page open.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadBooking()}
              disabled={refreshing}
              className="btn-ghost mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={refreshing ? "motion-safe:animate-spin" : ""} />
              {refreshing ? "Checking..." : "Check for updates"}
            </button>

            <button
              type="button"
              onClick={cancelBooking}
              disabled={actionLoading === "cancel"}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
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
                  label="OTP expires (2-hour validity)"
                  value={new Date(booking.handoverOtpExpiresAt).toLocaleString(
                    "en-IN",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Asia/Kolkata",
                      timeZoneName: "short",
                    },
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
                    className={actionLoading === "otp" ? "motion-safe:animate-spin" : ""}
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

        <h3 className="text-sm font-bold">Booking summary</h3>
        <div className="mt-4 grid gap-3 text-sm">
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
          </div>

        </div>
      </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        booking={booking}
        review={booking.review}
        onClose={() => setReviewOpen(false)}
        onSaved={handleReviewSaved}
      />
    </>
  );
}

export { Tracking };
export default Tracking;
