import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTruck,
} from "react-icons/fi";

export default function MyVehicles() {
  const {
    vehicles,
    vehicle,
    setVehicle,
    setVehicles,
    fetchVehicles,
    clearDashboardCache,
    clearVehiclesCache,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [defaultLoadingId, setDefaultLoadingId] = useState(null);

  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];

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
      setLoading(true);

      const list = await fetchVehicles({ force });
      syncVehicleState(list || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
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
      <div className="card-soft rounded-2xl p-5 text-sm text-muted">
        Loading vehicles...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">My Vehicles</h2>
          <p className="mt-1 text-sm text-muted">
            Manage your saved vehicles and default booking vehicle.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadVehicles({ force: true })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
          >
            <FiRefreshCw />
            Refresh
          </button>

          <Link
            to="/booking/vehicle"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
          >
            <FiPlus />
            Add Vehicle
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {safeVehicles.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {safeVehicles.map((v) => {
            const isActive = vehicle?.id === v.id || v.isDefault;
            const isSettingDefault = defaultLoadingId === v.id;
            const isDeleting = deletingId === v.id;

            return (
              <article
                key={v.id}
                className={[
                  "card-soft rounded-2xl p-4 shadow-sm transition hover:shadow-md",
                  isActive ? "ring-2 ring-ink" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => handleSetDefault(v)}
                  disabled={isSettingDefault}
                  className="w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl text-black">
                      <FiTruck />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink">
                        {v.brand} {v.model}
                      </div>

                      <div className="mt-1 truncate text-xs text-muted">
                        {v.fuelType || "Fuel"} ·{" "}
                        {v.registrationNumber || "No registration"}
                      </div>

                      <div className="mt-1 text-xs text-muted">
                        Year: {v.year || "-"}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
                  {isActive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink">
                      <FiCheckCircle />
                      Default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(v)}
                      disabled={isSettingDefault}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-line px-3 text-xs font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSettingDefault ? "Setting..." : "Set Default"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    disabled={isDeleting}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiTrash2 />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card-soft rounded-2xl p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl text-black">
            <FiTruck />
          </div>

          <h3 className="mt-4 text-lg font-bold text-ink">
            No vehicles added yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Add your first vehicle to start booking services. Apparently even
            software needs to know which car exists before servicing it.
          </p>

          <Link
            to="/booking/vehicle"
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
          >
            <FiPlus />
            Add Vehicle
          </Link>
        </div>
      )}
    </div>
  );
}