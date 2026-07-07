import { useEffect, useState } from "react";
import { FiEdit3, FiStar } from "react-icons/fi";
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

const getAmount = (booking) => {
  return Number(booking.totalServiceAmount || 0);
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
  const { fetchServiceHistory, clearBookingCaches } = useApp();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewBooking, setReviewBooking] = useState(null);

  const loadHistory = async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

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
        <div className="card-soft p-6 text-muted">
          Loading service history...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Service History</h2>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadHistory({ force: true })}
          className="btn-ghost text-sm disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-soft text-left">
              <tr>
                {[
                  "Booking",
                  "Service",
                  "Garage",
                  "Date",
                  "Amount",
                  "Rating",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {history.map((booking) => (
                <tr key={booking.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-medium">
                    #{booking.bookingCode}
                  </td>

                  <td className="px-4 py-3">{getServicesText(booking)}</td>

                  <td className="px-4 py-3">
                    {booking.garage?.name || "Auto-assigned garage"}
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(
                      booking.customerAcceptedAt ||
                        booking.updatedAt ||
                        booking.createdAt,
                    )}
                  </td>

                  <td className="px-4 py-3 font-semibold">
                    {getAmount(booking) > 0
                      ? `\u20b9${getAmount(booking).toLocaleString("en-IN")}`
                      : "Not recorded"}
                  </td>

                  <td className="px-4 py-3">
                    <RatingDisplay review={booking.review} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex min-w-max flex-col gap-2">
                      <button
                        type="button"
                        className="btn-primary !px-3 !py-1.5 text-xs"
                        onClick={() => {
                          setSuccess("");
                          setReviewBooking(booking);
                        }}
                      >
                        {booking.review ? <FiEdit3 /> : <FiStar />}
                        {booking.review ? "Edit Review" : "Rate Garage"}
                      </button>

                    </div>
                  </td>
                </tr>
              ))}

              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No completed services yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
