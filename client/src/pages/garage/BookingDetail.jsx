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
import InspectionGallery from "@/components/booking/InspectionGallery";
import LiveBookingTracking from "@/components/maps/LiveBookingTracking";
import EmbedMap from "@/components/maps/EmbedMap";
import { setBookings } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

const timelineSteps = [
  { status: "NEW", label: "Request Sent" },
  { status: "ACCEPTED", label: "Booking Accepted" },
  { status: "CONFIRMED", label: "Vehicle Handover" },
  { status: "IN_PROGRESS", label: "Service In Progress" },
  { status: "DELIVERED", label: "Awaiting Customer Acceptance" },
  { status: "COMPLETED", label: "Completed" },
];

const formatDateTime = (value) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

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

  const booking = bookings.find((item) => item.id === id);

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

  const updateLocalBooking = (patch) => {
    dispatch(
      setBookings(
        bookings.map((item) =>
          item.id === booking.id ? { ...item, ...patch } : item,
        ),
      ),
    );
  };

  const verifyHandover = async () => {
    if (preServiceImages.length !== 5 || !otp.trim()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await garageApi.verifyHandoverOtp(
        garageToken,
        booking.requestId || booking.id,
        otp.trim(),
        preServiceImages,
      );

      updateLocalBooking({
        status: "IN_PROGRESS",
        inspectionImages:
          result?.booking?.inspectionImages || booking.inspectionImages || [],
      });
      setOtp("");
      setPreServiceImages([]);
      setSuccess("Vehicle handover verified and service started.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify handover OTP");
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async () => {
    if (postServiceImages.length !== 5) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await garageApi.markDelivered(
        garageToken,
        booking.requestId || booking.id,
        postServiceImages,
      );

      updateLocalBooking({
        status: "DELIVERED",
        deliveredAt: result?.booking?.deliveredAt || new Date().toISOString(),
        inspectionImages:
          result?.booking?.inspectionImages || booking.inspectionImages || [],
      });
      setPostServiceImages([]);
      setSuccess(
        "Vehicle marked delivered. The customer must now inspect and accept delivery.",
      );
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

    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    }
  };

  const currentStepIndex = Math.max(
    0,
    timelineSteps.findIndex((step) => step.status === booking.status),
  );
  const inspectionImages = booking.inspectionImages || [];
  const isAwaitingCustomerAcceptance = booking.status === "DELIVERED";

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/garage/bookings")}
        className="flex items-center gap-2 text-muted hover:text-ink"
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card-soft p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
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

            <div className="mb-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-bold">Vehicle Details</h3>
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
                <h3 className="mb-3 font-bold">Services</h3>
                <div className="space-y-1 text-sm">
                  {booking.services.map((service, index) => (
                    <div
                      key={service.id || index}
                      className="flex justify-between gap-4"
                    >
                      <span>{service.name}</span>
                      <span className="font-semibold">
                        ₹{Number(service.price || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-line pt-2">
                    <div className="flex justify-between font-bold">
                      <span>Estimated Total</span>
                      <span>
                        ₹{Number(booking.estimatedBill || 0).toLocaleString()}
                      </span>
                    </div>
                    {Number(booking.acceptFee || 0) > 0 && (
                      <div className="mt-2 flex justify-between text-xs text-muted">
                        <span>Wallet fee deducted on accept</span>
                        <span className="font-semibold text-ink">
                          ₹{Number(booking.acceptFee || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {booking.status === "ACCEPTED" || booking.status === "CONFIRMED" ? (
            <div className="card-soft p-6">
              <h3 className="mb-2 text-xl font-bold">Receive Vehicle</h3>
              <p className="text-muted">
                Enter the customer handover OTP and upload exactly five vehicle
                photos, each 1 MB or less.
              </p>
              <p className="mt-2 text-xs text-muted">
                OTP expiry: {formatDateTime(booking.handoverOtpExpiresAt)}. The
                customer can generate a new OTP from booking tracking if needed.
              </p>
              <input
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit handover OTP"
                className="mb-4 mt-4 w-full rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
              />
              <ImageUpload
                min={5}
                max={5}
                value={preServiceImages}
                onChange={setPreServiceImages}
              />
              <button
                onClick={verifyHandover}
                disabled={
                  loading || preServiceImages.length !== 5 || otp.length !== 6
                }
                className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify Handover & Start Service"}
              </button>
            </div>
          ) : null}

          {booking.status === "IN_PROGRESS" && !booking.deliveredAt ? (
            <div className="card-soft p-6">
              <h3 className="mb-2 text-xl font-bold">Complete Service</h3>
              <p className="mb-4 text-muted">
                Upload exactly five post-service photos, each 1 MB or less,
                before marking the vehicle delivered.
              </p>
              <ImageUpload
                min={5}
                max={5}
                value={postServiceImages}
                onChange={setPostServiceImages}
              />
              <button
                onClick={markDelivered}
                disabled={loading || postServiceImages.length !== 5}
                className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Completing..." : "Mark Delivered"}
              </button>
            </div>
          ) : null}

          {isAwaitingCustomerAcceptance && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              The vehicle is marked delivered. This booking becomes completed
              only after the customer receives the vehicle and accepts delivery.
            </div>
          )}

          {inspectionImages.some((image) => image.phase === "PICKUP") && (
            <InspectionGallery
              images={inspectionImages}
              phase="PICKUP"
              title="Pickup inspection photos"
              description="Evidence recorded before the garage started service."
            />
          )}

          {inspectionImages.some((image) => image.phase === "DELIVERY") && (
            <InspectionGallery
              images={inspectionImages}
              phase="DELIVERY"
              title="Delivery inspection photos"
              description="Evidence recorded after the service was completed."
            />
          )}

          {["ACCEPTED", "CONFIRMED", "IN_PROGRESS", "DELIVERED"].includes(booking.status) && (
            <LiveBookingTracking
              bookingId={booking.bookingId}
              canShare
              title="Customer route and live sharing"
            />
          )}

          <div className="card-soft p-6">
            <h3 className="mb-4 text-xl font-bold">Live Timeline</h3>
            <div className="space-y-4">
              {timelineSteps
                .slice(0, currentStepIndex + 1)
                .map((step, index) => (
                  <div key={step.status} className="flex gap-4">
                    <div
                      className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center ${
                        index === currentStepIndex
                          ? "bg-brand text-black"
                          : "bg-line text-muted"
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <FiCheckCircle />
                      ) : (
                        <FiClock />
                      )}
                    </div>
                    <div className="-ml-1 mt-1 border-l-2 border-line pb-4 pl-4">
                      <p className="font-semibold">{step.label}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-soft p-6">
            <h3 className="mb-4 font-bold">Customer Details</h3>
            <div className="mb-4 space-y-3 text-sm">
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
            <EmbedMap
              latitude={booking.customer.location?.lat}
              longitude={booking.customer.location?.lng}
              height={220}
              title="Customer service destination"
              className="mb-4"
            />
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  booking.customer.phone &&
                  window.open(`tel:${booking.customer.phone}`, "_blank")
                }
                className="btn-ghost flex-col gap-2 py-3"
              >
                <FiPhone className="h-5 w-5" />
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
                <FiMessageSquare className="h-5 w-5" />
                <span className="text-xs font-semibold">WhatsApp</span>
              </button>
              <button
                onClick={openGoogleMaps}
                className="btn-primary flex-col gap-2 py-3"
              >
                <FiMapPin className="h-5 w-5" />
                <span className="text-xs font-semibold">Navigate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
