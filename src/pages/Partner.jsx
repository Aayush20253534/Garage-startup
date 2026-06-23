import { useState } from "react";
import { FiCheckCircle } from "react-icons/fi";

export default function Partner() {
  const [sent, setSent] = useState(false);
  return (
    <div className="container-x py-16 grid lg:grid-cols-2 gap-12">
      <div>
        <span className="chip-brand">Partner With Us</span>
        <h1 className="text-4xl sm:text-5xl font-bold mt-4">Grow your garage with verified leads.</h1>
        <p className="text-muted mt-4 text-lg">Join 8,000+ garages already growing with Rovauto. Get bookings via WhatsApp, manage jobs from a simple portal, and get paid faster.</p>
        <ul className="mt-8 grid gap-3 text-sm">
          {["Verified, paid leads via WhatsApp magic links", "Zero app required to start", "Transparent wallet & instant payouts", "Reputation-based ranking, quality bonuses", "Insurance & spare-parts assistance"].map((x) => (
            <li key={x} className="flex items-center gap-3"><FiCheckCircle className="text-brand-dark text-lg" /> {x}</li>
          ))}
        </ul>
      </div>
      <div className="card-soft p-7">
        {sent ? (
          <div className="text-center py-20">
            <div className="h-16 w-16 grid place-items-center bg-brand rounded-full mx-auto"><FiCheckCircle className="text-3xl" /></div>
            <h3 className="text-2xl font-bold mt-4">Application received!</h3>
            <p className="text-muted mt-2">Our partner team will reach you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="grid gap-4">
            <h3 className="text-2xl font-bold">Apply to become a partner</h3>
            {[
              ["Garage Name", "text", "Speed Motors Workshop"],
              ["Owner Name", "text", "Mr. Sharma"],
              ["Phone", "tel", "+91 90000 00000"],
              ["City / Area", "text", "Indirapuram, Ghaziabad"],
            ].map(([l, t, p]) => (
              <label key={l} className="grid gap-1.5 text-sm">
                <span className="font-medium">{l}</span>
                <input required type={t} placeholder={p} className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Services offered</span>
              <textarea rows={3} className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" placeholder="General service, denting, AC..." />
            </label>
            <button className="btn-primary">Submit Application</button>
          </form>
        )}
      </div>
    </div>
  );
}
