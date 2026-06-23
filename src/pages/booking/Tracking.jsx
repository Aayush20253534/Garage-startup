import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { STATUS_STEPS } from "@/data/garages";
import { FiPhone, FiNavigation, FiMessageCircle, FiCheck, FiStar, FiDownload, FiShield } from "react-icons/fi";

export default function Tracking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STATUS_STEPS.length - 1) return;
    const t = setTimeout(() => setStep(step + 1), 3500);
    return () => clearTimeout(t);
  }, [step]);

  const current = STATUS_STEPS[step];

  return (
    <div className="container-x py-12 grid lg:grid-cols-[1fr_380px] gap-8 max-w-6xl">
      <div>
        <span className="chip-brand">Booking #RV2384</span>
        <h1 className="text-3xl sm:text-4xl font-bold mt-3">{current.label}</h1>
        <p className="text-muted mt-2">{current.desc}</p>

        <div className="mt-8 card-soft p-6">
          <div className="grid gap-5">
            {STATUS_STEPS.map((s, i) => (
              <div key={s.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <motion.div animate={i <= step ? { scale: [0.8, 1.1, 1] } : {}} className={`h-9 w-9 grid place-items-center rounded-full ${i <= step ? "bg-brand text-ink" : "bg-bg-soft text-muted"}`}>
                    {i < step ? <FiCheck /> : i === step ? <span className="h-2 w-2 rounded-full bg-ink animate-ping" /> : i + 1}
                  </motion.div>
                  {i < STATUS_STEPS.length - 1 && <div className={`flex-1 w-px my-1 ${i < step ? "bg-brand" : "bg-line"}`} />}
                </div>
                <div className="pb-6">
                  <div className={`font-semibold ${i <= step ? "text-ink" : "text-muted"}`}>{s.label}</div>
                  <div className="text-sm text-muted">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {step >= 2 && step < 4 && (
          <div className="mt-6 card-soft p-6">
            <h3 className="font-semibold mb-3">Service Checklist</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {["Vehicle inspection", "Engine oil change", "Oil filter", "Wheel balancing", "30-point check", "Test drive"].map((c, i) => (
                <div key={c} className="flex items-center gap-2"><FiCheck className={i < 4 ? "text-brand-dark" : "text-muted"} /> <span className={i < 4 ? "" : "text-muted"}>{c}</span></div>
              ))}
            </div>
            <div className="mt-4 h-2 bg-bg-soft rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: "68%" }} transition={{ duration: 1.5 }} className="h-full bg-brand" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 card-soft p-6">
            <h3 className="font-semibold mb-3">Invoice</h3>
            <div className="grid gap-2 text-sm">
              <Row l="Standard Service Package" r="₹3,500" />
              <Row l="Platform fee" r="₹49" />
              <Row l="Total" r="₹3,549" bold />
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <button className="btn-dark"><FiDownload /> Download Receipt</button>
              <button className="btn-primary"><FiStar /> Rate Garage</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mt-6 rounded-3xl bg-gradient-to-br from-ink to-ink-2 text-white p-6">
            <span className="chip-brand">Active</span>
            <h3 className="text-2xl font-bold mt-3 flex items-center gap-2"><FiShield /> 30-Day Warranty Card</h3>
            <p className="text-white/70 text-sm mt-2">Valid till 22 July 2026. Any issue? Tap Claim from your dashboard.</p>
          </div>
        )}
      </div>

      <aside className="card-soft p-6 lg:sticky lg:top-24 h-fit">
        {step === 0 ? (
          <div className="text-center py-6">
            <div className="h-16 w-16 rounded-full bg-brand mx-auto grid place-items-center animate-pulse"><FiNavigation className="text-2xl" /></div>
            <h3 className="font-semibold mt-4">Finding the best mechanic…</h3>
            <p className="text-xs text-muted mt-2">WhatsApp magic links sent to nearby verified garages.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-14 w-14 rounded-2xl bg-ink text-white text-lg font-bold">RK</span>
              <div>
                <div className="font-semibold">Rajesh Kumar</div>
                <div className="text-xs text-muted">AutoCare Premium</div>
                <div className="flex items-center gap-1 text-amber-500 text-xs mt-1"><FiStar fill="currentColor" /> 4.9 · 12 yrs exp</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <Row l="Phone" r="+91 98xxx xx012" />
              <Row l="ETA" r="25 min" />
              <Row l="OTP" r={<span className="font-mono font-bold tracking-wider">3-8-9-4</span>} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button className="btn-primary !px-2"><FiPhone /></button>
              <button className="btn-dark !px-2"><FiNavigation /></button>
              <button className="btn-ghost !px-2"><FiMessageCircle /></button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
function Row({ l, r, bold }) {
  return <div className={`flex justify-between ${bold ? "font-bold text-base border-t border-line pt-2" : ""}`}><span className="text-muted">{l}</span><span>{r}</span></div>;
}
