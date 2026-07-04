import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiCreditCard,
  FiRefreshCw,
  FiStar,
} from "react-icons/fi";
import StatsCard from "@/components/garage/StatsCard";
import BookingCard from "@/components/garage/BookingCard";
import { setBookings, setWallet } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

export default function GarageDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { garage, bookings, wallet } = useSelector((state) => state.garage);
  const { garageToken, refreshGarage } = useApp();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    if (!garageToken) return;

    setLoading(true);
    setError("");

    try {
      const [requestsResult, walletData] = await Promise.all([
        garageApi.getRequests(garageToken, "").catch((err) => {
          if (err.response?.status === 404) return [];
          throw err;
        }),
        garageApi.getWallet(garageToken),
        refreshGarage(garageToken),
      ]);

      dispatch(setBookings(requestsResult || []));

      dispatch(
        setWallet({
          ...(walletData.wallet || {}),
          balance: walletData.wallet?.balance || 0,
          transactions: wallet.transactions || [],
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
  }, [garageToken]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Welcome back, {garage?.ownerName?.split(" ")[0] || "Partner"}!
          </h1>

          <p className="mt-1 text-sm text-muted">
            Here's what's happening at {garage?.name || "your garage"}.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!garage?.isActive && (
        <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-yellow-700">
              <FiAlertCircle />
            </div>

            <div className="min-w-0">
              <h2 className="font-bold text-yellow-900">
                Activation pending
              </h2>

              <p className="mt-1 text-sm text-yellow-800">
                Keep ₹{activation.minimumBalance || 100}+ in your wallet to
                activate customer visibility.
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
        <div className="card-soft rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">Ratings & Reviews</h2>
              <p className="mt-1 text-xs text-muted">
                Customer feedback summary
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2">
              <FiStar className="text-brand-dark" />
              <span className="text-xl font-bold text-ink">
                {garage?.rating || "0.0"}
              </span>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted">
            {garage?.reviewCount || 0} reviews. Reviews will appear here after
            completed customer bookings.
          </p>
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
              className="inline-flex h-9 items-center justify-center rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
            >
              View All
            </button>
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
