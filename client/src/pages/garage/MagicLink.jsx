import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiMapPin,
  FiMessageSquare,
  FiNavigation,
  FiPhone,
  FiShield,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";
import { formatRupees } from "@/utils/priceRange";
import { isSelfDropOffService } from "@/utils/serviceFulfillment";

const isUnlockedStatus = (status) =>
  ["ACCEPTED", "CONFIRMED", "IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(
    status,
  );

const getWhatsappUrl = (phone) => {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length > 10) digits = digits.replace(/^0+/, "");

  return digits ? `https://wa.me/${digits}` : null;
};

function RequestTable({ rows }) {
  return (
    <dl className="overflow-hidden rounded-xl border border-line bg-white divide-y divide-line">
      {rows.map(({ label, value, strong = false }) => (
        <div
          key={label}
          className="grid min-w-0 gap-1.5 px-4 py-3.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4"
        >
          <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
            {label}
          </dt>
          <dd
            className={[
              "min-w-0 break-words text-left text-sm leading-5 text-ink",
              strong ? "font-extrabold" : "font-semibold",
            ].join(" ")}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ accepted }) {
  return (
    <span
      className={[
        "inline-flex min-h-8 max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-[11px] font-extrabold uppercase leading-tight tracking-[0.08em]",
        accepted
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-brand/40 bg-brand/15 text-ink",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          accepted ? "bg-emerald-500" : "bg-brand-dark",
        ].join(" ")}
      />
      {accepted ? "Booking accepted" : "New booking request"}
    </span>
  );
}

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
  const isSelfDropOff = booking ? isSelfDropOffService(booking) : false;
  const isPending = booking?.status === "NEW" || booking?.status === "SENT";
  const acceptFee = Number(booking?.acceptFee || 0);
  const walletBalance = Number(
    garage?.walletBalance ?? garage?.wallet?.balance ?? NaN,
  );
  const hasWalletBalance = Number.isFinite(walletBalance);
  const needsRecharge =
    isPending && acceptFee > 0 && hasWalletBalance && walletBalance < acceptFee;
  const walletShortfall =
    needsRecharge && hasWalletBalance
      ? Math.max(acceptFee - walletBalance, 0)
      : 0;

  const serviceNames = useMemo(
    () =>
      (Array.isArray(booking?.services) ? booking.services : [])
        .map((service) => service?.name)
        .filter(Boolean)
        .join(", ") || "Service request",
    [booking?.services],
  );

  const handleAccept = async () => {
    if (!booking) return;

    if (needsRecharge) {
      navigate("/garage/wallet", { state: returnState });
      return;
    }

    setActionLoading("accept");
    setError("");
    try {
      const updated = await garageApi.acceptRequest(
        booking.requestId || booking.id,
      );
      setBooking(updated);
      navigate(`/garage/bookings/${updated.requestId || updated.id}`);
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
      window.open(booking.customerLocationLink, "_blank", "noopener,noreferrer");
      return;
    }

    const { lat, lng } = booking?.customer?.location || {};
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps?q=${lat},${lng}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-5 sm:py-10">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="animate-pulse space-y-5 p-5 sm:p-7">
            <div className="h-6 w-40 rounded-full bg-slate-100" />
            <div className="h-20 rounded-xl bg-slate-100" />
            <div className="h-44 rounded-xl bg-slate-100" />
          </div>
        </div>
      </main>
    );
  }

  if (!garage || !garageToken) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-5 sm:py-10">
        <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="border-b border-line bg-slate-50/80 px-5 py-5 sm:px-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-ink">
              <FiTruck className="h-4 w-4" />
              Garage request
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Sign in to review this booking
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Use the approved garage-owner account that received the WhatsApp
              notification. You will return directly to this request after login.
            </p>
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            <RequestTable
              rows={[
                { label: "Request ID", value: id || "Booking request", strong: true },
                { label: "Access", value: "Approved garage owner" },
                { label: "After login", value: "Return to this booking request" },
              ]}
            />

            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <FiShield className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Customer contact and exact location remain hidden until the garage
                accepts the booking.
              </p>
            </div>

            <Link
              to="/garage/login"
              state={returnState}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-black shadow-sm shadow-brand/20 transition hover:bg-brand-dark"
            >
              Continue to garage login
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const vehicleTitle = [booking?.vehicle?.brand, booking?.vehicle?.model]
    .filter(Boolean)
    .join(" ") || "Vehicle details";
  const vehicleMeta = [booking?.vehicle?.year, booking?.vehicle?.number]
    .filter(Boolean)
    .join(" • ") || "Details not provided";
  const requestId = booking?.bookingId || booking?.requestId || id;

  return (
    <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden bg-slate-50 px-3 py-4 sm:px-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-line bg-white shadow-soft"
      >
        <header className="border-b border-line bg-slate-50/80 px-4 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <StatusBadge accepted={accepted} />
              <h1 className="mt-3 break-words text-xl font-extrabold leading-tight tracking-tight text-ink sm:text-2xl">
                Request {requestId}
              </h1>
              {garage?.name && (
                <p className="mt-1 text-sm font-medium text-muted">
                  Assigned to {garage.name}
                </p>
              )}
            </div>

            <div className="flex w-full min-w-0 items-start gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-semibold leading-5 text-muted shadow-sm sm:w-auto sm:max-w-xs">
              <FiClock className="h-4 w-4 text-brand-dark" />
              Respond promptly to keep the request active
            </div>
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-7">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {booking ? (
            <>
              <section className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/20 text-ink">
                    <FiTruck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                      Vehicle
                    </p>
                    <h2 className="break-words text-lg font-extrabold leading-tight text-ink sm:text-xl">
                      {vehicleTitle}
                    </h2>
                    <p className="mt-0.5 text-sm font-medium text-muted">
                      {vehicleMeta}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <h2 className="text-sm font-extrabold text-ink">Request summary</h2>
                  <span className="text-xs font-semibold text-muted">
                    Before acceptance
                  </span>
                </div>
                <RequestTable
                  rows={[
                    { label: "Services", value: serviceNames, strong: true },
                    {
                      label: "Vehicle movement",
                      value: isSelfDropOff
                        ? "Customer self drop-off & pickup"
                        : "Garage pickup & delivery",
                      strong: true,
                    },
                    {
                      label: "Estimated bill",
                      value: formatRupees(booking.estimatedBill || 0),
                      strong: true,
                    },
                    {
                      label: "Distance",
                      value: `${Number(booking.distance || 0).toFixed(1)} km`,
                      strong: true,
                    },
                    ...(booking.etaMinutes
                      ? [
                          {
                            label: "Estimated travel",
                            value: `About ${booking.etaMinutes} min`,
                          },
                        ]
                      : []),
                  ]}
                />
                {isSelfDropOff && (
                  <div className="mt-3 flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
                    <FiMapPin className="mt-1 shrink-0" />
                    <p>
                      <span className="font-extrabold">Self drop-off request:</span> do not travel to the customer. After acceptance, the customer will bring the vehicle to your garage and return to collect it.
                    </p>
                  </div>
                )}
              </section>

              {accepted && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <FiCheckCircle className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-extrabold text-ink">
                      Customer details
                    </h2>
                  </div>

                  <RequestTable
                    rows={[
                      {
                        label: "Customer",
                        value: booking.customer?.name || "Customer",
                        strong: true,
                      },
                      {
                        label: "Phone",
                        value: booking.customer?.phone || "Not available",
                      },
                      ...(isSelfDropOff
                        ? [
                            {
                              label: "Arrival",
                              value: "Customer will bring the vehicle to your garage",
                            },
                          ]
                        : [
                            {
                              label: "Address",
                              value: booking.customer?.address || "Not available",
                            },
                          ]),
                    ]}
                  />

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      disabled={!booking.customer?.phone}
                      onClick={() =>
                        booking.customer?.phone &&
                        window.open(`tel:${booking.customer.phone}`, "_blank")
                      }
                      className="inline-flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-2 py-3 text-xs font-bold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                    >
                      <FiPhone className="h-5 w-5" />
                      Call
                    </button>
                    <button
                      type="button"
                      disabled={!getWhatsappUrl(booking.customer?.phone)}
                      onClick={() => {
                        const whatsappUrl = getWhatsappUrl(booking.customer?.phone);
                        if (whatsappUrl) {
                          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className="inline-flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-2 py-3 text-xs font-bold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                    >
                      <FiMessageSquare className="h-5 w-5" />
                      WhatsApp
                    </button>
                    {!isSelfDropOff && (
                      <button
                        type="button"
                        onClick={openGoogleMaps}
                        className="col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-3 text-sm font-extrabold text-black transition hover:bg-brand-dark"
                      >
                        <FiNavigation className="h-5 w-5" />
                        Navigate
                      </button>
                    )}
                  </div>
                </motion.section>
              )}

              {isPending && acceptFee > 0 && (
                <section
                  className={[
                    "overflow-hidden rounded-xl border",
                    needsRecharge
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-emerald-200 bg-emerald-50/60",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 border-b border-current/10 px-4 py-3">
                    <FiCreditCard className="h-4 w-4" />
                    <h2 className="text-sm font-extrabold text-ink">
                      Acceptance wallet check
                    </h2>
                  </div>
                  <dl className="divide-y divide-current/10 px-4">
                    <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <dt className="font-medium text-muted">Acceptance fee</dt>
                      <dd className="font-extrabold text-ink">
                        {formatRupees(acceptFee)}
                      </dd>
                    </div>
                    {hasWalletBalance && (
                      <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <dt className="font-medium text-muted">Wallet balance</dt>
                        <dd className="font-extrabold text-ink">
                          {formatRupees(walletBalance)}
                        </dd>
                      </div>
                    )}
                    {needsRecharge && (
                      <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <dt className="font-semibold text-amber-800">Required recharge</dt>
                        <dd className="font-extrabold text-amber-900">
                          {formatRupees(walletShortfall)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="border-t border-current/10 px-4 py-3 text-xs font-medium leading-5 text-muted">
                    {needsRecharge
                      ? "Recharge the shortfall, then return here to accept the booking."
                      : "The acceptance fee will be deducted only when you confirm."}
                  </p>
                </section>
              )}

              {isPending && (
                <section className="space-y-3 border-t border-line pt-5">
                  <h2 className="text-sm font-extrabold text-ink">Decision</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={Boolean(actionLoading)}
                      className={[
                        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-center text-sm font-extrabold leading-tight transition disabled:cursor-not-allowed disabled:opacity-60",
                        needsRecharge
                          ? "bg-ink text-white hover:bg-ink-soft"
                          : "bg-brand text-black hover:bg-brand-dark",
                      ].join(" ")}
                    >
                      {actionLoading === "accept"
                        ? "Working..."
                        : needsRecharge
                          ? "Recharge to accept"
                          : "Accept booking"}
                      <FiArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={Boolean(actionLoading)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-center text-sm font-extrabold leading-tight text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiXCircle className="h-4 w-4" />
                      {actionLoading === "reject" ? "Rejecting..." : "Reject request"}
                    </button>
                  </div>
                </section>
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-slate-50 px-4 py-2.5 text-center text-sm font-extrabold leading-tight text-ink transition hover:border-ink hover:bg-white"
              >
                {accepted ? "Open booking workspace" : "Open garage dashboard"}
                <FiArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-line bg-slate-50 p-5 text-sm font-medium text-muted">
              {error || "This request could not be found."}
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
