import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import BookingCard from "@/components/garage/BookingCard";
import { setBookings, setWallet } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { formatRupees } from "@/utils/priceRange";
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
          className="h-4 w-4 shrink-0"
        />
      ))}
    </div>
  );
}

function GarageStatCard({ label, value, icon: Icon }) {
  return (
    <div className="group relative min-h-[126px] overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/5 via-white to-brand/10 p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:min-h-[150px] sm:p-5">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-brand/60" />

      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold leading-4 text-slate-700 sm:text-sm sm:leading-5">
            {label}
          </p>

          <p className="mt-4 truncate text-2xl font-bold tracking-tight text-ink sm:mt-5 sm:text-3xl">
            {value}
          </p>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand-dark shadow-sm ring-1 ring-brand/20 transition-transform group-hover:scale-105 sm:h-11 sm:w-11">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
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

  const refreshGarageRef = useRef(refreshGarage);
  const walletTransactionsRef = useRef(wallet?.transactions || []);

  useEffect(() => {
    refreshGarageRef.current = refreshGarage;
  }, [refreshGarage]);

  useEffect(() => {
    walletTransactionsRef.current = wallet?.transactions || [];
  }, [wallet?.transactions]);

  const loadDashboard = useCallback(async () => {
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
        refreshGarageRef.current(),
      ]);

      dispatch(setBookings(requestsResult || []));

      dispatch(
        setWallet({
          ...(walletData.wallet || {}),
          balance: walletData.wallet?.balance || 0,
          transactions:
            walletData.transactions || walletTransactionsRef.current || [],
          activation: walletData.activation,
        })
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load garage dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, [garageToken, authLoading, dispatch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const safeBookings = useMemo(
    () => (Array.isArray(bookings) ? bookings : []),
    [bookings]
  );

  const activeBookings = useMemo(
    () =>
      safeBookings.filter(
        (booking) =>
          !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(
            booking.status
          )
      ),
    [safeBookings]
  );

  const activeServices = useMemo(
    () =>
      safeBookings.filter((booking) =>
        ["CONFIRMED", "IN_PROGRESS", "ACCEPTED"].includes(booking.status)
      ),
    [safeBookings]
  );

  const completedServices = useMemo(
    () => safeBookings.filter((booking) => booking.status === "COMPLETED"),
    [safeBookings]
  );

  const averageRating = Number(garage?.ratingAvg ?? garage?.rating ?? 0);
  const reviewCount = Number(garage?.ratingCount ?? garage?.reviewCount ?? 0);

  const recentReviews = useMemo(() => {
    const profileReviews = Array.isArray(garage?.reviews)
      ? garage.reviews
      : [];

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

  const activation = garage?.activation || wallet?.activation || {};
  const balance = wallet?.balance || garage?.walletBalance || 0;

  const acceptedServices = useMemo(
    () =>
      safeBookings.filter((booking) =>
        ["ACCEPTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(
          booking.status
        )
      ),
    [safeBookings]
  );

  const acceptanceRate = safeBookings.length
    ? Math.round((acceptedServices.length / safeBookings.length) * 100)
    : 0;

  const completionRate = safeBookings.length
    ? Math.round((completedServices.length / safeBookings.length) * 100)
    : 0;

  const stats = useMemo(
    () => [
      {
        label: "Open Requests",
        value: activeBookings.length,
        icon: FiCalendar,
      },
      {
        label: "Active Services",
        value: activeServices.length,
        icon: FiBriefcase,
      },
      {
        label: "Completed Services",
        value: completedServices.length,
        icon: FiCheckCircle,
      },
      {
        label: "Wallet Balance",
        value: formatRupees(balance),
        icon: FiCreditCard,
      },
    ],
    [
      activeBookings.length,
      activeServices.length,
      completedServices.length,
      balance,
    ]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand/5">
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header Section */}
        <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm ring-1 ring-black/[0.03] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  Welcome back,{" "}
                  {garage?.ownerName?.split(" ")[0] || "Partner"}
                </h1>

                <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand-dark ring-1 ring-brand/20">
                  Garage Portal
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Monitor service requests, customer satisfaction, and wallet
                health for {garage?.name || "your garage"}.
              </p>
            </div>

            <div className="grid grid-cols-[44px_1fr] gap-2 sm:flex sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
                aria-label="Refresh dashboard"
              >
                <FiRefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>

              <button
                type="button"
                onClick={() => navigate("/garage/bookings")}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-black shadow-sm transition hover:-translate-y-0.5 hover:brightness-95 sm:h-10 sm:w-auto"
              >
                Manage Jobs
                <FiArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Alerts */}
        {!garage?.isActive && (
          <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-amber-900">
                  Activation pending
                </h3>
                <p className="mt-0.5 leading-5 text-amber-800">
                  Recharge at least{" "}
                  {formatRupees(activation.minimumBalance || 100)} once to
                  activate customer visibility.
                </p>
              </div>

              <div className="inline-flex w-full justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 font-semibold text-amber-900 shadow-sm sm:w-auto sm:shrink-0">
                Wallet: {formatRupees(balance)}
              </div>
            </div>
          </section>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <GarageStatCard key={stat.label} {...stat} />
          ))}
        </section>

        {/* Main Content Area */}
        <section className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          {/* Ratings & Reviews */}
          <div className="order-2 flex flex-col gap-4 lg:order-1">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm ring-1 ring-black/[0.02]">
              <div className="border-b border-slate-100 bg-gradient-to-br from-brand/5 via-white to-amber-50/50 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-ink">
                      Ratings & Reviews
                    </h2>
                    <p className="text-sm text-muted">
                      Live customer feedback
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-500">
                    <FiStar className="h-5 w-5" fill="currentColor" />
                  </div>
                </div>

                <div className="mt-5 flex items-end gap-3">
                  <span className="text-3xl font-bold leading-none text-ink">
                    {averageRating.toFixed(1)}
                  </span>

                  <div className="pb-0.5">
                    <RatingStars rating={averageRating} size="text-sm" />
                    <p className="mt-1 text-xs font-medium text-muted">
                      Based on {reviewCount} verified review
                      {reviewCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 bg-white p-4 sm:space-y-4 sm:p-5 lg:max-h-[500px] lg:overflow-y-auto">
                {recentReviews.length ? (
                  recentReviews.map((review) => (
                    <article
                      key={review.id || review.bookingId}
                      className="rounded-xl border border-slate-100 p-4 shadow-sm transition-colors hover:bg-slate-50/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-muted">
                            <FiUser className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {getReviewCustomerName(review)}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {getReviewBookingLabel(review)}
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex shrink-0 items-center rounded-lg border border-amber-100 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          {review.rating}/5
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink">
                        {review.comment || "No written comment submitted."}
                      </p>

                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                        <FiClock className="h-3.5 w-3.5" />
                        {formatDashboardDate(review.createdAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <FiMessageSquare className="mb-2 h-5 w-5 text-muted" />
                    <span className="text-sm font-semibold text-ink">
                      No reviews yet
                    </span>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      Reviews from completed bookings will automatically appear
                      here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="order-1 lg:order-2 lg:col-span-2">
            <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] sm:p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    Recent Bookings
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    Latest service requests from customers
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/garage/bookings")}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 sm:w-auto"
                >
                  View All
                  <FiArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-4 sm:gap-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold leading-4 text-muted sm:text-xs">
                    <FiTrendingUp className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Acceptance</span>
                  </p>
                  <p className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                    {acceptanceRate}%
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-muted sm:text-[11px]">
                    Accepted, active, or completed
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold leading-4 text-muted sm:text-xs">
                    <FiCheckCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Completion</span>
                  </p>
                  <p className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                    {completionRate}%
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-muted sm:text-[11px]">
                    Completed from total requests
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                  <p className="text-[11px] font-semibold leading-4 text-muted sm:text-xs">
                    Open
                  </p>
                  <p className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                    {activeBookings.length}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-muted sm:text-[11px]">
                    Pending or in progress
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                  <p className="text-[11px] font-semibold leading-4 text-muted sm:text-xs">
                    Rating
                  </p>
                  <p className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                    {averageRating.toFixed(1)}
                    <span className="text-xs font-normal text-muted sm:text-sm">
                      {" "}
                      / 5
                    </span>
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-muted sm:text-[11px]">
                    Verified reviews
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-muted">
                    <FiRefreshCw className="h-4 w-4 animate-spin" />
                    <span>Loading bookings...</span>
                  </div>
                ) : safeBookings.length > 0 ? (
                  safeBookings
                    .slice(0, 3)
                    .map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <FiCalendar className="mb-3 h-6 w-6 text-muted" />
                    <p className="text-sm font-semibold text-ink">
                      No garage requests yet
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      New customer service requests will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}