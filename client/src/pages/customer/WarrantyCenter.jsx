import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";

import warrantyApi from "@/api/warranty";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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
  };
};

function WarrantyCard({ warranty, now }) {
  const { isActive, daysRemaining } = getLiveWarrantyState(warranty, now);
  const serviceNames = warranty.services
    ?.map((service) => service.name)
    .filter(Boolean);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink to-ink-2 p-6 text-white">
      <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand/20 blur-3xl" />

      <div className="relative flex items-center justify-between gap-4">
        <span className="chip-brand">{isActive ? "Active" : "Expired"}</span>

        <span className="text-right text-xs text-white/60">
          Warranty ID • {warranty.warrantyId}
        </span>
      </div>

      <div className="relative mt-6">
        <div className="text-xs text-white/60">Services selected</div>
        <div className="mt-1 text-xl font-semibold">
          {serviceNames?.length ? serviceNames.join(", ") : "Vehicle Service"}
        </div>

        <div className="mt-4 grid gap-3 text-sm text-white/70 sm:grid-cols-2">
          <div>
            <div className="text-xs text-white/50">Vehicle</div>
            <div className="mt-1 font-semibold text-white">
              {getVehicleName(warranty.vehicle)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50">Garage</div>
            <div className="mt-1 font-semibold text-white">
              {warranty.garage?.name || "Assigned garage"}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-white/60">Activated</div>
          <div className="font-semibold">{formatDate(warranty.activatedAt)}</div>
        </div>

        <div>
          <div className="text-xs text-white/60">Valid till</div>
          <div className="font-semibold">{formatDate(warranty.expiresAt)}</div>
        </div>
      </div>

      <div className="relative mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
          Warranty time
        </div>
        <div className="mt-1 text-2xl font-bold">
          {isActive
            ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
            : "Expired"}
        </div>
        <div className="mt-1 text-xs text-white/60">
          {isActive
            ? "The remaining period updates automatically each day."
            : "This 30-day service warranty has ended."}
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-3">
        <Link
          to="/dashboard/support"
          className="btn-primary"
          state={{
            warrantyBookingId: warranty.bookingId,
            warrantyId: warranty.warrantyId,
          }}
        >
          <FiCheckCircle />
          Claim
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="btn-ghost !border-white !bg-white !text-black hover:!border-white hover:!bg-gray-100"
        >
          <FiDownload className="!text-black" />
          <span className="!text-black">Card</span>
        </button>
      </div>
    </div>
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
    <div>
      <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
            <FiShield className="text-xl" />
          </span>

          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">Warranty Center</h1>
            <p className="text-muted">
              Completed Rovauto services include a 30-day warranty card.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadWarranties({ refresh: true })}
          disabled={refreshing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-bg-soft disabled:opacity-60"
        >
          <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Total cards", summary.total],
          ["Active", summary.active],
          ["Expired", summary.expired],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-2xl font-bold text-ink">Service warranty cards</h2>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-5 rounded-xl border border-line bg-white p-6 text-sm text-muted shadow-sm">
          Loading warranty cards...
        </div>
      ) : warranties.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-white p-8 text-center shadow-sm">
          <FiShield className="mx-auto text-4xl text-muted" />
          <h3 className="mt-3 text-lg font-bold text-ink">No warranty cards yet</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
            A warranty card will appear here automatically after a service booking is completed.
          </p>
          <Link
            to="/booking/vehicle"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-bold text-white transition hover:bg-black"
          >
            Book a service
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {warranties.map((warranty) => (
            <WarrantyCard key={warranty.id} warranty={warranty} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
