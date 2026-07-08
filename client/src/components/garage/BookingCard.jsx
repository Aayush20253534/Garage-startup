import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FiCheck, FiX } from "react-icons/fi";
import { formatRupees } from "@/utils/priceRange";

const statusColors = {
  NEW: "bg-yellow-100 text-yellow-700",
  SENT: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-brand-soft text-ink",
  VEHICLE_RECEIVED: "bg-purple-100 text-purple-700",
  SERVICE_STARTED: "bg-brand-soft text-ink",
  INSPECTION_COMPLETED: "bg-pink-100 text-pink-700",
  READY_FOR_DELIVERY: "bg-green-100 text-green-700",
  DELIVERED: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-700",
};

export default function BookingCard({ booking, onAccept, onDecline }) {
  const navigate = useNavigate();
  const isNewBooking = booking.status === "NEW" || booking.status === "SENT";

  const handleAccept = (e) => {
    e.stopPropagation();
    onAccept?.(booking);
  };

  const handleDecline = (e) => {
    e.stopPropagation();
    onDecline?.(booking);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-soft p-5 hover:shadow-lg transition-shadow"
    >
      <div
        className="cursor-pointer"
        onClick={() => navigate(`/garage/bookings/${booking.id}`)}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-muted text-sm font-medium">
              {booking.bookingId || booking.id}
            </p>
            <h3 className="text-lg font-bold">
              {booking.vehicle.brand} {booking.vehicle.model}
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[booking.status] || "bg-gray-100 text-gray-700"}`}
          >
            {String(booking.status).replaceAll("_", " ")}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="font-medium text-ink">
              {booking.services.map((s) => s.name).join(", ") ||
                "Service request"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {Number(booking.distance || 0).toFixed(1)} km away
            </span>
            <span className="font-bold text-ink">
              {formatRupees(booking.estimatedBill || 0)}
            </span>
          </div>
        </div>
      </div>

      {isNewBooking && onAccept && onDecline && (
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 bg-green-600 text-white hover:bg-green-700 transition-colors px-4 py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <FiCheck className="w-4 h-4" />
            Accept
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 bg-red-600 text-white hover:bg-red-700 transition-colors px-4 py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <FiX className="w-4 h-4" />
            Decline
          </button>
        </div>
      )}
    </motion.div>
  );
}
