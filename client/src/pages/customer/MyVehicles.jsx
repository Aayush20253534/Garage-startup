import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import VehicleIcon from "@/components/common/VehicleIcon";
import { FiPlus, FiTrash2, FiCheckCircle } from "react-icons/fi";

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

  const syncVehicleState = (list = []) => {
    setVehicles(list);

    const defaultVehicle =
      list.find((item) => item.isDefault) || list[0] || null;

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

      const updatedVehicles = vehicles.map((item) => ({
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

      const updatedVehicles = vehicles.filter((item) => item.id !== id);

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
    return <div className="card-soft p-8 text-muted">Loading vehicles...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">My Vehicles</h2>

        <Link to="/booking/vehicle" className="btn-primary">
          <FiPlus /> Add Vehicle
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {vehicles.map((v) => {
          const isActive = vehicle?.id === v.id || v.isDefault;

          return (
            <div
              key={v.id}
              className={`card-soft p-5 text-left transition ${
                isActive ? "ring-2 ring-ink" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => handleSetDefault(v)}
                className="w-full text-left"
                disabled={defaultLoadingId === v.id}
              >
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand">
                    <VehicleIcon vehicle={v} className="h-9 w-9" />
                  </span>

                  <div>
                    <div className="font-semibold">
                      {v.brand} {v.model}
                    </div>

                    <div className="text-xs text-muted">
                      {v.fuelType || "Fuel"} -{" "}
                      {v.registrationNumber || "No registration"}
                    </div>

                    <div className="text-xs text-muted">Year: {v.year}</div>
                  </div>
                </div>
              </button>

              <div className="mt-4 flex items-center justify-between gap-2">
                {isActive ? (
                  <span className="chip-brand inline-flex">
                    <FiCheckCircle /> Default
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(v)}
                    disabled={defaultLoadingId === v.id}
                    className="text-xs font-medium text-ink hover:underline"
                  >
                    {defaultLoadingId === v.id ? "Setting..." : "Set Default"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(v.id)}
                  disabled={deletingId === v.id}
                  className="text-xs font-medium text-red-600 hover:underline inline-flex items-center gap-1"
                >
                  <FiTrash2 />
                  {deletingId === v.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          );
        })}

        {vehicles.length === 0 && (
          <div className="card-soft p-8 text-center text-muted">
            No vehicles yet.{" "}
            <Link to="/booking/vehicle" className="text-ink font-medium">
              Add one
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
