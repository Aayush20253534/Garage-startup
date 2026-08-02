import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import SafeImage from "@/components/common/SafeImage";
import { getOptimizedImageUrl } from "@/utils/imageCache";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTruck,
} from "react-icons/fi";

const normalizeCatalogName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getCatalogKey = (brand, model) =>
  `${normalizeCatalogName(brand)}::${normalizeCatalogName(model)}`;

const getVehicleTitle = (savedVehicle) =>
  `${savedVehicle?.brand || ""} ${savedVehicle?.model || ""}`.trim() ||
  "Saved vehicle";

export default function MyVehicles() {
  const {
    vehicles,
    vehicle,
    setVehicle,
    setVehicles,
    fetchVehicles,
    vehiclesCache,
    vehicleMetaCache,
    fetchVehicleMeta,
    clearDashboardCache,
    clearVehiclesCache,
  } = useApp();

  const [loading, setLoading] = useState(
    () => !Array.isArray(vehiclesCache),
  );
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [defaultLoadingId, setDefaultLoadingId] = useState(null);

  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
  const modelImageByVehicle = useMemo(() => {
    const catalog = Array.isArray(vehicleMetaCache) ? vehicleMetaCache : [];
    const imageMap = new Map();

    catalog.forEach((brand) => {
      const models = Array.isArray(brand?.models) ? brand.models : [];

      models.forEach((model) => {
        if (!model?.imageUrl) return;
        imageMap.set(getCatalogKey(brand?.name, model?.name), model.imageUrl);
      });
    });

    return imageMap;
  }, [vehicleMetaCache]);

  const getVehicleModelImage = (savedVehicle) =>
    savedVehicle?.modelImageUrl ||
    savedVehicle?.vehicleModel?.imageUrl ||
    modelImageByVehicle.get(
      getCatalogKey(savedVehicle?.brand, savedVehicle?.model),
    ) ||
    "";

  const syncVehicleState = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];

    setVehicles(safeList);

    const defaultVehicle =
      safeList.find((item) => item.isDefault) || safeList[0] || null;

    setVehicle(defaultVehicle);
  };

  const loadVehicles = async ({ force = false } = {}) => {
    try {
      setError("");
      if (force || !Array.isArray(vehiclesCache)) setLoading(true);

      const list = await fetchVehicles({ force });
      syncVehicleState(list || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVehicles();
    fetchVehicleMeta?.({ force: true }).catch(() => null);
  }, []);

  const handleSetDefault = async (selectedVehicle) => {
    try {
      setError("");
      setDefaultLoadingId(selectedVehicle.id);

      await api.patch(`/vehicles/${selectedVehicle.id}/default`);

      const updatedVehicles = safeVehicles.map((item) => ({
        ...item,
        isDefault: item.id === selectedVehicle.id,
      }));

      setVehicles(updatedVehicles);
      setVehicle({ ...selectedVehicle, isDefault: true });

      clearVehiclesCache?.();
      clearDashboardCache?.();

      await loadVehicles({ force: true });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to set default vehicle");
    } finally {
      setDefaultLoadingId(null);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Delete this vehicle?");
    if (!confirmed) return;

    try {
      setError("");
      setDeletingId(id);

      await api.delete(`/vehicles/${id}`);

      const updatedVehicles = safeVehicles.filter((item) => item.id !== id);
      syncVehicleState(updatedVehicles);

      clearVehiclesCache?.();
      clearDashboardCache?.();

      await loadVehicles({ force: true });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete vehicle");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card-soft min-w-0 rounded-2xl p-5 text-sm text-muted">
        Loading vehicles...
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-5 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-bold text-ink">My Vehicles</h2>
          <p className="mt-1 break-words text-sm leading-6 text-muted">
            Manage your saved vehicles and default booking vehicle.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:w-auto">
          <button
            type="button"
            onClick={() => {
              void Promise.allSettled([
                loadVehicles({ force: true }),
                fetchVehicleMeta?.({ force: true }),
              ]);
            }}
            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft sm:px-4"
          >
            <FiRefreshCw className="shrink-0" />
            <span className="truncate">Refresh</span>
          </button>

          <Link
            to="/booking/vehicle"
            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-bold text-black transition hover:bg-brand-dark sm:px-4"
          >
            <FiPlus className="shrink-0" />
            <span className="truncate">Add Vehicle</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex min-w-0 items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      {safeVehicles.length ? (
        <div className="grid min-w-0 gap-3 min-[600px]:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {safeVehicles.map((savedVehicle) => {
            const isActive =
              vehicle?.id === savedVehicle.id || savedVehicle.isDefault;
            const isSettingDefault = defaultLoadingId === savedVehicle.id;
            const isDeleting = deletingId === savedVehicle.id;
            const modelImageUrl = getVehicleModelImage(savedVehicle);
            const vehicleTitle = getVehicleTitle(savedVehicle);

            return (
              <article
                key={savedVehicle.id}
                className={[
                  "card-soft min-w-0 overflow-hidden rounded-2xl border p-2.5 shadow-sm transition hover:shadow-md sm:p-4",
                  isActive
                    ? "border-brand bg-brand-soft/30"
                    : "border-line bg-white",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => handleSetDefault(savedVehicle)}
                  disabled={isSettingDefault}
                  aria-pressed={isActive}
                  className="grid w-full min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-70 sm:block"
                >
                  <div className="h-24 min-w-0 overflow-hidden rounded-lg border border-line bg-bg-soft sm:h-auto sm:rounded-xl">
                    <SafeImage
                      src={getOptimizedImageUrl(modelImageUrl, { width: 720 })}
                      alt={vehicleTitle}
                      width="720"
                      height="405"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover sm:aspect-[16/9] sm:h-auto"
                      fallback={
                        <span className="flex h-24 w-full items-center justify-center bg-brand text-2xl text-black sm:aspect-[16/9] sm:h-auto sm:text-4xl">
                          <FiTruck />
                        </span>
                      }
                    />
                  </div>

                  <div className="min-w-0 sm:mt-4">
                    <div className="min-w-0 break-words text-base font-bold leading-5 text-ink [overflow-wrap:anywhere] sm:text-lg sm:leading-6">
                      {vehicleTitle}
                    </div>

                    <div className="mt-2 min-w-0 space-y-1.5 text-xs sm:hidden">
                      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                        <span className="min-w-0">
                          <span className="text-muted">Fuel:</span>{" "}
                          <span className="font-semibold text-ink">
                            {savedVehicle.fuelType || "Not provided"}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="text-muted">Year:</span>{" "}
                          <span className="font-semibold text-ink">
                            {savedVehicle.year || "Not provided"}
                          </span>
                        </span>
                      </div>

                      <div
                        className="min-w-0 truncate rounded-md border border-line bg-white/80 px-2 py-1.5 font-semibold text-ink"
                        title={savedVehicle.registrationNumber || "Not provided"}
                      >
                        {savedVehicle.registrationNumber || "Not provided"}
                      </div>
                    </div>

                    <div className="mt-3 hidden min-w-0 grid-cols-2 gap-2 sm:grid">
                      <div className="min-w-0 rounded-lg border border-line bg-white/80 p-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                          Fuel type
                        </div>
                        <div className="mt-1 min-w-0 break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">
                          {savedVehicle.fuelType || "Not provided"}
                        </div>
                      </div>

                      <div className="min-w-0 rounded-lg border border-line bg-white/80 p-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                          Model year
                        </div>
                        <div className="mt-1 min-w-0 break-words text-sm font-semibold text-ink">
                          {savedVehicle.year || "Not provided"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 hidden min-w-0 rounded-lg border border-line bg-white/80 p-2.5 sm:block">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        Registration number
                      </div>
                      <div className="mt-1 min-w-0 break-all text-sm font-semibold text-ink">
                        {savedVehicle.registrationNumber || "Not provided"}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 border-t border-line pt-3 sm:mt-4 sm:pt-4">
                  {isActive ? (
                    <span className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-brand-soft px-2 py-2 text-center text-xs font-bold text-ink sm:px-3">
                      <FiCheckCircle className="shrink-0" />
                      <span className="truncate sm:hidden">Default</span>
                      <span className="hidden truncate sm:inline">Default vehicle</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(savedVehicle)}
                      disabled={isSettingDefault}
                      className="inline-flex min-h-9 min-w-0 items-center justify-center rounded-lg border border-line px-2 py-2 text-center text-xs font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
                    >
                      <span className="truncate sm:hidden">
                        {isSettingDefault ? "Setting..." : "Set default"}
                      </span>
                      <span className="hidden truncate sm:inline">
                        {isSettingDefault ? "Setting..." : "Set as default"}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(savedVehicle.id)}
                    disabled={isDeleting}
                    className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-center text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
                  >
                    <FiTrash2 className="shrink-0" />
                    <span className="truncate sm:hidden">
                      {isDeleting ? "Deleting..." : "Delete"}
                    </span>
                    <span className="hidden truncate sm:inline">
                      {isDeleting ? "Deleting..." : "Delete vehicle"}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card-soft min-w-0 rounded-2xl p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl text-black">
            <FiTruck />
          </div>

          <h3 className="mt-4 break-words text-lg font-bold text-ink">
            No vehicles added yet
          </h3>

          <p className="mx-auto mt-2 max-w-md break-words text-sm leading-6 text-muted">
            Add your first vehicle to start booking services.
          </p>

          <Link
            to="/booking/vehicle"
            className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-black transition hover:bg-brand-dark min-[390px]:w-auto"
          >
            <FiPlus />
            Add Vehicle
          </Link>
        </div>
      )}
    </div>
  );
}
