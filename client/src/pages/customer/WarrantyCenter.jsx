import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiRefreshCw,
  FiShield,
  FiTool,
  FiTruck,
} from "react-icons/fi";

import warrantyApi from "@/api/warranty";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WARRANTY_DAYS = 30;

const formatDate = (value) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const getVehicleName = (vehicle) => {
  if (!vehicle) return "Saved vehicle";

  const name = `${vehicle.brand || ""} ${vehicle.model || ""}`.trim();
  return name || vehicle.registrationNumber || "Saved vehicle";
};

const getLiveWarrantyState = (warranty, now) => {
  const expiresAt = new Date(warranty.expiresAt);
  const remainingMs = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / DAY_IN_MS));

  return {
    isActive: remainingMs > 0,
    daysRemaining,
    progress: Math.max(
      0,
      Math.min(100, Math.round((daysRemaining / WARRANTY_DAYS) * 100)),
    ),
  };
};

function WarrantyCard({ warranty, now }) {
  const { isActive, daysRemaining, progress } = getLiveWarrantyState(
    warranty,
    now,
  );
  const serviceNames = warranty.services
    ?.map((service) => service.name)
    .filter(Boolean);

  return (
    <article className="relative min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-ink to-ink-2 p-4 text-white shadow-lg sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-white/5 blur-3xl" />

      <header className="relative flex min-w-0 flex-col gap-3 min-[440px]:flex-row min-[440px]:items-start min-[440px]:justify-between">
        <span
          className={[
            "inline-flex w-fit items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold",
            isActive
              ? "border-brand/50 bg-brand text-black"
              : "border-white/15 bg-white/10 text-white/80",
          ].join(" ")}
        >
          {isActive ? <FiCheckCircle /> : <FiAlertTriangle />}
          {isActive ? "Active" : "Expired"}
        </span>

        <div className="min-w-0 max-w-full text-left min-[440px]:max-w-[58%] min-[440px]:text-right">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
            Warranty ID
          </div>
          <div className="mt-1 min-w-0 break-all text-xs font-semibold leading-5 text-white/75">
            {warranty.warrantyId}
          </div>
        </div>
      </header>

      <section className="relative mt-6 min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/50">
          <FiTool className="shrink-0" />
          Services selected
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
          {serviceNames?.length ? (
            serviceNames.map((serviceName, index) => (
              <span
                key={`${serviceName}-${index}`}
                className="max-w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold leading-5 text-white [overflow-wrap:anywhere]"
              >
                {serviceName}
              </span>
            ))
          ) : (
            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
              Vehicle Service
            </span>
          )}
        </div>
      </section>

      <section className="relative mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.07] p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/45">
            <FiTruck className="shrink-0" />
            Vehicle
          </div>
          <div className="mt-2 min-w-0 break-words text-sm font-semibold leading-5 text-white [overflow-wrap:anywhere]">
            {getVehicleName(warranty.vehicle)}
          </div>
          {warranty.vehicle?.registrationNumber && (
            <div className="mt-1 min-w-0 break-all text-xs leading-5 text-white/55">
              {warranty.vehicle.registrationNumber}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.07] p-3.5">
          <div className="text-xs font-bold uppercase tracking-wide text-white/45">
            Garage
          </div>
          <div className="mt-2 min-w-0 break-words text-sm font-semibold leading-5 text-white [overflow-wrap:anywhere]">
            {warranty.garage?.name || "Assigned garage"}
          </div>
        </div>
      </section>

      <section className="relative mt-4 grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="text-xs text-white/50">Activated</div>
          <div className="mt-1 min-w-0 break-words text-sm font-semibold text-white">
            {formatDate(warranty.activatedAt)}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="text-xs text-white/50">Valid till</div>
          <div className="mt-1 min-w-0 break-words text-sm font-semibold text-white">
            {formatDate(warranty.expiresAt)}
          </div>
        </div>
      </section>

      <section className="relative mt-4 min-w-0 rounded-2xl border border-white/15 bg-white/10 p-4">
        <div className="flex min-w-0 flex-col gap-2 min-[390px]:flex-row min-[390px]:items-end min-[390px]:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
              Warranty time
            </div>
            <div className="mt-1 min-w-0 break-words text-xl font-bold leading-7 sm:text-2xl">
              {isActive
                ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
                : "Warranty expired"}
            </div>
          </div>
          <div className="shrink-0 text-xs font-semibold text-white/60">
            {isActive ? `${progress}% remaining` : "0% remaining"}
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 min-w-0 break-words text-xs leading-5 text-white/60">
          {isActive
            ? "The remaining period updates automatically from the service completion date."
            : "This 30-day service warranty has ended."}
        </div>
      </section>

      <footer className="relative mt-5 grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <Link
          to="/dashboard/support"
          className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-bold text-black transition hover:bg-brand-dark"
          state={{
            warrantyBookingId: warranty.bookingId,
            warrantyId: warranty.warrantyId,
          }}
        >
          <FiCheckCircle className="shrink-0" />
          <span className="truncate">Claim warranty</span>
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-white bg-white px-4 py-2.5 text-center text-sm font-bold text-black transition hover:bg-gray-100"
        >
          <FiDownload className="shrink-0" />
          <span className="truncate">Save card</span>
        </button>
      </footer>
    </article>
  );
}

export default function WarrantyCenter() {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  const loadWarranties = async ({ refresh = false } = {}) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError("");
      const result = await warrantyApi.listMyWarranties();
      setWarranties(Array.isArray(result) ? result : []);
      setNow(new Date());
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load your warranty cards.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadWarranties();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    return warranties.reduce(
      (result, warranty) => {
        const state = getLiveWarrantyState(warranty, now);
        result.total += 1;
        if (state.isActive) result.active += 1;
        else result.expired += 1;
        return result;
      },
      { total: 0, active: 0, expired: 0 },
    );
  }, [now, warranties]);

  return (
    <div className="mx-auto min-w-0 max-w-6xl overflow-x-hidden">
      <div className="mb-2 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand sm:h-12 sm:w-12 sm:rounded-2xl">
            <FiShield className="text-xl" />
          </span>

          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold leading-tight text-ink sm:text-4xl">
              Warranty Center
            </h1>
            <p className="mt-1 break-words text-sm leading-6 text-muted">
              Completed Rovauto services include a 30-day warranty card.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadWarranties({ refresh: true })}
          disabled={refreshing}
          className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-bg-soft disabled:opacity-60 min-[390px]:w-auto"
        >
          <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mt-6 grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        {[
          ["Total cards", summary.total],
          ["Active", summary.active],
          ["Expired", summary.expired],
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-sm"
          >
            <div className="min-w-0 break-words text-xs font-bold uppercase tracking-[0.12em] text-muted">
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 break-words text-xl font-bold text-ink sm:text-2xl">
        Service warranty cards
      </h2>

      {error && (
        <div className="mt-5 flex min-w-0 items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-5 min-w-0 rounded-xl border border-line bg-white p-6 text-sm text-muted shadow-sm">
          Loading warranty cards...
        </div>
      ) : warranties.length === 0 ? (
        <div className="mt-5 min-w-0 rounded-2xl border border-dashed border-line bg-white p-6 text-center shadow-sm sm:p-8">
          <FiShield className="mx-auto text-4xl text-muted" />
          <h3 className="mt-3 break-words text-lg font-bold text-ink">
            No warranty cards yet
          </h3>
          <p className="mx-auto mt-2 max-w-lg break-words text-sm leading-6 text-muted">
            A warranty card will appear here automatically after a service booking is completed.
          </p>
          <Link
            to="/booking/vehicle"
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black min-[390px]:w-auto"
          >
            Book a service
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-2">
          {warranties.map((warranty) => (
            <WarrantyCard key={warranty.id} warranty={warranty} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
