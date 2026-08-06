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
      eyebrow: "Verification agent assigned",
      title: "Your booking is being reviewed",
      detail:
        "A Rovauto specialist has accepted your request and will call your registered number shortly.",
    };
  }

  if (status === "IN_CALL") {
    return {
      eyebrow: "Call in progress",
      title: "We’re completing your verification",
      detail:
        "Once the short verification call is approved, garage matching will begin automatically.",
    };
  }

  return {
    eyebrow: "First booking verification",
    title: "We’re verifying your first booking",
    detail:
      "A Rovauto specialist will call you shortly. This quick check protects genuine customers and garages from fake bookings.",
  };
};

const getProgressSteps = (status) => {
  const verificationLabel =
    status === "IN_CALL"
      ? "Call in progress"
      : status === "CLAIMED"
        ? "Agent assigned"
        : "Verification call";

  const verificationDetail =
    status === "IN_CALL"
      ? "Being completed"
      : status === "CLAIMED"
        ? "Call coming shortly"
        : "Waiting for an agent";

  return [
    {
      icon: FiCheckCircle,
      label: "Booking received",
      detail: "Complete",
      state: "complete",
    },
    {
      icon: FiPhoneCall,
      label: verificationLabel,
      detail: verificationDetail,
      state: "active",
    },
    {
      icon: FiTruck,
      label: "Garage matching",
      detail: "Starts after approval",
      state: "upcoming",
    },
  ];
};

