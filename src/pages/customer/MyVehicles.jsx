import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { FiPlus, FiTruck } from "react-icons/fi";

export default function MyVehicles() {
  const { vehicles, vehicle, setVehicle } = useApp();
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">My Vehicles</h2>
        <Link to="/booking/vehicle" className="btn-primary"><FiPlus /> Add Vehicle</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {vehicles.map((v) => (
          <button key={v.id} onClick={() => setVehicle(v)} className={`card-soft p-5 text-left transition ${vehicle?.id === v.id ? "ring-2 ring-ink" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand"><FiTruck /></span>
              <div><div className="font-semibold">{v.brand} {v.model}</div><div className="text-xs text-muted">{v.fuel} · {v.reg}</div></div>
            </div>
            {vehicle?.id === v.id && <span className="chip-brand mt-4 inline-flex">Active</span>}
          </button>
        ))}
        {vehicles.length === 0 && <div className="card-soft p-8 text-center text-muted">No vehicles yet. <Link to="/booking/vehicle" className="text-ink font-medium">Add one</Link></div>}
      </div>
    </div>
  );
}
