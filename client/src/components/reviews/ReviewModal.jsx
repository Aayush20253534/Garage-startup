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
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
          <div>
            <p className="inline-flex rounded-md border border-line bg-bg-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Booking #{booking.bookingCode || booking.id}
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {review ? "Update your review" : "Rate your garage"}
            </h2>
            <p className="mt-1 text-base text-muted">
              {booking.garage?.name || "Garage service"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted shadow-sm transition hover:border-ink/20 hover:bg-bg-soft hover:text-ink disabled:opacity-50"
            aria-label="Close review form"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={submitReview} className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="text-sm font-semibold text-ink">
                Star rating
              </label>
              <p className="text-xs text-muted">
                {rating
                  ? `${rating} out of 5 selected`
                  : "Choose between 1 and 5"}
              </p>
            </div>

            <div
              className="flex w-fit gap-1.5 rounded-lg border border-line bg-bg-soft p-1.5"
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
                    className="grid h-10 w-10 place-items-center rounded-md text-2xl text-amber-400 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand/50"
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  >
                    <FiStar fill={active ? "currentColor" : "none"} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-end justify-between gap-3">
              <label
                htmlFor="review-comment"
                className="text-sm font-semibold text-ink"
              >
                Review
              </label>
              <span className="text-xs text-muted">
                {comment.length}/{MAX_COMMENT_LENGTH}
              </span>
            </div>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) =>
                setComment(event.target.value.slice(0, MAX_COMMENT_LENGTH))
              }
              rows={5}
              placeholder="Describe the service quality, communication, pickup, and delivery experience."
              className="w-full resize-none rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-muted/80 focus:border-ink"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !rating}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
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
