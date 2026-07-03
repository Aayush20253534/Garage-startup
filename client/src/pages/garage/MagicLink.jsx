import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FiCheckCircle,
  FiPhone,
  FiMessageSquare,
  FiMapPin,
  FiXCircle,
} from "react-icons/fi";
import Logo from "@/components/common/Logo";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

const isUnlockedStatus = (status) =>
  ["ACCEPTED", "CONFIRMED", "IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(
    status,
  );

export default function MagicLink() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { garage, garageToken, authLoading } = useApp();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const returnState = useMemo(
    () => ({ from: { pathname: location.pathname, search: location.search } }),
    [location.pathname, location.search],
  );

  const loadRequest = async () => {
    if (!garageToken) return;

    setLoading(true);
    setError("");
    try {
      const requests = await garageApi.getRequests(garageToken, "");
      const request = requests.find(
        (item) => item.requestId === id || item.id === id || item.bookingId === id,
      );
      if (!request) {
        setBooking(null);
        setError("This request is no longer available for your garage.");
        return;
      }
      setBooking(request);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load booking request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!garageToken) {
      setLoading(false);
      return;
    }

    loadRequest();
  }, [authLoading, garageToken, id]);

  const accepted = booking && isUnlockedStatus(booking.status);
  const isPending = booking?.status === "NEW" || booking?.status === "SENT";

  const handleAccept = async () => {
    if (!booking) return;

    setActionLoading("accept");
    setError("");
    try {
      const updated = await garageApi.acceptRequest(
        garageToken,
        booking.requestId || booking.id,
      );
      setBooking(updated);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to accept booking");
    } finally {
      setActionLoading("");
    }
  };

  const handleReject = async () => {
    if (!booking) return;

    setActionLoading("reject");
    setError("");
    try {
      const updated = await garageApi.rejectRequest(
        garageToken,
        booking.requestId || booking.id,
      );
      setBooking(updated);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject booking");
    } finally {
      setActionLoading("");
    }
  };

  const openGoogleMaps = () => {
    if (booking?.customerLocationLink) {
      window.open(booking.customerLocationLink, "_blank");
      return;
    }

    const { lat, lng } = booking?.customer?.location || {};
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-soft">
        <div className="container-x py-6">
          <Logo />
        </div>
        <div className="container-x">
          <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-6 text-muted shadow-soft">
            Loading booking request...
          </div>
        </div>
      </div>
    );
  }

  if (!garage || !garageToken) {
    return (
      <div className="min-h-screen bg-bg-soft">
        <div className="container-x py-6">
          <Logo />
        </div>
        <div className="container-x">
          <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 shadow-soft">
            <span className="chip-brand">Garage request</span>
            <h1 className="mt-4 text-3xl font-bold">Sign in to respond</h1>
            <p className="mt-3 text-muted">
              This booking link is for the garage account that received the
              WhatsApp request.
            </p>
            <Link
              to="/garage/login"
              state={returnState}
              className="btn-primary mt-6 w-full py-4"
            >
              Login and continue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-soft">
      <div className="container-x py-6">
        <Logo />
      </div>
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-xl"
        >
          <div className="card-soft mb-6 p-8">
            <div className="mb-8 text-center">
              <span className="chip-brand inline-flex items-center gap-2">
                {accepted ? "Booking Accepted" : "New Booking Request"}
              </span>
              <h1 className="mt-4 text-2xl font-bold">
                {booking?.bookingId || id}
              </h1>
              {garage?.name && (
                <p className="mt-1 text-sm text-muted">{garage.name}</p>
              )}
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {booking ? (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">
                    {booking.vehicle.brand} {booking.vehicle.model}
                  </h2>
                  <p className="text-muted">
                    {[booking.vehicle.year, booking.vehicle.number]
                      .filter(Boolean)
                      .join(" | ") || "Vehicle details"}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="card-soft p-4 text-center">
                    <p className="text-sm text-muted">Services</p>
                    <p className="font-bold">
                      {booking.services.map((s) => s.name).join(", ") ||
                        "Service request"}
                    </p>
                  </div>
                  <div className="card-soft p-4 text-center">
                    <p className="text-sm text-muted">Est. Bill</p>
                    <p className="text-xl font-bold">
                      Rs. {Number(booking.estimatedBill || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="card-soft p-4 text-center">
                    <p className="text-sm text-muted">Distance</p>
                    <p className="text-xl font-bold">
                      {Number(booking.distance || 0).toFixed(1)} km
                    </p>
                    {booking.etaMinutes && (
                      <p className="text-xs text-muted">
                        About {booking.etaMinutes} min
                      </p>
                    )}
                  </div>
                </div>

                {accepted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 border-t border-line pt-4"
                  >
                    <div className="card-soft p-5">
                      <h3 className="mb-4 flex items-center gap-2 font-bold">
                        <FiCheckCircle className="text-brand" />
                        Customer Details
                      </h3>
                      <div className="space-y-3 text-sm">
                        <p>
                          <span className="text-muted">Name:</span>{" "}
                          <span className="font-semibold">
                            {booking.customer.name || "Customer"}
                          </span>
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
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          booking.customer.phone &&
                          window.open(`tel:${booking.customer.phone}`, "_blank")
                        }
                        className="btn-ghost flex-col gap-2 py-4"
                      >
                        <FiPhone className="h-6 w-6" />
                        <span className="text-sm font-semibold">Call</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          booking.customer.phone &&
                          window.open(
                            `https://wa.me/${booking.customer.phone.replace(/\D/g, "")}`,
                            "_blank",
                          )
                        }
                        className="btn-ghost flex-col gap-2 py-4"
                      >
                        <FiMessageSquare className="h-6 w-6" />
                        <span className="text-sm font-semibold">WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={openGoogleMaps}
                        className="btn-primary flex-col gap-2 py-4"
                      >
                        <FiMapPin className="h-6 w-6" />
                        <span className="text-sm font-semibold">Navigate</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {isPending && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={Boolean(actionLoading)}
                      className="btn-primary py-4 text-lg"
                    >
                      {actionLoading === "accept"
                        ? "Accepting..."
                        : "Accept Booking"}
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={Boolean(actionLoading)}
                      className="btn-ghost py-4 text-lg text-red-600"
                    >
                      <FiXCircle />
                      {actionLoading === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      accepted
                        ? `/garage/bookings/${booking.id}`
                        : "/garage/bookings",
                    )
                  }
                  className="btn-dark w-full py-4 text-lg"
                >
                  Open Garage Dashboard
                </button>
              </div>
            ) : (
              <div className="card-soft p-6 text-muted">
                {error || "This request could not be found."}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
