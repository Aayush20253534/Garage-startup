import { useState } from "react";
import { Link } from "react-router-dom";
import { SERVICE_CATEGORIES, CATEGORY_PACKAGES } from "@/data/services";
import { useApp } from "@/hooks/useApp";
import { FiArrowRight, FiCheck, FiTruck } from "react-icons/fi";

export default function ServiceSelect() {
  const { vehicle, cart, addToCart, removeFromCart } = useApp();
  const [cat, setCat] = useState("scheduled");
  const list = CATEGORY_PACKAGES[cat] || [];
  const total = cart.reduce((a, b) => a + b.price, 0);

  return (
    <div className="container-x py-12">
      <div className="flex items-center gap-3 mb-2"><span className="chip-brand">Step 2 of 3</span></div>
      <h1 className="text-3xl sm:text-4xl font-bold">Pick services for your {vehicle ? `${vehicle.brand} ${vehicle.model}` : "vehicle"}</h1>
      <p className="text-muted mt-2">Add multiple — like a Swiggy cart.</p>

      <div className="mt-8 grid lg:grid-cols-[260px_1fr_320px] gap-6">
        <aside className="card-soft p-3 lg:sticky lg:top-24 h-fit">
          <div className="grid gap-1">
            {SERVICE_CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition ${cat === c.id ? "bg-ink text-white" : "hover:bg-bg-soft"}`}>
                <c.icon style={{ color: cat === c.id ? "#b9f000" : c.color }} /> {c.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="grid gap-4">
          {list.map((s) => {
            const inCart = cart.some((c) => c.id === s.id);
            return (
              <div key={s.id} className="card-soft p-5 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <span className="chip">{s.duration}</span>
                  <h3 className="font-semibold text-lg mt-2">{s.name}</h3>
                  <p className="text-sm text-muted mt-1">{s.desc}</p>
                  <ul className="mt-3 grid sm:grid-cols-2 gap-1.5 text-sm">
                    {s.includes.map((i) => <li key={i} className="flex items-center gap-2"><FiCheck className="text-brand-dark shrink-0" /> {i}</li>)}
                  </ul>
                </div>
                <div className="sm:w-40 text-right flex sm:flex-col items-center sm:items-end justify-between gap-2">
                  <div><div className="text-xs text-muted">From</div><div className="font-bold text-2xl">₹{s.price}</div></div>
                  <button onClick={() => inCart ? removeFromCart(s.id) : addToCart(s)} className={inCart ? "btn-dark" : "btn-primary"}>{inCart ? "Remove" : "Add"}</button>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-24 h-fit card-soft p-5">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand"><FiTruck /></span>
            <div className="text-sm"><div className="font-semibold">{vehicle?.brand} {vehicle?.model}</div><div className="text-muted text-xs">{vehicle?.fuel}</div></div>
          </div>
          <hr className="my-4 border-line" />
          <div className="font-semibold mb-2">Your Cart ({cart.length})</div>
          {cart.length === 0 ? <p className="text-sm text-muted">No services added yet.</p> :
            <div className="grid gap-2">
              {cart.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="font-semibold">₹{c.price}</span>
                </div>
              ))}
            </div>}
          <hr className="my-4 border-line" />
          <div className="flex items-center justify-between"><span className="text-muted">Estimated</span><span className="text-xl font-bold">₹{total}</span></div>
          <Link to="/booking/garage" className={`btn-primary w-full mt-4 ${cart.length === 0 ? "opacity-50 pointer-events-none" : ""}`}>Continue <FiArrowRight /></Link>
        </aside>
      </div>
    </div>
  );
}
