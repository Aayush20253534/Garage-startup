import { useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiPhone,
  FiMessageSquare,
  FiMapPin,
} from "react-icons/fi";
import { mockBookings } from "@/data/garageData";
import Logo from "@/components/common/Logo";

export default function MagicLink() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const booking = mockBookings.find((b) => b.id === id) || mockBookings[0];

  const handleAccept = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setAccepted(true);
  };

  const openGoogleMaps = () => {
    const { lat, lng } = booking.customer.location;
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-bg-soft">
      <div className="container-x py-6">
        <Logo />
      </div>
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg mx-auto"
        >
          <div className="card-soft p-8 mb-6">
            <div className="text-center mb-8">
              <span className="chip-brand inline-flex items-center gap-2">
                {accepted ? "Booking Accepted" : "New Booking"}
              </span>
              <h1 className="text-3xl font-bold mt-4">{booking.id}</h1>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">
                  {booking.vehicle.brand} {booking.vehicle.model}
                </h2>
                <p className="text-muted">
                  {booking.vehicle.year} • {booking.vehicle.number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card-soft p-4 text-center">
                  <p className="text-muted text-sm">Services</p>
                  <p className="font-bold">
                    {booking.services.map((s) => s.name).join(", ")}
                  </p>
                </div>
                <div className="card-soft p-4 text-center">
                  <p className="text-muted text-sm">Est. Bill</p>
                  <p className="font-bold text-2xl">
                    Rs. {booking.estimatedBill}
                  </p>
                </div>
              </div>

              {accepted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4 pt-4 border-t border-line"
                >
                  <div className="card-soft p-5">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <FiCheckCircle className="text-brand" />
                      Customer Details
                    </h3>
                    <div className="space-y-3">
                      <p>
                        <span className="text-muted">Name:</span>{" "}
                        <span className="font-semibold">
                          {booking.customer.name}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted">Phone:</span>{" "}
                        <span className="font-semibold">
                          {booking.customer.phone}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted">Address:</span>{" "}
                        <span className="font-semibold">
                          {booking.customer.address}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() =>
                        window.open(`tel:${booking.customer.phone}`, "_blank")
                      }
                      className="btn-ghost flex-col gap-2 py-4"
                    >
                      <FiPhone className="w-6 h-6" />
                      <span className="text-sm font-semibold">Call</span>
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          `https://wa.me/${booking.customer.phone.replace(/\D/g, "")}`,
                          "_blank",
                        )
                      }
                      className="btn-ghost flex-col gap-2 py-4"
                    >
                      <FiMessageSquare className="w-6 h-6" />
                      <span className="text-sm font-semibold">WhatsApp</span>
                    </button>
                    <button
                      onClick={openGoogleMaps}
                      className="btn-primary flex-col gap-2 py-4"
                    >
                      <FiMapPin className="w-6 h-6" />
                      <span className="text-sm font-semibold">Navigate</span>
                    </button>
                  </div>

                  <button
                    onClick={() => navigate("/garage")}
                    className="btn-dark w-full py-4 text-lg"
                  >
                    Go to Dashboard
                  </button>
                </motion.div>
              )}

              {!accepted && (
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="btn-primary w-full py-5 text-xl"
                >
                  {loading
                    ? "Verifying Wallet..."
                    : "Accept Booking & Unlock Customer Details"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
