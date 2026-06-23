import { useState } from "react";
import { Link } from "react-router-dom";
import { SERVICE_CATEGORIES, SERVICES } from "@/data/services";
import { FiSearch, FiArrowRight, FiCheck } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

export default function Services() {
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState("");
  const { addToCart, cart } = useApp();
  const list = SERVICES.filter((s) => (!cat || s.catId === cat) && s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="container-x py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">All Services</h1>
          <p className="text-muted mt-1">Curated for your vehicle. Transparent pricing.</p>
        </div>
        <div className="relative max-w-md w-full">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services" className="w-full pl-11 pr-4 py-3 rounded-full border border-line focus:border-ink outline-none" />
        </div>
      </div>

      {/* Categories Grid like in photo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 mb-10">
        {SERVICE_CATEGORIES.map((c) => (
          <Link to={`/services/${c.id}`} key={c.id} className="cursor-pointer rounded-3xl bg-white p-5 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="text-xl font-bold mb-4">{c.name}</div>
            <div className="h-32 w-full rounded-2xl overflow-hidden">
              <img src={c.image} alt={c.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* Services List */}
      {list.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((s) => {
            const inCart = cart.some((c) => c.id === s.id);
            return (
              <div key={s.id} className="card-soft p-5 flex flex-col">
                {/* Service Image */}
                {s.image && (
                  <div className="h-40 w-full rounded-2xl overflow-hidden mb-4">
                    <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="chip">{s.duration}</span>
                    <h3 className="mt-3 font-semibold text-lg">{s.name}</h3>
                  </div>
                  <div className="text-right"><div className="text-xs text-muted">From</div><div className="font-bold text-xl">₹{s.price}</div></div>
                </div>
                <p className="text-sm text-muted mt-2">{s.desc}</p>
                <ul className="mt-4 grid gap-1.5 text-sm">
                  {s.includes.slice(0, 4).map((i) => <li key={i} className="flex items-center gap-2"><FiCheck className="text-brand-dark" /> {i}</li>)}
                </ul>
                <button onClick={() => addToCart(s)} className={`mt-5 ${inCart ? "btn-dark" : "btn-primary"}`}>
                  {inCart ? "Added ✓" : "Add to Booking"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-5 inset-x-0 z-40 flex justify-center px-4">
          <Link to="/booking/garage" className="btn-dark shadow-2xl px-6 py-3.5">
            {cart.length} service{cart.length > 1 ? "s" : ""} · ₹{cart.reduce((a, b) => a + b.price, 0)} · Continue <FiArrowRight />
          </Link>
        </div>
      )}
    </div>
  );
}
