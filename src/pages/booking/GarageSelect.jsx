import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GARAGES } from "@/data/garages";
import { FiStar, FiMapPin, FiArrowRight, FiCheckCircle, FiZap } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

export default function GarageSelect() {
  const { location, setLocation } = useApp();
  const [picked, setPicked] = useState("auto");
  const nav = useNavigate();

  return (
    <div className="container-x py-12 max-w-5xl">
      <div className="flex items-center gap-3 mb-2"><span className="chip-brand">Step 3 of 3</span></div>
      <h1 className="text-3xl sm:text-4xl font-bold">Where do you want the service?</h1>
      <p className="text-muted mt-2">Enter your location and pick a garage — or let us auto-assign the best one.</p>

      <div className="mt-8 card-soft p-5 grid sm:grid-cols-4 gap-3">
        <input value={location.area} onChange={(e) => setLocation({ ...location, area: e.target.value })} placeholder="Area" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
        <input value={location.city} onChange={(e) => setLocation({ ...location, city: e.target.value })} placeholder="City" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
        <input value={location.pincode} onChange={(e) => setLocation({ ...location, pincode: e.target.value })} placeholder="Pincode" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
        <button className="btn-dark"><FiMapPin /> Current Location</button>
      </div>

      <button onClick={() => setPicked("auto")} className={`mt-6 w-full text-left rounded-3xl p-6 transition border-2 ${picked === "auto" ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
        <div className="flex items-center gap-4">
          <span className="grid place-items-center h-14 w-14 rounded-2xl bg-brand text-ink"><FiZap className="text-2xl" /></span>
          <div className="flex-1">
            <div className="flex items-center gap-2"><span className="chip-brand">Recommended</span></div>
            <h3 className="font-semibold text-xl mt-2">⭐ Auto Assign Best Garage</h3>
            <p className={`text-sm mt-1 ${picked === "auto" ? "text-white/70" : "text-muted"}`}>Automatically assign based on ratings, expertise, quality score and availability.</p>
          </div>
          {picked === "auto" && <FiCheckCircle className="text-brand text-2xl" />}
        </div>
      </button>

      <div className="mt-6 text-sm font-semibold text-muted">Or pick from top 3 nearby verified garages</div>
      <div className="mt-3 grid gap-3">
        {GARAGES.map((g) => (
          <button key={g.id} onClick={() => setPicked(g.id)} className={`w-full text-left card-soft p-5 transition ${picked === g.id ? "ring-2 ring-ink" : ""}`}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="grid place-items-center h-14 w-14 rounded-2xl bg-bg-soft text-2xl">🛠️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><h4 className="font-semibold text-lg">{g.name}</h4>{g.verified && <span className="chip-brand">Verified</span>}</div>
                <div className="text-sm text-muted">{g.area} · {g.distance} away · ETA {g.eta}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-amber-500 text-sm justify-end"><FiStar fill="currentColor" /> {g.rating} <span className="text-muted">({g.reviews})</span></div>
                <div className="font-bold mt-1">₹{g.cost}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button onClick={() => nav("/checkout")} className="btn-primary mt-8 w-full sm:w-auto">Proceed to Checkout <FiArrowRight /></button>
    </div>
  );
}
