import { useState } from "react";
import { Link } from "react-router-dom";
import { SERVICE_CATEGORIES, SERVICES } from "@/data/services";
import { FiSearch, FiArrowRight, FiCheck } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

export default function Services() {
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState("");
  const { addToCart, cart } = useApp();
  
  const filteredCategories = q 
    ? SERVICE_CATEGORIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : SERVICE_CATEGORIES;
  
  const filteredServices = SERVICES.filter((s) => 
    (!cat || s.catId === cat) && 
    (!q || s.name.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="container-x py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">All Services</h1>
          <p className="text-muted mt-2">Curated for your vehicle. Transparent pricing.</p>
        </div>
        <div className="relative max-w-md w-full">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services or categories" className="w-full pl-11 pr-4 py-3 rounded-full border border-line focus:border-[#b9f000] outline-none" />
        </div>
      </div>

      {/* Categories Grid */}
      {(!q || filteredCategories.length > 0) && (
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-5">Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {filteredCategories.map((c) => (
              <Link to={c.isSos ? "/sos" : `/services/${c.id}`} key={c.id} className="cursor-pointer rounded-3xl bg-white p-5 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="text-xl font-bold mb-4">{c.name}</div>
                <div className="h-32 w-full rounded-2xl overflow-hidden">
                  <img src={c.image} alt={c.name} className="h-full w-full object-cover transition-transform hover:scale-105" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Services List */}
      {filteredServices.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-5">Services</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((s) => {
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
                    {s.includes.slice(0, 4).map((i) => <li key={i} className="flex items-center gap-2"><FiCheck className="text-[#9bd000]" /> {i}</li>)}
                  </ul>
                  <button onClick={() => addToCart(s)} className={`mt-5 ${inCart ? "btn-dark" : "btn-primary"}`}>
                    {inCart ? "Added ✓" : "Add to Booking"}
                  </button>
                </div>
              );
            })}
          </div>
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
