import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import SafeImage from "@/components/common/SafeImage";
import RegistrationVerificationField from "@/components/vehicle/RegistrationVerificationField";
import { getOptimizedImageUrl } from "@/utils/imageCache";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit3,
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
    user,
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
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editRegistrationNumber, setEditRegistrationNumber] = useState("");
  const [editRegistrationVerified, setEditRegistrationVerified] = useState(false);
  const [savingRegistrationId, setSavingRegistrationId] = useState(null);

  const registrationRequired = user?.vehicleRegistrationRequired === true;
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

  const startRegistrationEdit = (savedVehicle) => {
    setEditingVehicleId(savedVehicle.id);
    setEditRegistrationNumber(savedVehicle.registrationNumber || "");
    setEditRegistrationVerified(savedVehicle.registrationVerified === true);
    setError("");
  };

  const cancelRegistrationEdit = () => {
    setEditingVehicleId(null);
    setEditRegistrationNumber("");
    setEditRegistrationVerified(false);
  };

  const saveRegistration = async (savedVehicle) => {
    const hasRegistrationNumber = Boolean(editRegistrationNumber.trim());
    if (registrationRequired && !hasRegistrationNumber) {
      setError("Registration number verification is required for your account");
      return;
    }
    if (hasRegistrationNumber && !editRegistrationVerified) {
      setError("Verify the registration number before saving it");
      return;
    }

    try {
      setSavingRegistrationId(savedVehicle.id);
      setError("");
      await api.patch(`/vehicles/${savedVehicle.id}`, {
        registrationNumber: editRegistrationNumber.trim() || null,
      });
      clearVehiclesCache?.();
      clearDashboardCache?.();
      await loadVehicles({ force: true });
      cancelRegistrationEdit();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update registration number");
    } finally {
      setSavingRegistrationId(null);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
                  "card-soft overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
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
                  className="w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex items-start gap-3">
                    <SafeImage
                      src={getOptimizedImageUrl(modelImageUrl, { width: 320 })}
                      alt={vehicleTitle}
                      width="160"
                      height="112"
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-20 shrink-0 rounded-xl border border-line bg-white object-cover"
                      fallback={
                        <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-brand text-xl text-black">
                          <FiTruck />
                        </span>
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink">
                        {vehicleTitle}
                      </div>

                      <div className="mt-1 truncate text-xs text-muted">
                        {savedVehicle.fuelType || "Fuel"} ·{" "}
                        {savedVehicle.registrationNumber || "No registration"}
                      </div>

                      <div className="mt-1 text-xs text-muted">
                        Year: {savedVehicle.year || "-"}
                      </div>

                      {savedVehicle.registrationVerified && (
                        <div className="mt-1 text-[11px] font-bold text-green-700">
                          RC verified
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-line pt-4">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-black">
                        <FiCheckCircle />
                        Default vehicle
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-ink">
                        {isSettingDefault ? "Setting..." : "Set as default"}
                      </span>
                    )}
                  </div>
                </button>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => startRegistrationEdit(savedVehicle)}
                    className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
                  >
                    <FiEdit3 className="shrink-0" />
                    <span className="truncate">Registration</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(savedVehicle.id)}
                    disabled={isDeleting}
                    className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiTrash2 className="shrink-0" />
                    <span className="truncate">
                      {isDeleting ? "Deleting..." : "Delete"}
                    </span>
                  </button>
                </div>

                {editingVehicleId === savedVehicle.id && (
                  <div className="mt-3 rounded-xl border border-line bg-white p-3 sm:p-4">
                    <RegistrationVerificationField
                      value={editRegistrationNumber}
                      onChange={setEditRegistrationNumber}
                      brand={savedVehicle.brand}
                      model={savedVehicle.model}
                      fuelType={savedVehicle.fuelType}
                      required={registrationRequired}
                      initiallyVerified={savedVehicle.registrationVerified === true}
                      onVerificationChange={setEditRegistrationVerified}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={cancelRegistrationEdit}
                        disabled={savingRegistrationId === savedVehicle.id}
                        className="h-9 rounded-lg border border-line text-xs font-bold text-ink transition hover:border-ink disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveRegistration(savedVehicle)}
                        disabled={savingRegistrationId === savedVehicle.id}
                        className="h-9 rounded-lg bg-ink text-xs font-bold text-white transition hover:bg-ink/90 disabled:opacity-50"
                      >
                        {savingRegistrationId === savedVehicle.id
                          ? "Saving..."
                          : "Save registration"}
                      </button>
                    </div>
                  </div>
                )}
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
