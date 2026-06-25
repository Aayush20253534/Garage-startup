import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { VEHICLE_BRANDS, FUEL_TYPES } from "@/data/vehicles";
import { useApp } from "@/hooks/useApp";
import { FiArrowRight, FiCheck } from "react-icons/fi";

export default function VehicleSelect() {
  const [brand, setBrand] = useState(null);
  const [model, setModel] = useState(null);
  const [fuel, setFuel] = useState(null);
  const { addVehicle } = useApp();
  const nav = useNavigate();

  const confirm = () => {
    addVehicle({ brand: brand.name, model, fuel, reg: "DL 3C AB 1234", year: 2023 });
    nav("/services");
  };

  return (
    <div className="container-x py-12 max-w-4xl">
      <div className="flex items-center gap-3 mb-2"><span className="chip-brand">Step 1 of 3</span></div>
      <h1 className="text-3xl sm:text-5xl font-bold">Which car do you drive?</h1>
      <p className="text-muted mt-2">We'll tailor services specifically for your vehicle.</p>

      <div className="mt-10 grid gap-6">
        <Block title="Select Brand" done={!!brand} value={brand?.name}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {VEHICLE_BRANDS.map((b) => (
              <button key={b.name} onClick={() => { setBrand(b); setModel(null); }} className={`p-4 rounded-2xl border text-left transition ${brand?.name === b.name ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>
                {b.image ? (
                  <img src={b.image} alt={b.name} className="h-10 w-auto mb-2 object-contain" />
                ) : (
                  <b.icon className="h-10 w-auto mb-2" />
                )}
                <div className="text-sm font-semibold">{b.name}</div>
              </button>
            ))}
          </div>
        </Block>

        {brand && (
          <Block title="Select Model" done={!!model} value={model}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {brand.models.map((m) => (
                <button key={m} onClick={() => setModel(m)} className={`px-4 py-3 rounded-2xl border text-left transition ${model === m ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>
                  <div className="font-semibold">{brand.name} {m}</div>
                </button>
              ))}
            </div>
          </Block>
        )}

        {model && (
          <Block title="Select Fuel" done={!!fuel} value={fuel}>
            <div className="flex flex-wrap gap-3">
              {FUEL_TYPES.map((f) => (
                <button key={f} onClick={() => setFuel(f)} className={`px-5 py-3 rounded-full border text-sm font-medium transition ${fuel === f ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>{f}</button>
              ))}
            </div>
          </Block>
        )}

        {brand && model && fuel && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-soft p-6">
            <div className="flex items-center gap-4">
              <span className="grid place-items-center h-14 w-14 rounded-2xl bg-brand p-2">
                {brand.image ? (
                  <img src={brand.image} alt={brand.name} className="h-8 w-8 object-contain" />
                ) : (
                  <brand.icon className="h-8 w-8 text-ink" />
                )}
              </span>
              <div className="flex-1">
                <div className="text-xs text-muted">Your vehicle</div>
                <div className="text-xl font-bold">{brand.name} {model}</div>
                <div className="text-sm text-muted">{fuel}</div>
              </div>
              <span className="chip-brand">Great! Services tailored for you.</span>
            </div>
            <button onClick={confirm} className="btn-primary mt-5 w-full sm:w-auto">Continue to Services <FiArrowRight /></button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Block({ title, done, value, children }) {
  return (
    <div className="card-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{title}</h3>
        {done && <span className="chip flex items-center gap-1"><FiCheck /> {value}</span>}
      </div>
      {children}
    </div>
  );
}
