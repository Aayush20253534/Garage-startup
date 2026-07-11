import { useEffect, useState } from "react";
import {
  FiCalendar,
  FiEdit3,
  FiRefreshCw,
  FiStar,
  FiTool,
  FiTruck,
} from "react-icons/fi";
import ReviewModal from "@/components/reviews/ReviewModal";
import { useApp } from "@/hooks/useApp";

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getServicesText = (booking) => {
  return (
    booking.services
      ?.map((item) => item.service?.name)
      .filter(Boolean)
      .join(", ") || "Vehicle Service"
  );
};

const getGarageText = (booking) =>
  booking.garage?.name || "Auto-assigned garage";

const getVehicleText = (booking) => {
  const vehicle = booking.vehicle;

  if (!vehicle) return "Saved vehicle";

  return (
    `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
    vehicle.registrationNumber ||
    "Saved vehicle"
  );
};

const getAmount = (booking) => {
  return Number(booking.totalServiceAmount || 0);
};

const getAmountText = (booking) => {
  const amount = getAmount(booking);

  return amount > 0 ? `\u20b9${amount.toLocaleString("en-IN")}` : "Not recorded";
};

function RatingDisplay({ review }) {
  if (!review) {
    return <span className="text-muted">Not rated</span>;
  }

  return (
    <div>
      <div className="flex items-center gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((value) => (
          <FiStar
            key={value}
            fill={value <= Number(review.rating || 0) ? "currentColor" : "none"}
          />
        ))}
      </div>
      {review.comment && (
        <p className="mt-1 max-w-xs text-xs text-muted">{review.comment}</p>
      )}
    </div>
  );
}

export default function ServiceHistory() {
  const {
    fetchServiceHistory,
    clearBookingCaches,
    serviceHistoryCache,
  } = useApp();

  const [history, setHistory] = useState(() =>
    Array.isArray(serviceHistoryCache) ? serviceHistoryCache : [],
  );
  const [loading, setLoading] = useState(
    () => !Array.isArray(serviceHistoryCache),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewBooking, setReviewBooking] = useState(null);

  const loadHistory = async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else if (!Array.isArray(serviceHistoryCache)) setLoading(true);

      setError("");

      const data = await fetchServiceHistory({ force });
      setHistory(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load service history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleReviewSaved = (savedReview) => {
    setHistory((current) =>
      current.map((booking) =>
        booking.id === savedReview.bookingId
          ? { ...booking, review: savedReview }
          : booking,
      ),
    );
    setReviewBooking((current) =>
      current?.id === savedReview.bookingId
        ? { ...current, review: savedReview }
        : current,
    );
    clearBookingCaches?.();
    setSuccess(
      reviewBooking?.review
        ? "Review updated successfully."
        : "Review submitted successfully.",
    );
  };

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">Service History</h2>
        <div className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-sm">
          Loading service history...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="min-w-0 text-2xl font-bold sm:text-3xl">
          Service History
        </h2>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadHistory({ force: true })}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3.5 text-sm font-medium text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-3">
        {history.map((booking) => {
          const completedDate = formatDate(
            booking.customerAcceptedAt ||
              booking.updatedAt ||
              booking.createdAt,
          );

          return (
            <article
              key={booking.id}
              className="overflow-hidden rounded-lg border border-line bg-white shadow-sm transition hover:border-ink/15 hover:shadow-md"
            >
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="break-words text-xs font-medium leading-snug text-muted">
                        #{booking.bookingCode || booking.id}
                      </div>

                      <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-ink">
                        {getServicesText(booking)}
                      </h3>
                    </div>

                    <span className="inline-flex h-7 w-fit shrink-0 items-center rounded-md border border-green-200 bg-green-50 px-2.5 text-[11px] font-bold text-green-700">
                      COMPLETED
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
                      <FiTruck className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          Vehicle
                        </p>
                        <p className="truncate font-medium text-ink">
                          {getVehicleText(booking)}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
                      <FiTool className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          Garage
                        </p>
                        <p className="truncate font-medium text-ink">
                          {getGarageText(booking)}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
                      <FiStar className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          Rating
                        </p>
                        <RatingDisplay review={booking.review} />
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="flex flex-col justify-center border-t border-line bg-bg-soft/50 p-4 sm:p-5 lg:border-l lg:border-t-0">
                  <div className="mb-3 grid gap-2 text-sm">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <FiCalendar className="h-3.5 w-3.5" />
                        Completed
                      </p>
                      <p className="mt-1 font-semibold text-ink">
                        {completedDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted">
                        Final amount
                      </p>
                      <p className="mt-1 text-lg font-bold text-ink">
                        {getAmountText(booking)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand px-3.5 text-sm font-semibold text-black shadow-sm transition hover:bg-brand-dark"
                    onClick={() => {
                      setSuccess("");
                      setReviewBooking(booking);
                    }}
                  >
                    {booking.review ? <FiEdit3 /> : <FiStar />}
                    {booking.review ? "Edit Review" : "Rate Garage"}
                  </button>
                </aside>
              </div>
            </article>
          );
        })}

        {history.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-muted shadow-sm">
            No completed services yet.
          </div>
        )}
      </div>

      <ReviewModal
        open={Boolean(reviewBooking)}
        booking={reviewBooking}
        review={reviewBooking?.review}
        onClose={() => setReviewBooking(null)}
        onSaved={handleReviewSaved}
      />
    </div>
  );
}
