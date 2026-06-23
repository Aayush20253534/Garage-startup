import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { FiTruck, FiCalendar, FiShield, FiArrowRight, FiCheckCircle, FiClock } from "react-icons/fi";

export default function Dashboard() {
  const { user, vehicle } = useApp();
  return (
    <div className="grid gap-6">
      <div className="rounded-3xl bg-gradient-to-br from-ink to-ink-2 text-white p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <h2 className="text-3xl font-bold">Hello {user?.name || "there"} 👋</h2>
        <p className="text-white/70 mt-2">Here's what's happening with your vehicle.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/booking/vehicle" className="btn-primary">Book a service</Link>
          <Link to="/warranty" className="btn-ghost text-white border-white/20 hover:border-white"><FiShield /> Warranty</Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FiCalendar, l: "Active Bookings", n: 1, sub: "In progress" },
          { icon: FiClock, l: "Completed", n: 7, sub: "Last 6 months" },
          { icon: FiShield, l: "Active Warranties", n: 1, sub: "Expires 12 Jul" },
          { icon: FiTruck, l: "Vehicles", n: 1, sub: vehicle ? `${vehicle.brand} ${vehicle.model}` : "Add a vehicle" },
        ].map((s) => (
          <div key={s.l} className="card-soft p-5">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand"><s.icon /></div>
            <div className="text-3xl font-bold mt-3">{s.n}</div>
            <div className="text-sm">{s.l}</div>
            <div className="text-xs text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Active service</h3><Link to="/tracking" className="text-sm text-ink font-medium">Track <FiArrowRight className="inline" /></Link></div>
          <div className="flex items-center gap-4">
            <span className="grid place-items-center h-14 w-14 rounded-2xl bg-brand"><FiTruck className="text-xl" /></span>
            <div className="flex-1"><div className="font-semibold">Standard Service Package</div><div className="text-xs text-muted">{vehicle?.brand} {vehicle?.model} · AutoCare Premium</div></div>
            <span className="chip-brand">In Progress</span>
          </div>
          <div className="mt-4 h-2 bg-bg-soft rounded-full overflow-hidden"><div className="h-full bg-brand" style={{ width: "60%" }} /></div>
        </div>

        <div className="card-soft p-6">
          <h3 className="font-semibold mb-3">Upcoming Maintenance</h3>
          <ul className="grid gap-3 text-sm">
            {[["Oil change", "Due in 1,800 km"], ["Tyre rotation", "Due in 3,200 km"], ["AC service", "Due Apr 2027"]].map(([n, d]) => (
              <li key={n} className="flex items-start gap-3"><FiCheckCircle className="text-brand-dark mt-0.5" /><div><div className="font-medium">{n}</div><div className="text-xs text-muted">{d}</div></div></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
