import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { STATUS_STEPS } from "@/data/garages";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import { isPaymentAuthError, payForBooking } from "@/utils/bookingPayment";
import {
  FiPhone,
  FiNavigation,
  FiMessageCircle,
  FiCheck,
  FiStar,
  FiDownload,
  FiShield,
} from "react-icons/fi";

const getServicesTotal = (booking) => {
  return (
    booking?.services?.reduce((sum, item) => {
      return sum + (item.finalPrice || item.estimatedPrice || 0);
    }, 0) ||
    booking?.totalServiceAmount ||
    0
  );
};

export default function Tracking() {
  const location = useLocation();
  const nav = useNavigate();
  const { user, clearBookingCaches } = useApp();
  const bookingId = location.state?.bookingId;

  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(Boolean(bookingId));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookingId) return;

    const loadBooking = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get(`/bookings/${bookingId}`);
        setBooking(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load booking");
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [bookingId]);

  useEffect(() => {
    if (booking?.status === "PENDING_PAYMENT") return;
    if (step >= STATUS_STEPS.length - 1) return;

    const timer = setTimeout(() => setStep(step + 1), 5000);
    return () => clearTimeout(timer);
  }, [booking?.status, step]);

  const payBooking = async () => {
    try {
      setPaying(true);
      setError("");

      const verifiedBooking = await payForBooking({ booking, user });

      clearBookingCaches?.();
      setBooking(verifiedBooking);
      nav("/tracking", {
        replace: true,
        state: {
          bookingId: verifiedBooking.id,
          bookingCode: verifiedBooking.bookingCode,
        },
      });
    } catch (err) {
      if (isPaymentAuthError(err)) {
        nav("/login", {
          state: {
            from: location,
            message: "Please login to continue payment.",
          },
        });
        return;
      }

      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not complete payment. Please try again.",
      );
    } finally {
      setPaying(false);
    }
  };

  if (!bookingId) {
    return (
      <div className="container-x max-w-3xl py-12">
        <div className="card-soft p-8 text-center">
          <h1 className="text-2xl font-bold">Select a booking to track</h1>
          <p className="mt-2 text-muted">
            Tracking opens after a paid booking is selected from active
            bookings.
          </p>
          <Link to="/dashboard/bookings" className="btn-primary mt-5">
            View Active Bookings
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-x max-w-3xl py-12">
        <div className="card-soft p-8 text-muted">Loading booking...</div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="container-x max-w-3xl py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  if (booking?.status === "PENDING_PAYMENT") {
    return (
      <div className="container-x max-w-3xl py-12">
        <div className="card-soft p-8">
          <span className="chip-brand">Booking #{booking.bookingCode}</span>
          <h1 className="mt-3 text-3xl font-bold">Payment required</h1>
          <p className="mt-2 text-muted">
            Complete the booking payment to start garage matching and enable
            tracking.
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={payBooking}
              disabled={paying}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {paying ? "Processing..." : `Pay ₹${booking.payableAmount}`}
            </button>
            <Link to="/dashboard/bookings" className="btn-ghost">
              Back to Active Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const current = STATUS_STEPS[step];
  const servicesTotal = getServicesTotal(booking);
  const platformFee = booking?.handlingFee || booking?.payment?.amount || 0;
  const bookingCode =
    booking?.bookingCode || location.state?.bookingCode || "RV2384";

  return (
    <div className="container-x grid max-w-6xl gap-8 py-12 lg:grid-cols-[1fr_380px]">
      <div>
        <span className="chip-brand">Booking #{bookingCode}</span>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{current.label}</h1>
        <p className="mt-2 text-muted">{current.desc}</p>

        <div className="card-soft mt-8 p-6">
          <div className="grid gap-5">
            {STATUS_STEPS.map((statusStep, index) => (
              <div key={statusStep.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={index <= step ? { scale: [0.8, 1.1, 1] } : {}}
                    className={`grid h-9 w-9 place-items-center rounded-full ${
                      index <= step
                        ? "bg-brand text-ink"
                        : "bg-bg-soft text-muted"
                    }`}
                  >
                    {index < step ? (
                      <FiCheck />
                    ) : index === step ? (
                      <span className="h-2 w-2 animate-ping rounded-full bg-ink" />
                    ) : (
                      index + 1
                    )}
                  </motion.div>
                  {index < STATUS_STEPS.length - 1 && (
                    <div
                      className={`my-1 w-px flex-1 ${
                        index < step ? "bg-brand" : "bg-line"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-6">
                  <div
                    className={`font-semibold ${
                      index <= step ? "text-ink" : "text-muted"
                    }`}
                  >
                    {statusStep.label}
                  </div>
                  <div className="text-sm text-muted">{statusStep.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {step >= 2 && step < 4 && (
          <div className="card-soft mt-6 p-6">
            <h3 className="mb-3 font-semibold">Service Checklist</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                "Vehicle inspection",
                "Engine oil change",
                "Oil filter",
                "Wheel balancing",
                "30-point check",
                "Test drive",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-2">
                  <FiCheck
                    className={index < 4 ? "text-brand-dark" : "text-muted"}
                  />
                  <span className={index < 4 ? "" : "text-muted"}>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-soft">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "68%" }}
                transition={{ duration: 1.5 }}
                className="h-full bg-brand"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card-soft mt-6 p-6">
            <h3 className="mb-3 font-semibold">Invoice</h3>
            <div className="grid gap-2 text-sm">
              <Row l="Service estimate" r={`₹${servicesTotal}`} />
              <Row l="Platform fee" r={`₹${platformFee}`} />
              <Row l="Total" r={`₹${servicesTotal + platformFee}`} bold />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-dark">
                <FiDownload /> Download Receipt
              </button>
              <button className="btn-primary">
                <FiStar /> Rate Garage
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mt-6 rounded-3xl bg-gradient-to-br from-ink to-ink-2 p-6 text-white">
            <span className="chip-brand">Active</span>
            <h3 className="mt-3 flex items-center gap-2 text-2xl font-bold">
              <FiShield /> 30-Day Warranty Card
            </h3>
            <p className="mt-2 text-sm text-white/70">
              Valid after service completion. Any issue? Tap Claim from your
              dashboard.
            </p>
          </div>
        )}
      </div>

      <aside className="card-soft h-fit p-6 lg:sticky lg:top-24">
        {step === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto grid h-16 w-16 animate-pulse place-items-center rounded-full bg-brand">
              <FiNavigation className="text-2xl" />
            </div>
            <h3 className="mt-4 font-semibold">Finding the best mechanic...</h3>
            <p className="mt-2 text-xs text-muted">
              WhatsApp magic links sent to nearby verified garages.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-lg font-bold text-white">
                RK
              </span>
              <div>
                <div className="font-semibold">
                  {booking?.garage?.ownerName || "Garage Partner"}
                </div>
                <div className="text-xs text-muted">
                  {booking?.garage?.name || "Garage matching in progress"}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                  <FiStar fill="currentColor" />{" "}
                  {booking?.garage?.rating || "4.9"}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <Row l="Phone" r={booking?.garage?.phone || "+91 98xxx xx012"} />
              <Row l="ETA" r="25 min" />
              <Row
                l="OTP"
                r={
                  <span className="font-mono font-bold tracking-wider">
                    3-8-9-4
                  </span>
                }
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button className="btn-primary !px-2">
                <FiPhone />
              </button>
              <button className="btn-dark !px-2">
                <FiNavigation />
              </button>
              <button className="btn-ghost !px-2">
                <FiMessageCircle />
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ l, r, bold }) {
  return (
    <div
      className={`flex justify-between ${
        bold ? "border-t border-line pt-2 text-base font-bold" : ""
      }`}
    >
      <span className="text-muted">{l}</span>
      <span>{r}</span>
    </div>
  );
}
