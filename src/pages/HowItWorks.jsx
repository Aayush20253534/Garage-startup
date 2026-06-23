import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiTruck, FiPackage, FiMapPin, FiCheckCircle, FiNavigation, FiShield } from "react-icons/fi";

const STEPS = [
  { icon: FiTruck, t: "Add Your Vehicle", d: "Pick your brand, model and fuel type. We tailor services to your exact car." },
  { icon: FiPackage, t: "Pick Services", d: "Browse curated packages with transparent prices. Add multiple to your cart." },
  { icon: FiMapPin, t: "Choose Location", d: "Tell us where the service is needed — at home or nearest verified garage." },
  { icon: FiCheckCircle, t: "Auto-Assign Garage", d: "We instantly assign the best garage based on rating, distance & quality score." },
  { icon: FiNavigation, t: "Live Tracking", d: "Track every step — from mechanic assignment to quality check." },
  { icon: FiShield, t: "Warranty Activated", d: "Get a 30-day service warranty card right on your dashboard." },
];

export default function HowItWorks() {
  return (
    <div className="container-x py-16">
      <div className="text-center max-w-2xl mx-auto">
        <span className="chip-brand">How Rovauto Works</span>
        <h1 className="text-4xl sm:text-5xl font-bold mt-4">Service your car in 6 effortless steps</h1>
        <p className="text-muted mt-3">Designed like Hoora & Swiggy, built for Indian car owners.</p>
      </div>
      <div className="mt-14 grid md:grid-cols-2 gap-5">
        {STEPS.map((s, i) => (
          <motion.div key={s.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
            className="card-soft p-6 flex gap-4">
            <div className="grid place-items-center h-14 w-14 rounded-2xl bg-brand text-ink shrink-0"><s.icon className="text-2xl" /></div>
            <div>
              <div className="text-xs font-bold text-muted">STEP {i + 1}</div>
              <h3 className="font-semibold text-xl mt-1">{s.t}</h3>
              <p className="text-muted mt-1">{s.d}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-14 text-center"><Link to="/booking/vehicle" className="btn-primary px-6 py-3.5">Start Booking</Link></div>
    </div>
  );
}
