import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiBriefcase,
  FiCheckCircle,
  FiCreditCard,
  FiStar,
  FiAlertCircle,
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

  useEffect(() => {
    const load = async () => {
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
        dispatch(setBookings(requestsResult));
        dispatch(
          setWallet({
            ...(walletData.wallet || {}),
            balance: walletData.wallet?.balance || 0,
            transactions: wallet.transactions || [],
            activation: walletData.activation,
          }),
        );
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to load garage dashboard",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [garageToken]);

  const activeBookings = bookings.filter(
    (b) =>
      !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(b.status),
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
      value: bookings.filter((b) =>
        ["CONFIRMED", "IN_PROGRESS", "ACCEPTED"].includes(b.status),
      ).length,
      icon: FiBriefcase,
      color: "blue",
    },
    {
      label: "Completed Services",
      value: bookings.filter((b) => b.status === "COMPLETED").length,
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {garage?.ownerName?.split(" ")[0] || "Partner"}!
        </h1>
        <p className="text-muted">
          Here's what's happening at {garage?.name || "your garage"}
        </p>
      </div>

      {!garage?.isActive && (
        <div className="card-soft p-5 border border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-1 text-yellow-700" />
            <div>
              <h2 className="font-bold text-yellow-900">Activation pending</h2>
              <p className="text-sm text-yellow-800">
                Keep ₹{activation.minimumBalance || 1000}+ in your wallet to
                activate customer visibility.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-white px-3 py-1">
                  Wallet: ₹{balance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatsCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="card-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Ratings & Reviews</h2>
          <div className="flex items-center gap-2">
            <FiStar className="w-6 h-6 text-brand" />
            <span className="text-2xl font-bold">
              {garage?.rating || "0.0"}
            </span>
            <span className="text-muted">
              ({garage?.reviewCount || 0} reviews)
            </span>
          </div>
        </div>
        <p className="text-muted text-sm">
          Reviews will appear here after completed customer bookings.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Bookings</h2>
          <button
            onClick={() => navigate("/garage/bookings")}
            className="text-brand font-semibold hover:underline"
          >
            View All
          </button>
        </div>
        <div className="grid gap-4">
          {loading ? (
            <div className="card-soft p-5 text-muted">Loading bookings...</div>
          ) : bookings.length > 0 ? (
            bookings
              .slice(0, 3)
              .map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))
          ) : (
            <div className="card-soft p-5 text-muted">
              No garage requests yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
