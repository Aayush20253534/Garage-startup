import { useState } from "react";
import { Link } from "react-router-dom";
import { SERVICE_CATEGORIES } from "@/data/services";
import { FiSearch, FiArrowRight } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

export default function Services() {
  const [q, setQ] = useState("");
  const { cart } = useApp();
  
  const filteredCategories = q 
    ? SERVICE_CATEGORIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : SERVICE_CATEGORIES;

  return (
    <div className="container-x py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">All Services</h1>
          <p className="text-muted mt-2">Curated for your vehicle. Transparent pricing.</p>
        </div>
        <div className="relative max-w-md w-full">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories" className="w-full pl-11 pr-4 py-3 rounded-full border border-line focus:border-[#b9f000] outline-none" />
        </div>
      </div>

      {/* Categories Grid */}
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
