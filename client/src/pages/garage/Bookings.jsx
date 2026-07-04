import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import BookingCard from "@/components/garage/BookingCard";
import { setBookings } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

const statusFilters = [
  "All",
  "New",
  "Accepted",
  "Confirmed",
  "In Progress",
  "Completed",
  "Rejected",
  "Expired",
];

const toStatus = (filter) => {
  if (filter === "All") return "";
  if (filter === "New") return "SENT";
  return filter.replaceAll(" ", "_").toUpperCase();
};

export default function GarageBookings() {
  const { bookings } = useSelector((state) => state.garage);
  const dispatch = useDispatch();
  const { garageToken } = useApp();

  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  const safeBookings = Array.isArray(bookings) ? bookings : [];

  const loadBookings = useCallback(
    async ({ initial = false } = {}) => {
      if (!garageToken || requestInFlight.current) return;

      requestInFlight.current = true;
      if (initial) setLoading(true);
      else setRefreshing(true);

      try {
        const data = await garageApi.getRequests(
          garageToken,
          toStatus(activeFilter),
        );

        dispatch(setBookings(Array.isArray(data) ? data : []));
        setError("");
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to load bookings",
        );
      } finally {
        requestInFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilter, dispatch, garageToken],
  );

  useEffect(() => {
    loadBookings({ initial: true });
  }, [loadBookings]);

  useEffect(() => {
    if (!garageToken) return undefined;

    const interval = window.setInterval(() => {
      loadBookings();
    }, 5000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadBookings();
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [garageToken, loadBookings]);

  const handleAccept = async (booking) => {
    try {
      setError("");

      const updated = await garageApi.acceptRequest(
        garageToken,
        booking.requestId || booking.id,
      );

      dispatch(
        setBookings(
          safeBookings.map((item) =>
            item.id === booking.id ? updated : item,
          ),
        ),
      );

      // Refresh once because accepting also expires the same booking's other
      // garage requests and changes the underlying booking status.
      await loadBookings();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to accept booking",
      );
    }
  };

  const handleDecline = async (booking) => {
    try {
      setError("");

      const updated = await garageApi.rejectRequest(
        garageToken,
        booking.requestId || booking.id,
      );

      dispatch(
        setBookings(
          safeBookings.map((item) =>
            item.id === booking.id ? updated : item,
          ),
        ),
      );

      await loadBookings();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to decline booking",
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-muted">
            New nearby requests refresh automatically every five seconds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadBookings()}
          disabled={loading || refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw
            className={loading || refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="card-soft rounded-2xl p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={[
                "h-9 shrink-0 rounded-full px-4 text-xs font-bold transition sm:text-sm",
                activeFilter === filter
                  ? "bg-brand text-black"
                  : "bg-bg-soft text-muted hover:bg-line hover:text-ink",
              ].join(" ")}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3">
        {loading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading bookings...
          </div>
        ) : safeBookings.length > 0 ? (
          safeBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))
        ) : (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            No bookings found.
          </div>
        )}
      </section>
    </div>
  );
}
