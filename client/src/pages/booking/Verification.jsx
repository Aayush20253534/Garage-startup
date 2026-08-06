import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/api/axios";
import {
  FiCheckCircle,
  FiClock,
  FiHeadphones,
  FiPhoneCall,
  FiRefreshCw,
  FiShield,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";

const formatElapsed = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
};

const getStageCopy = (status) => {
  if (status === "CLAIMED") {
    return {
      title: "A verification specialist is reviewing your booking",
      detail: "Your lead has been claimed. Keep your registered phone nearby for a quick call.",
    };
  }
  if (status === "IN_CALL") {
    return {
      title: "Verification call in progress",
      detail: "Our team is speaking with you now. Garage search will begin as soon as the booking is approved.",
    };
  }
  return {
    title: "We’re verifying your first booking",
    detail: "A Rovauto verification specialist will call you shortly. This protects genuine customers and garages from fake bookings.",
  };
};

export default function BookingVerification() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const response = await api.get(`/bookings/${bookingId}/verification`);
      setData(response.data?.data || null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load booking verification.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load({ silent: true }), 3000);
    return () => window.clearInterval(poll);
  }, [bookingId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!data?.trackingReady) return undefined;
    const timer = window.setTimeout(() => {
      navigate("/tracking", {
        replace: true,
        state: {
          bookingId: data.lead.bookingId,
          bookingCode: data.lead.booking?.bookingCode,
        },
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [data?.trackingReady, data?.lead?.bookingId, navigate]);

  const lead = data?.lead;
  const booking = lead?.booking;
  const elapsedSeconds = useMemo(() => {
    if (!lead?.createdAt) return 0;
    const end = lead.approvedAt || lead.rejectedAt || now;
    return Math.max(
      0,
      Math.floor((new Date(end).getTime() - new Date(lead.createdAt).getTime()) / 1000),
    );
  }, [lead?.createdAt, lead?.approvedAt, lead?.rejectedAt, now]);
  const stageCopy = getStageCopy(lead?.status);

  if (loading && !data) {
    return (
      <div className="container-x grid min-h-[70vh] place-items-center py-10">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4 text-sm font-semibold text-muted shadow-soft">
          <FiRefreshCw className="animate-spin" /> Loading verification status...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container-x grid min-h-[70vh] place-items-center py-10">
        <div className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-6 text-center shadow-soft">
          <FiXCircle className="mx-auto text-4xl text-red-600" />
          <h1 className="mt-4 text-xl font-extrabold text-ink">Could not load verification</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white">
            <FiRefreshCw /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (data?.approved) {
    return (
      <div className="container-x grid min-h-[75vh] place-items-center py-8">
        <div className="w-full max-w-xl rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-soft sm:p-9">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl text-emerald-700">
            <FiCheckCircle />
          </span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Verification complete</p>
          <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">We’re starting your garage search</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Your first booking has been approved. You will be taken to live garage search automatically.</p>
          <div className="mx-auto mt-6 h-2 max-w-sm overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
          </div>
        </div>
      </div>
    );
  }

  if (data?.rejected) {
    return (
      <div className="container-x grid min-h-[75vh] place-items-center py-8">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-6 text-center shadow-soft sm:p-9">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-50 text-4xl text-red-600">
            <FiXCircle />
          </span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-red-600">Verification not approved</p>
          <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">We could not activate this booking</h1>
          <p className="mt-3 text-sm leading-6 text-muted">The booking was not approved during verification. Contact Rovauto support if you believe this decision needs review.</p>
          <Link to="/dashboard/support" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white">
            <FiHeadphones /> Contact support
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-amber-50 via-white to-white py-5 sm:py-10">
      <div className="container-x mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-soft">
          <div className="relative overflow-hidden bg-ink px-5 py-8 text-white sm:px-9 sm:py-10">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/20 blur-2xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">First booking protection</p>
                <h1 className="mt-2 max-w-2xl text-2xl font-black leading-tight sm:text-4xl">{stageCopy.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">{stageCopy.detail}</p>
              </div>
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl border border-white/15 bg-white/10 text-4xl backdrop-blur">
                <FiShield />
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [FiCheckCircle, "Booking confirmed", true],
                  [FiPhoneCall, "Quick verification call", lead?.status !== "PENDING"],
                  [FiTruck, "Garage search", false],
                ].map(([Icon, label, active], index) => (
                  <div key={label} className={`rounded-2xl border p-4 ${active ? "border-emerald-200 bg-emerald-50" : index === 1 ? "border-amber-300 bg-amber-50" : "border-line bg-bg-soft"}`}>
                    <Icon className={`text-xl ${active ? "text-emerald-700" : index === 1 ? "text-amber-700" : "text-muted"}`} />
                    <p className="mt-3 text-sm font-extrabold text-ink">{label}</p>
                    <p className="mt-1 text-xs text-muted">{active ? "Complete" : index === 1 ? "In progress" : "Starts after approval"}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-line bg-bg-soft/60 p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-lg text-ink shadow-sm"><FiPhoneCall /></span>
                  <div>
                    <h2 className="font-extrabold text-ink">Please keep your phone nearby</h2>
                    <p className="mt-1 text-sm leading-6 text-muted">Our team will call the registered number only to confirm that the booking is genuine. Never share an OTP, password, card PIN, or banking credentials.</p>
                  </div>
                </div>
              </div>

              {error && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Status refresh failed: {error}</p>}
            </section>

            <aside className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Waiting time</p>
                  <p className="mt-1 font-mono text-3xl font-black text-ink">{formatElapsed(elapsedSeconds)}</p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl text-black"><FiClock /></span>
              </div>

              <div className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted">Booking</span><span className="font-bold text-ink">{booking?.bookingCode || bookingId}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Vehicle</span><span className="text-right font-bold text-ink">{[booking?.vehicle?.brand, booking?.vehicle?.model].filter(Boolean).join(" ") || "Saved vehicle"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Maximum estimate</span><span className="font-bold text-ink">₹{Number(booking?.totalServiceMaxAmount || 0).toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Platform fee</span><span className="font-black text-emerald-700">Waived</span></div>
              </div>

              <button type="button" onClick={() => void load()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-bold text-ink transition hover:bg-bg-soft">
                <FiRefreshCw /> Refresh status
              </button>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
