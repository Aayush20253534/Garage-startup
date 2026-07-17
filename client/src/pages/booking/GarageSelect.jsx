import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiRefreshCw,
  FiShield,
  FiStar,
  FiTool,
  FiZap,
} from "react-icons/fi";
import api from "@/api/axios";
import RouteMapCard from "@/components/maps/RouteMapCard";
import { useApp } from "@/hooks/useApp";
import { hasUsableIndiaCoordinates } from "@/utils/address";

const formatDistance = (garage) => {
  const value = garage.roadDistanceKm ?? garage.distanceKm;
  return Number.isFinite(Number(value))
    ? `${Number(value).toFixed(1)} km`
    : "Distance unavailable";
};

const getImage = (garage) =>
  garage.thumbnail?.imageUrl || garage.images?.[0]?.imageUrl || "";

export default function GarageSelect() {
  const { location, cart } = useApp();
  const nav = useNavigate();
  const [garages, setGarages] = useState([]);
  const [selectedGarageId, setSelectedGarageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const serviceIds = useMemo(
    () => cart.map((item) => item.id).filter(Boolean),
    [cart],
  );
  const selectedGarage =
    garages.find((garage) => garage.id === selectedGarageId) || garages[0] || null;

  const loadGarages = async () => {
    if (!hasUsableIndiaCoordinates(location)) {
      setLoading(false);
      setError("Save a valid service location before finding garages.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await api.get("/garages/nearby", {
        params: {
          verified: true,
          openNow: true,
          maxDistance: 30,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          ...(serviceIds.length && { serviceIds: serviceIds.join(",") }),
        },
      });
      const result = Array.isArray(response.data?.data) ? response.data.data : [];
      setGarages(result.slice(0, 10));
      setSelectedGarageId((current) =>
        result.some((item) => item.id === current) ? current : result[0]?.id || null,
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to rank nearby garages.",
      );
      setGarages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGarages();
  }, [location?.latitude, location?.longitude, serviceIds.join(",")]);

  return (
    <div className="container-x py-10 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="chip-brand">Step 3 of 3</span>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Best garages for this booking
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            RovAuto first filters eligible garages, then ranks the closest
            candidates by Google driving time. Final assignment still goes to
            the first eligible garage that accepts after payment.
          </p>
        </div>
        <button
          type="button"
          onClick={loadGarages}
          disabled={loading}
          className="btn-ghost"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-7 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="rounded-3xl border-2 border-ink bg-ink p-5 text-white">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-xl text-ink">
                <FiZap />
              </div>
              <div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  Assignment mode
                </span>
                <h2 className="mt-3 text-xl font-bold">Auto-assign best acceptance</h2>
                <p className="mt-1 text-sm leading-6 text-white/70">
                  Ranking influences the broadcast order, while live eligibility
                  and the first valid acceptance determine assignment.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card-soft p-6 text-sm text-muted">
              Calculating real driving times…
            </div>
          ) : garages.length ? (
            garages.slice(0, 5).map((garage, index) => {
              const selected = selectedGarage?.id === garage.id;
              return (
                <button
                  key={garage.id}
                  type="button"
                  onClick={() => setSelectedGarageId(garage.id)}
                  className={`w-full overflow-hidden rounded-3xl border p-4 text-left transition ${
                    selected
                      ? "border-ink bg-white shadow-soft ring-2 ring-ink/10"
                      : "border-line bg-white hover:border-ink/30"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-bg-soft">
                      {getImage(garage) ? (
                        <img
                          src={getImage(garage)}
                          alt={garage.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-2xl text-muted">
                          <FiTool />
                        </div>
                      )}
                      <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-gray-950 text-[10px] font-bold text-white">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-bold">{garage.name}</h3>
                          <p className="mt-1 truncate text-xs text-muted">
                            {garage.area}, {garage.city}
                          </p>
                        </div>
                        {garage.isVerified && (
                          <FiCheckCircle className="shrink-0 text-green-600" />
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="inline-flex items-center gap-1 rounded-full bg-bg-soft px-2.5 py-1">
                          <FiClock /> {garage.etaMinutes ? `${garage.etaMinutes} min` : "ETA pending"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-bg-soft px-2.5 py-1">
                          <FiMapPin /> {formatDistance(garage)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                          <FiStar fill="currentColor" /> {Number(garage.ratingAvg || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="card-soft p-6 text-sm text-muted">
              No eligible garage is currently available for every selected service.
            </div>
          )}
        </section>

        <section className="space-y-5">
          {selectedGarage && (
            <RouteMapCard
              origin={selectedGarage}
              destination={location}
              route={{
                distanceMeters: selectedGarage.routeDistanceMeters,
                durationSeconds: selectedGarage.etaSeconds,
              }}
              title={selectedGarage.name}
              subtitle="Preview route to your confirmed service location"
            />
          )}

          <div className="card-soft p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-xl">
                <FiShield />
              </div>
              <div>
                <h2 className="font-bold">How ranking is used</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Straight-line distance is used only for the first shortlist.
                  Google Route Matrix then ranks up to ten candidates by driving
                  duration. Availability, supported services, vehicle scope,
                  verification, working radius, and acceptance still apply.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => nav("/checkout")}
            className="btn-primary w-full"
          >
            Continue to checkout <FiArrowRight />
          </button>
        </section>
      </div>
    </div>
  );
}
