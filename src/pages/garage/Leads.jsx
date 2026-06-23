import { Link } from "react-router-dom";
import { FiCheck, FiX, FiMapPin } from "react-icons/fi";

const LEADS = [
  { id: "RV2391", vehicle: "Hyundai i20 Petrol", svc: "General Service", bill: 3500, dist: "2.5 km" },
  { id: "RV2390", vehicle: "Tata Nexon Diesel", svc: "AC Gas Refill", bill: 2499, dist: "3.1 km" },
  { id: "RV2389", vehicle: "Maruti Swift Petrol", svc: "Battery Replacement", bill: 5400, dist: "1.8 km" },
];

export default function Leads() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Incoming Leads</h2>
      <div className="grid gap-4">
        {LEADS.map((l) => (
          <div key={l.id} className="card-soft p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="chip-brand">New Lead</span><span className="text-xs text-muted">#{l.id}</span></div>
                <div className="mt-2 font-semibold">{l.vehicle}</div>
                <div className="text-sm text-muted">{l.svc} · Est. ₹{l.bill}</div>
                <div className="text-xs text-muted mt-1 flex items-center gap-1"><FiMapPin /> {l.dist} away · Indirapuram</div>
              </div>
              <Link to={`/garage/magic/${l.id}`} className="btn-primary"><FiCheck /> Accept (₹40)</Link>
              <button className="btn-ghost"><FiX /> Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
