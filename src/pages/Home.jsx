import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiCheckCircle, FiShield, FiClock, FiTool, FiNavigation, FiStar, FiArrowRight, FiPhone, FiTruck } from "react-icons/fi";
import { SERVICE_CATEGORIES, SERVICES } from "@/data/services";
import { LOGO_URL } from "@/data/vehicles";

const TRUST = [
  { icon: FiCheckCircle, label: "Verified Garages" },
  { icon: FiShield, label: "Service Warranty" },
  { icon: FiTool, label: "Transparent Pricing" },
  { icon: FiNavigation, label: "Live Tracking" },
  { icon: FiClock, label: "Fast Booking" },
];

export default function Home() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 h-[40rem] w-[40rem] rounded-full bg-brand/30 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-brand/10 blur-3xl" />
        </div>
        <div className="container-x grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 lg:py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="chip-brand mb-5"><span className="h-1.5 w-1.5 rounded-full bg-ink animate-pulse" /> New in Delhi NCR · Mumbai · Bengaluru</span>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
              India's Trusted <span className="relative inline-block">
                <span className="absolute inset-x-0 bottom-1 h-3 bg-brand -z-10 rounded" />
                Vehicle Service
              </span> Platform
            </h1>
            <p className="mt-6 text-lg text-muted max-w-xl">
              Book trusted vehicle services from verified garages with transparent pricing, live tracking and a 30-day service warranty.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/booking/vehicle" className="btn-primary text-base px-6 py-3.5">Book Service <FiArrowRight /></Link>
              <Link to="/partner" className="btn-dark text-base px-6 py-3.5">Become a Partner</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST.map((t) => (
                <div key={t.label} className="flex items-center gap-2 text-sm text-ink/80">
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-brand text-ink"><t.icon className="text-xs" /></span>
                  {t.label}
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                {["A","R","S","P"].map((c, i) => (
                  <span key={i} className="grid place-items-center h-9 w-9 rounded-full bg-ink text-white text-xs font-bold border-2 border-white">{c}</span>
                ))}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1 text-amber-500"><FiStar fill="currentColor" /><FiStar fill="currentColor" /><FiStar fill="currentColor" /><FiStar fill="currentColor" /><FiStar fill="currentColor" /></div>
                <div className="text-muted text-xs">Trusted by 50,000+ vehicle owners</div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT — Visual */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="relative aspect-[5/6] rounded-3xl overflow-hidden bg-gradient-to-br from-ink to-ink-soft">
              <img alt="Mechanic at work" src="https://images.unsplash.com/photo-1632823471565-1ecdf5c6da77?auto=format&fit=crop&w=1000&q=80" className="w-full h-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
              <div className="absolute top-5 left-5 right-5 flex items-start justify-between">
                <div className="bg-white/95 backdrop-blur rounded-2xl px-3 py-2 flex items-center gap-2 shadow-soft">
                  <img src={LOGO_URL} alt="" className="h-7 w-auto" />
                  <span className="text-xs font-semibold">Verified Garage</span>
                </div>
                <div className="bg-brand text-ink rounded-2xl px-3 py-2 text-xs font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink animate-ping" /> LIVE
                </div>
              </div>
              <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                className="absolute bottom-5 left-5 right-5 card-soft p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted">Booking #RV2384</div>
                    <div className="font-semibold">Standard Service Package</div>
                  </div>
                  <span className="chip-brand">In Progress</span>
                </div>
                <div className="mt-3 h-1.5 bg-bg-soft rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: "68%" }} transition={{ duration: 1.2, delay: 0.7 }} className="h-full bg-brand" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="grid place-items-center h-9 w-9 rounded-full bg-ink text-white text-xs font-bold">RK</span>
                  <div className="text-xs"><div className="font-semibold">Rajesh Kumar</div><div className="text-muted">AutoCare Premium · ETA 25 min</div></div>
                  <button className="ml-auto grid place-items-center h-9 w-9 rounded-full bg-brand text-ink"><FiPhone /></button>
                </div>
              </motion.div>
            </div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}
              className="hidden md:block absolute -left-6 top-1/3 card-soft p-4 w-64">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand"><FiTruck /></span>
                <div className="text-sm"><div className="font-semibold">Hyundai i20 Petrol</div><div className="text-xs text-muted">Last serviced 6,200 km</div></div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CATEGORIES (Urban Company style) */}
      <section className="container-x py-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">Vehicle services at your doorstep</h2>
            <p className="text-muted mt-2">Verified mechanics · Transparent pricing · 30-day warranty</p>
          </div>
          <Link to="/services" className="btn-ghost">View all <FiArrowRight /></Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {SERVICE_CATEGORIES.slice(0, 6).map((c) => (
            <Link to="/booking/services" key={c.id} className="group">
              <div className="aspect-square rounded-3xl bg-bg-soft grid place-items-center transition group-hover:bg-ink group-hover:text-white">
                <c.icon className="text-4xl" style={{ color: c.color }} />
              </div>
              <div className="mt-3 text-sm font-medium text-center">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-bg-soft py-20">
        <div className="container-x">
          <div className="text-center max-w-2xl mx-auto">
            <span className="chip-brand">How it works</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-4">From booking to warranty in 4 steps</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-4 gap-5">
            {[
              ["Add your car", "Tell us your brand, model & fuel."],
              ["Pick a service", "Choose from curated, transparent service packages."],
              ["Auto-assign garage", "We match you with the best nearby verified garage."],
              ["Live tracking", "Track status, talk to mechanic, get warranty."],
            ].map(([t, d], i) => (
              <motion.div key={t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="card-soft p-6">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-ink text-brand font-bold">{i + 1}</div>
                <h3 className="mt-4 font-semibold text-lg">{t}</h3>
                <p className="text-sm text-muted mt-1">{d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* POPULAR SERVICES */}
      <section className="container-x py-20">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Popular this week</h2>
          <Link to="/services" className="btn-ghost">Browse all services <FiArrowRight /></Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.slice(0, 6).map((s) => (
            <Link to="/booking/services" key={s.id} className="card-soft p-5 hover:-translate-y-1 transition group">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="chip">{s.duration}</span>
                  <h3 className="mt-3 font-semibold text-lg group-hover:text-ink">{s.name}</h3>
                  <p className="text-sm text-muted mt-1 line-clamp-2">{s.desc}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">From</div>
                  <div className="font-bold text-xl">₹{s.price}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-500 text-sm"><FiStar fill="currentColor" /> 4.8</div>
                <span className="text-sm font-semibold text-ink/80 group-hover:text-ink">Add <FiArrowRight className="inline" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-x pb-20">
        <div className="rounded-3xl bg-ink text-white overflow-hidden relative p-8 sm:p-14">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-5xl font-bold leading-tight">Own a garage? <br /> Grow with Rovauto.</h2>
              <p className="text-white/70 mt-4 max-w-md">Get verified leads via WhatsApp, manage jobs, and grow revenue. No app required to start.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/partner" className="btn-primary">Become a Partner</Link>
                <Link to="/garage" className="btn-ghost border-white/20 text-white hover:border-white">Garage Portal</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[["8K+", "Garages"], ["50K+", "Customers"], ["4.8★", "Avg rating"]].map(([n, l]) => (
                <div key={l} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                  <div className="text-3xl font-bold text-brand">{n}</div>
                  <div className="text-xs text-white/70 mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