const detailRows = (booking, bookingId) => [
  ["Booking", booking?.bookingCode || bookingId],
  [
    "Vehicle",
    [booking?.vehicle?.brand, booking?.vehicle?.model]
      .filter(Boolean)
      .join(" ") || "Saved vehicle",
  ],
  [
    "Maximum estimate",
    `₹${Number(booking?.totalServiceMaxAmount || 0).toLocaleString("en-IN")}`,
  ],
];

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
      Math.floor(
        (new Date(end).getTime() - new Date(lead.createdAt).getTime()) / 1000,
      ),
    );
  }, [lead?.createdAt, lead?.approvedAt, lead?.rejectedAt, now]);
  const stageCopy = getStageCopy(lead?.status);
  const progressSteps = getProgressSteps(lead?.status);
  const currentStatusLabel =
    lead?.status === "IN_CALL"
      ? "Call in progress"
      : lead?.status === "CLAIMED"
        ? "Agent assigned"
        : "Waiting for support";

  if (loading && !data) {
    return (
      <div className="container-x grid min-h-[70vh] place-items-center py-10">
        <div className="flex items-center gap-3 border border-line bg-white px-5 py-4 text-sm font-semibold text-muted shadow-soft sm:rounded-xl">
          <FiRefreshCw className="animate-spin" /> Loading verification status...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container-x grid min-h-[70vh] place-items-center py-10">
        <div className="w-full max-w-lg border border-red-200 bg-white p-6 text-center shadow-soft sm:rounded-2xl">
          <FiXCircle className="mx-auto text-4xl text-red-600" />
          <h1 className="mt-4 text-xl font-extrabold text-ink">
            Could not load verification
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white"
          >
            <FiRefreshCw /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (data?.approved) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-bg-soft">
        <div className="container-x grid min-h-[75vh] place-items-center py-8 sm:py-12">
          <div className="w-full max-w-xl border border-emerald-200 bg-white p-6 text-center shadow-soft sm:rounded-2xl sm:p-9">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-emerald-50 text-3xl text-emerald-700">
              <FiCheckCircle />
            </span>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Verification complete
            </p>
            <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">
              We’re starting your garage search
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              Your first booking has been approved. You will be taken to live
              garage search automatically.
            </p>
            <div className="mx-auto mt-6 h-1.5 max-w-sm overflow-hidden bg-emerald-100">
              <div className="h-full w-2/3 animate-pulse bg-emerald-600" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data?.rejected) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-bg-soft">
        <div className="container-x grid min-h-[75vh] place-items-center py-8 sm:py-12">
          <div className="w-full max-w-xl border border-red-200 bg-white p-6 text-center shadow-soft sm:rounded-2xl sm:p-9">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-red-50 text-3xl text-red-600">
              <FiXCircle />
            </span>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-600">
              Verification not approved
            </p>
            <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">
              We could not activate this booking
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              The booking was not approved during verification. Contact Rovauto
              support if you believe this decision needs review.
            </p>
            <Link
              to="/dashboard/support"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white"
            >
              <FiHeadphones /> Contact support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f5f6f7] py-4 sm:py-8 lg:py-12">
      <div className="container-x mx-auto max-w-6xl">
        <div className="overflow-hidden border border-black/10 bg-white shadow-[0_18px_55px_rgba(17,17,17,0.08)] sm:rounded-2xl">
          <header
            className="relative overflow-hidden bg-ink px-5 py-6 text-white sm:px-8 sm:py-8 lg:px-10"
            style={{
              background:
                "radial-gradient(circle at 90% 0%, rgba(185, 240, 0, 0.2), transparent 34%), linear-gradient(135deg, #111111 0%, #202020 100%)",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand sm:text-xs">
                  <FiShield className="shrink-0 text-base" />
                  <span>{stageCopy.eyebrow}</span>
                </div>
                <h1 className="mt-3 max-w-3xl text-2xl font-black leading-[1.15] sm:text-3xl lg:text-[2.15rem]">
                  {stageCopy.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
                  {stageCopy.detail}
                </p>

                <div className="mt-6 grid max-w-xl grid-cols-2 border-t border-white/15 pt-5">
                  <div className="border-r border-white/15 pr-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50 sm:text-xs">
                      Waiting time
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <FiClock className="text-brand" />
                      <span className="font-mono text-2xl font-black tabular-nums sm:text-3xl">
                        {formatElapsed(elapsedSeconds)}
                      </span>
                    </div>
                  </div>
                  <div className="pl-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50 sm:text-xs">
                      Current status
                    </p>
                    <p className="mt-2 text-sm font-bold text-white sm:text-base">
                      {currentStatusLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="hidden h-20 w-20 place-items-center border border-white/15 bg-white/[0.07] text-3xl text-brand lg:grid">
                <FiShield />
              </div>
            </div>
          </header>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
            <main className="p-5 sm:p-8 lg:p-10 lg:pr-8">
              <section aria-labelledby="verification-progress-heading">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">
                    Booking progress
                  </p>
                  <h2
                    id="verification-progress-heading"
                    className="mt-1 text-lg font-extrabold text-ink sm:text-xl"
                  >
                    What happens next
                  </h2>
                </div>

                <ol className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-4">
                  <div
                    aria-hidden="true"
                    className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-line"
                  />
                  {progressSteps.map((step) => {
                    const Icon = step.icon;
                    const markerClass =
                      step.state === "complete"
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : step.state === "active"
                          ? "border-ink bg-brand text-ink shadow-[0_0_0_4px_rgba(185,240,0,0.18)]"
                          : "border-line bg-white text-muted";

                    return (
                      <li
                        key={step.label}
                        className="relative z-10 min-w-0 text-center"
                      >
                        <span
                          className={`mx-auto grid h-8 w-8 place-items-center rounded-lg border text-sm ${markerClass}`}
                        >
                          <Icon />
                        </span>
                        <p className="mt-3 text-xs font-extrabold leading-4 text-ink sm:text-sm">
                          {step.label}
                        </p>
                        <p className="mt-1 text-[10px] leading-4 text-muted sm:text-xs">
                          {step.detail}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="mt-8 border-l-4 border-brand bg-[#fafcf4] px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center border border-line bg-white text-lg text-ink shadow-sm">
                    <FiPhoneCall />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold text-ink sm:text-lg">
                      Please keep your phone nearby
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-muted">
                      We will call only your registered number to confirm that
                      the booking is genuine. Rovauto will never ask for an OTP,
                      password, card PIN, or banking credentials.
                    </p>
                  </div>
                </div>
              </section>

              <div className="mt-6 flex items-start gap-3 border-t border-line pt-5 text-xs leading-5 text-muted sm:text-sm">
                <FiShield className="mt-0.5 shrink-0 text-base text-ink" />
                <p>
                  Your booking remains protected while verification is pending.
                  Garage matching starts only after a support specialist approves
                  the request.
                </p>
              </div>

              {error && (
                <p className="mt-5 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Status refresh failed: {error}
                </p>
              )}
            </main>

            <aside className="border-t border-line bg-[#fafafa] p-5 sm:p-8 lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">
                    Booking summary
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold text-ink">
                    Verification details
                  </h2>
                </div>
                <span className="shrink-0 border-l-4 border-amber-500 bg-amber-50 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-amber-800">
                  {currentStatusLabel}
                </span>
              </div>

              <dl className="mt-6 divide-y divide-line border-y border-line">
                {detailRows(booking, bookingId).map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-4 text-sm"
                  >
                    <dt className="text-muted">{label}</dt>
                    <dd className="break-words text-right font-bold text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
                <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-4 text-sm">
                  <dt className="text-muted">Platform fee</dt>
                  <dd className="text-right font-black text-emerald-700">
                    Waived for first booking
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => void load()}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-ink bg-white text-sm font-bold text-ink transition hover:bg-ink hover:text-white"
              >
                <FiRefreshCw /> Refresh status
              </button>
              <p className="mt-3 text-center text-[11px] leading-4 text-muted">
                This page also refreshes automatically every few seconds.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
