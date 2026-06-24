import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiCheckCircle, FiShield, FiClock, FiTool, FiNavigation, FiStar, FiArrowRight } from "react-icons/fi";
import { SERVICE_CATEGORIES, SERVICES } from "@/data/services";
import homepageHero from "@/assets/Rovauto_home.png";

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
      <section className="relative min-h-[88vh] overflow-hidden flex items-center">
        <div className="absolute inset-0 -z-10">
          <img
            alt="Rovauto workshop"
            src={homepageHero}
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>

        <div className="container-x relative z-10 py-20 lg:py-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl text-white">
            <span className="chip-brand mb-5 bg-white/10 text-white border-white/10 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" /> New in Delhi NCR · Mumbai · Bengaluru
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
              India&apos;s Trusted <span className="relative inline-block">
                Vehicle Service
              </span> Platform
            </h1>
            <p className="mt-6 text-lg text-white/85 max-w-xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
              Book trusted vehicle services from verified garages with transparent pricing, live tracking and a 30-day service warranty.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/booking/vehicle" className="btn-primary text-base px-6 py-3.5 shadow-2xl">
                Book Service <FiArrowRight />
              </Link>
              <Link to="/partner" className="btn-ghost text-base px-6 py-3.5 border-white/20 bg-white/10 text-white hover:border-white hover:bg-white/10">
                Become a Partner
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST.map((t) => (
                <div key={t.label} className="flex items-center gap-2 text-sm text-white/85">
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-white/15 text-white backdrop-blur">
                    <t.icon className="text-xs" />
                  </span>
                  {t.label}
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                {['A', 'R', 'S', 'P'].map((c, i) => (
                  <span key={i} className="grid place-items-center h-9 w-9 rounded-full bg-white text-ink text-xs font-bold border-2 border-black/10">{c}</span>
                ))}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1 text-amber-300">
                  <FiStar fill="currentColor" /><FiStar fill="currentColor" /><FiStar fill="currentColor" /><FiStar fill="currentColor" /><FiStar fill="currentColor" />
                </div>
                <div className="text-white/70 text-xs">Trusted by 50,000+ vehicle owners</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">Vehicle services at your doorstep</h2>
            <p className="text-muted mt-2">Verified mechanics · Transparent pricing · 30-day warranty</p>
          </div>
          <Link to="/services" className="btn-ghost">View all <FiArrowRight /></Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {SERVICE_CATEGORIES.slice(0, 8).map((c) => (
            <Link to={c.isSos ? "/sos" : `/services/${c.id}`} key={c.id} className="group">
              <div className="rounded-3xl bg-white p-5 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="text-lg font-bold mb-4">{c.name}</div>
                <div className="h-32 w-full rounded-2xl overflow-hidden">
                  <img src={c.image} alt={c.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

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
              <motion.div key={t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="card-soft p-6">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-ink text-brand font-bold">{i + 1}</div>
                <h3 className="mt-4 font-semibold text-lg">{t}</h3>
                <p className="text-sm text-muted mt-1">{d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-20">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Popular this week</h2>
          <Link to="/services" className="btn-ghost">Browse all services <FiArrowRight /></Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.slice(0, 6).map((s) => (
            <Link to="/booking/services" key={s.id} className="card-soft p-5 hover:-translate-y-1 transition group">
              {/* Service Image */}
              {s.image && (
                <div className="h-40 w-full rounded-2xl overflow-hidden mb-4">
                  <img src={s.image} alt={s.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              )}
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

      <section className="container-x pb-20">
        <div className="rounded-3xl bg-ink text-white overflow-hidden relative p-8 sm:p-14">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-5xl font-bold leading-tight">Own a garage? <br /> Grow with Rovauto.</h2>
              <p className="text-white/70 mt-4 max-w-md">Get verified leads via WhatsApp, manage jobs, and grow revenue. No app required to start.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/partner" className="btn-primary">Become a Partner</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[['8K+', 'Garages'], ['50K+', 'Customers'], ['4.8★', 'Avg rating']].map(([n, l]) => (
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
