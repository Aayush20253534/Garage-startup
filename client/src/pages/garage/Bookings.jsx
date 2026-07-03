import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
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
  const [error, setError] = useState("");

  const loadBookings = async () => {
    if (!garageToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await garageApi.getRequests(
        garageToken,
        toStatus(activeFilter),
      );
      dispatch(setBookings(data));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [garageToken, activeFilter]);

  const handleAccept = async (booking) => {
    try {
      const updated = await garageApi.acceptRequest(
        garageToken,
        booking.requestId || booking.id,
      );
      dispatch(
        setBookings(
          bookings.map((item) => (item.id === booking.id ? updated : item)),
        ),
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to accept booking");
    }
  };

  const handleDecline = async (booking) => {
    try {
      const updated = await garageApi.rejectRequest(
        garageToken,
        booking.requestId || booking.id,
      );
      dispatch(
        setBookings(
          bookings.map((item) => (item.id === booking.id ? updated : item)),
        ),
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to decline booking");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bookings</h1>
        <p className="text-muted">Manage all your bookings</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusFilters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${activeFilter === filter ? "bg-brand text-black" : "bg-bg-soft text-muted hover:bg-line"}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="grid gap-4">
        {loading ? (
          <div className="card-soft p-5 text-muted">Loading bookings...</div>
        ) : bookings.length > 0 ? (
          bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))
        ) : (
          <div className="card-soft p-5 text-muted">No bookings found.</div>
        )}
      </div>
    </div>
  );
}
