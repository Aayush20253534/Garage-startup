import { useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiMessageSquare,
  FiRefreshCw,
  FiStar,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import StatsCard from "@/components/garage/StatsCard";
import BookingCard from "@/components/garage/BookingCard";
import { setBookings, setWallet } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

const formatDashboardDate = (value) => {
  if (!value) return "Recently";

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
};

const getReviewCustomerName = (review) =>
  review?.user?.name || review?.customer?.name || "Customer";

const getReviewBookingLabel = (review) => {
  const booking = review?.booking || {};
  const vehicle = booking.vehicle || review?.vehicle || {};
  const vehicleName = [
    vehicle.brand,
    vehicle.model,
    vehicle.registrationNumber || vehicle.number,
  ]
    .filter(Boolean)
    .join(" · ");

  return vehicleName || booking.bookingCode || "Completed service";
};

function RatingStars({ rating = 0, size = "text-base" }) {
  const roundedRating = Math.round(Number(rating || 0));

  return (
    <div className={`flex items-center gap-1 text-amber-500 ${size}`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <FiStar
          key={value}
          fill={value <= roundedRating ? "currentColor" : "none"}
          className="shrink-0"
        />
      ))}
    </div>
  );
}

export default function GarageDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { garage, bookings, wallet } = useSelector((state) => state.garage);
  const { garageToken, refreshGarage, authLoading } = useApp();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    if (!garageToken) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [requestsResult, walletData] = await Promise.all([
        garageApi.getRequests("").catch((err) => {
          if (err.response?.status === 404) return [];
          throw err;
        }),
        garageApi.getWallet(),
        refreshGarage(),
      ]);

      dispatch(setBookings(requestsResult || []));

      dispatch(
        setWallet({
          ...(walletData.wallet || {}),
          balance: walletData.wallet?.balance || 0,
          transactions: walletData.transactions || wallet.transactions || [],
          activation: walletData.activation,
        })
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load garage dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [garageToken, authLoading]);

  const safeBookings = Array.isArray(bookings) ? bookings : [];

  const activeBookings = safeBookings.filter(
    (booking) =>
      !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(
        booking.status
      )
  );

  const activeServices = safeBookings.filter((booking) =>
    ["CONFIRMED", "IN_PROGRESS", "ACCEPTED"].includes(booking.status)
  );

  const completedServices = safeBookings.filter(
    (booking) => booking.status === "COMPLETED"
  );

  const averageRating = Number(garage?.ratingAvg ?? garage?.rating ?? 0);
  const reviewCount = Number(garage?.ratingCount ?? garage?.reviewCount ?? 0);

  const recentReviews = useMemo(() => {
    const profileReviews = Array.isArray(garage?.reviews) ? garage.reviews : [];
    const bookingReviews = safeBookings
      .map((booking) => booking.review || booking.raw?.booking?.review)
      .filter(Boolean);

    const reviewByKey = new Map();
    [...profileReviews, ...bookingReviews].forEach((review, index) => {
      const key = review.id || review.bookingId || `review-${index}`;
      reviewByKey.set(key, review);
    });

    return [...reviewByKey.values()]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 3);
  }, [garage?.reviews, safeBookings]);

  const activation = garage?.activation || {};
  const balance = wallet?.balance || garage?.walletBalance || 0;

  const stats = [
    {
      label: "Open Requests",
      value: activeBookings.length,
      icon: FiCalendar,
      color: "brand",
    },
    {
      label: "Active Services",
      value: activeServices.length,
      icon: FiBriefcase,
      color: "blue",
    },
    {
      label: "Completed Services",
      value: completedServices.length,
      icon: FiCheckCircle,
      color: "purple",
    },
    {
      label: "Wallet Balance",
      value: `₹${balance.toLocaleString()}`,
      icon: FiCreditCard,
      color: "orange",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-ink p-5 text-white shadow-soft sm:p-6">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-soft">
              Garage dashboard
            </p>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
              Welcome back, {garage?.ownerName?.split(" ")[0] || "Partner"}!
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Monitor service requests, customer satisfaction, and wallet health
              for {garage?.name || "your garage"}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/garage/bookings")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
            >
              Manage jobs
              <FiArrowRight />
            </button>
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {!garage?.isActive && (
        <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-yellow-700">
              <FiAlertCircle />
            </div>

            <div className="min-w-0">
              <h2 className="font-bold text-yellow-900">Activation pending</h2>

              <p className="mt-1 text-sm text-yellow-800">
                Recharge at least ₹{activation.minimumBalance || 100} once to
                activate customer visibility. After activation, your balance may
                go below this amount.
              </p>

              <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-yellow-900">
                Wallet: ₹{balance.toLocaleString()}
              </div>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card-soft overflow-hidden rounded-2xl shadow-sm">
          <div className="border-b border-line bg-bg-soft/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-ink">Ratings & Reviews</h2>
                <p className="mt-1 text-xs text-muted">
                  Live customer feedback summary
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-ink">
                <FiStar fill="currentColor" />
              </div>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <span className="text-4xl font-black text-ink">
                {averageRating.toFixed(1)}
              </span>
              <div className="pb-1">
                <RatingStars rating={averageRating} />
                <p className="mt-1 text-xs font-semibold text-muted">
                  {reviewCount} verified review{reviewCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            {recentReviews.length ? (
              recentReviews.map((review) => (
                <article
                  key={review.id || review.bookingId}
                  className="rounded-2xl border border-line bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-soft text-muted">
                        <FiUser />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">
                          {getReviewCustomerName(review)}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {getReviewBookingLabel(review)}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                      {review.rating}/5
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm text-ink">
                    {review.comment || "No written comment submitted."}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                    <FiClock />
                    {formatDashboardDate(review.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-2xl bg-bg-soft p-4 text-sm text-muted">
                <div className="mb-2 flex items-center gap-2 font-bold text-ink">
                  <FiMessageSquare />
                  No reviews yet
                </div>
                Reviews from completed and accepted customer bookings will show
                here automatically.
              </div>
            )}
          </div>
        </div>

        <div className="card-soft rounded-2xl p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">Recent Bookings</h2>
              <p className="mt-1 text-xs text-muted">
                Latest service requests from customers
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/garage/bookings")}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
            >
              View All
              <FiArrowRight />
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-bg-soft p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted">
                <FiTrendingUp /> Conversion
              </p>
              <p className="mt-1 text-xl font-black text-ink">
                {safeBookings.length
                  ? Math.round((completedServices.length / safeBookings.length) * 100)
                  : 0}
                %
              </p>
            </div>
            <div className="rounded-2xl bg-bg-soft p-3">
              <p className="text-xs font-semibold text-muted">Pending action</p>
              <p className="mt-1 text-xl font-black text-ink">
                {activeBookings.length}
              </p>
            </div>
            <div className="rounded-2xl bg-bg-soft p-3">
              <p className="text-xs font-semibold text-muted">Review score</p>
              <p className="mt-1 text-xl font-black text-ink">
                {averageRating.toFixed(1)} / 5
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {loading ? (
              <div className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
                Loading bookings...
              </div>
            ) : safeBookings.length > 0 ? (
              safeBookings
                .slice(0, 3)
                .map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))
            ) : (
              <div className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
                No garage requests yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
