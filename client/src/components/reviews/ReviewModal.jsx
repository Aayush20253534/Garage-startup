import { useEffect, useState } from "react";
import { FiStar, FiX } from "react-icons/fi";
import { reviewApi } from "@/api/review";

const MAX_COMMENT_LENGTH = 1000;

export default function ReviewModal({
  open,
  booking,
  review,
  onClose,
  onSaved,
}) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setRating(Number(review?.rating || 0));
    setHoveredRating(0);
    setComment(review?.comment || "");
    setError("");
  }, [open, review]);

  if (!open || !booking) return null;

  const submitReview = async (event) => {
    event.preventDefault();

    if (!rating) {
      setError("Select a star rating before submitting your review.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const payload = {
        rating,
        comment: comment.trim() || null,
      };

      const savedReview = review?.id
        ? await reviewApi.update(review.id, payload)
        : await reviewApi.create({
            bookingId: booking.id,
            ...payload,
          });

      onSaved?.(savedReview);
      onClose?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save your review. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const displayedRating = hoveredRating || rating;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Booking #{booking.bookingCode || booking.id}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink">
              {review ? "Update your review" : "Rate your garage"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {booking.garage?.name || "Garage service"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-bg-soft hover:text-ink disabled:opacity-50"
            aria-label="Close review form"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={submitReview} className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-ink">
              Star rating
            </label>
            <div
              className="mt-3 flex gap-2"
              onMouseLeave={() => setHoveredRating(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const active = value <= displayedRating;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoveredRating(value)}
                    className="rounded-xl p-1 text-3xl text-amber-400 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand/50"
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  >
                    <FiStar fill={active ? "currentColor" : "none"} />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">
              {rating
                ? `${rating} out of 5 stars selected`
                : "Choose between 1 and 5 stars"}
            </p>
          </div>

          <div>
            <label
              htmlFor="review-comment"
              className="text-sm font-semibold text-ink"
            >
              Review
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) =>
                setComment(event.target.value.slice(0, MAX_COMMENT_LENGTH))
              }
              rows={5}
              placeholder="Describe the service quality, communication, pickup, and delivery experience."
              className="mt-2 w-full resize-none rounded-2xl border border-line px-4 py-3 text-sm outline-none transition focus:border-ink"
            />
            <div className="mt-1 text-right text-xs text-muted">
              {comment.length}/{MAX_COMMENT_LENGTH}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !rating}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Saving..."
                : review
                  ? "Update Review"
                  : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
