import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  FiPhone,
  FiMessageSquare,
  FiMapPin,
  FiClock,
  FiCheckCircle,
} from "react-icons/fi";
import ImageUpload from "@/components/garage/ImageUpload";
import { setBookings } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

const timelineSteps = [
  { status: "NEW", label: "Request Sent" },
  { status: "ACCEPTED", label: "Booking Accepted" },
  { status: "CONFIRMED", label: "Vehicle Handover" },
  { status: "IN_PROGRESS", label: "Service In Progress" },
  { status: "COMPLETED", label: "Completed" },
];

export default function GarageBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { garageToken } = useApp();
  const { bookings } = useSelector((state) => state.garage);
  const [preServiceImages, setPreServiceImages] = useState([]);
  const [postServiceImages, setPostServiceImages] = useState([]);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/garage/bookings")}
          className="text-muted hover:text-ink"
        >
          Back to Bookings
        </button>
        <div className="card-soft p-6 text-muted">
          Booking not found. Open it from the bookings list after refreshing.
        </div>
      </div>
    );
  }

  const updateLocalStatus = (status) => {
    dispatch(
      setBookings(
        bookings.map((item) =>
          item.id === booking.id ? { ...item, status } : item,
        ),
      ),
    );
  };

  const verifyHandover = async () => {
    if (preServiceImages.length < 5 || !otp) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await garageApi.verifyHandoverOtp(
        garageToken,
        booking.requestId || booking.id,
        otp,
        preServiceImages,
      );
      updateLocalStatus("IN_PROGRESS");
      setSuccess("Vehicle handover verified and service started.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify handover OTP");
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async () => {
    if (postServiceImages.length < 5) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await garageApi.markDelivered(
        garageToken,
        booking.requestId || booking.id,
        postServiceImages,
      );
      updateLocalStatus("COMPLETED");
      setSuccess("Booking marked delivered successfully.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to mark booking delivered",
      );
    } finally {
      setLoading(false);
    }
  };

  const openGoogleMaps = () => {
    const { lat, lng } = booking.customer.location || {};
    if (lat && lng)
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const currentStepIndex = Math.max(
    0,
    timelineSteps.findIndex((s) => s.status === booking.status),
  );

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/garage/bookings")}
        className="text-muted hover:text-ink flex items-center gap-2"
      >
        Back to Bookings
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 p-4 text-green-700">
          {success}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-soft p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">
                  {booking.bookingId || booking.id}
                </h1>
                <p className="text-muted">
                  {new Date(booking.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="chip-brand">
                {booking.status.replaceAll("_", " ")}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-bold mb-3">Vehicle Details</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted">Make & Model:</span>{" "}
                    {booking.vehicle.brand} {booking.vehicle.model}
                  </p>
                  <p>
                    <span className="text-muted">Year:</span>{" "}
                    {booking.vehicle.year || "N/A"}
                  </p>
                  <p>
                    <span className="text-muted">Number:</span>{" "}
                    {booking.vehicle.number || "N/A"}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-3">Services</h3>
                <div className="space-y-1 text-sm">
                  {booking.services.map((service, idx) => (
                    <div
                      key={service.id || idx}
                      className="flex justify-between"
                    >
                      <span>{service.name}</span>
                      <span className="font-semibold">
                        ₹{Number(service.price || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-line mt-2">
                    <div className="flex justify-between font-bold">
                      <span>Estimated Total</span>
                      <span>
                        ₹{" "}
                        {Number(booking.estimatedBill || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {booking.status === "ACCEPTED" || booking.status === "CONFIRMED" ? (
            <div className="card-soft p-6">
              <h3 className="text-xl font-bold mb-4">Receive Vehicle</h3>
              <p className="text-muted mb-4">
                Enter the customer handover OTP and upload 5 vehicle photos,
                each 1 MB or less.
              </p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit handover OTP"
                className="mb-4 w-full rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
              />
              <ImageUpload
                min={5}
                max={5}
                value={preServiceImages}
                onChange={setPreServiceImages}
              />
              <button
                onClick={verifyHandover}
                disabled={loading || preServiceImages.length < 5 || !otp}
                className="btn-primary w-full mt-6"
              >
                {loading ? "Verifying..." : "Verify Handover & Start Service"}
              </button>
            </div>
          ) : null}

          {booking.status === "IN_PROGRESS" ? (
            <div className="card-soft p-6">
              <h3 className="text-xl font-bold mb-4">Complete Service</h3>
              <p className="text-muted mb-4">
                Upload 5 post-service photos, each 1 MB or less, before marking
                delivery complete.
              </p>
              <ImageUpload
                min={5}
                max={5}
                value={postServiceImages}
                onChange={setPostServiceImages}
              />
              <button
                onClick={markDelivered}
                disabled={loading || postServiceImages.length < 5}
                className="btn-primary w-full mt-6"
              >
                {loading ? "Completing..." : "Mark Delivered"}
              </button>
            </div>
          ) : null}

          <div className="card-soft p-6">
            <h3 className="text-xl font-bold mb-4">Live Timeline</h3>
            <div className="space-y-4">
              {timelineSteps
                .slice(0, currentStepIndex + 1)
                .map((step, index) => (
                  <div key={step.status} className="flex gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${index === currentStepIndex ? "bg-brand text-black" : "bg-line text-muted"}`}
                    >
                      {index < currentStepIndex ? (
                        <FiCheckCircle />
                      ) : (
                        <FiClock />
                      )}
                    </div>
                    <div className="pb-4 border-l-2 border-line pl-4 -ml-1 mt-1">
                      <p className="font-semibold">{step.label}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-soft p-6">
            <h3 className="font-bold mb-4">Customer Details</h3>
            <div className="space-y-3 text-sm mb-4">
              <p>
                <span className="text-muted">Name:</span>{" "}
                <span className="font-semibold">{booking.customer.name}</span>
              </p>
              <p>
                <span className="text-muted">Phone:</span>{" "}
                <span className="font-semibold">
                  {booking.customer.phone || "N/A"}
                </span>
              </p>
              <p>
                <span className="text-muted">Address:</span>{" "}
                <span className="font-semibold">
                  {booking.customer.address || "N/A"}
                </span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  booking.customer.phone &&
                  window.open(`tel:${booking.customer.phone}`, "_blank")
                }
                className="btn-ghost flex-col gap-2 py-3"
              >
                <FiPhone className="w-5 h-5" />
                <span className="text-xs font-semibold">Call</span>
              </button>
              <button
                onClick={() =>
                  booking.customer.phone &&
                  window.open(
                    `https://wa.me/${booking.customer.phone.replace(/\D/g, "")}`,
                    "_blank",
                  )
                }
                className="btn-ghost flex-col gap-2 py-3"
              >
                <FiMessageSquare className="w-5 h-5" />
                <span className="text-xs font-semibold">WhatsApp</span>
              </button>
              <button
                onClick={openGoogleMaps}
                className="btn-primary flex-col gap-2 py-3"
              >
                <FiMapPin className="w-5 h-5" />
                <span className="text-xs font-semibold">Navigate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
