import { FiShield, FiCheckCircle, FiDownload } from "react-icons/fi";

const CARDS = [
  { id: "W-2384", service: "Standard Service Package", vehicle: "Hyundai i20 Petrol", start: "12 Jun 2026", end: "12 Jul 2026", active: true },
  { id: "W-2102", service: "AC Gas Refill & Service", vehicle: "Hyundai i20 Petrol", start: "02 May 2026", end: "01 Jun 2026", active: false },
];

export default function Warranty() {
  return (
    <div className="container-x py-12">
      <div className="flex items-center gap-4 mb-2">
        <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand"><FiShield className="text-xl" /></span>
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Warranty Center</h1>
          <p className="text-muted">Every Rovauto service is backed by a 30-day warranty.</p>
        </div>
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-5">
        {CARDS.map((w) => (
          <div key={w.id} className="rounded-3xl bg-gradient-to-br from-ink to-ink-2 text-white p-6 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-brand/20 blur-3xl" />
            <div className="flex items-center justify-between relative">
              <span className="chip-brand">{w.active ? "Active" : "Expired"}</span>
              <span className="text-xs text-white/60">Warranty ID · {w.id}</span>
            </div>
            <div className="mt-6 relative">
              <div className="text-xs text-white/60">Service</div>
              <div className="text-xl font-semibold">{w.service}</div>
              <div className="mt-3 text-sm text-white/70">{w.vehicle}</div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 relative">
              <div><div className="text-xs text-white/60">Activated</div><div className="font-semibold">{w.start}</div></div>
              <div><div className="text-xs text-white/60">Valid till</div><div className="font-semibold">{w.end}</div></div>
            </div>
            <div className="mt-6 flex gap-2 relative">
              <button className="btn-primary"><FiCheckCircle /> Claim</button>
              <button className="btn-ghost text-white border-white/20 hover:border-white"><FiDownload /> Card</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
