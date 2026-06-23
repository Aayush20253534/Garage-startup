import { useState } from "react";
import { FiMail, FiPhone, FiMapPin, FiCheckCircle, FiChevronDown } from "react-icons/fi";

const FAQS = [
  ["How does Rovauto pricing work?", "Every service shows transparent pricing upfront. You pay a small ₹49 booking fee online and the rest at the garage after service completion."],
  ["Is there a warranty?", "Yes. Every service comes with a 30-day Rovauto warranty. If something goes wrong, we re-do the service free."],
  ["Can I track my booking?", "Absolutely — live status from assignment to completion, just like Swiggy."],
  ["What if I'm not happy?", "Rate the garage; if rated below 3 stars, our support team calls you within 30 minutes."],
];

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(0);
  return (
    <div className="container-x py-16">
      <div className="text-center max-w-2xl mx-auto">
        <span className="chip-brand">Contact</span>
        <h1 className="text-4xl sm:text-5xl font-bold mt-4">We're here to help.</h1>
      </div>

      <div className="mt-12 grid lg:grid-cols-3 gap-5">
        {[
          { icon: FiPhone, t: "Call us", d: "+91 90000 00000", sub: "Mon–Sun, 8 AM–10 PM" },
          { icon: FiMail, t: "Email us", d: "hello@rovauto.in", sub: "Replies within 2 hours" },
          { icon: FiMapPin, t: "Visit HQ", d: "Sector 62, Noida", sub: "Uttar Pradesh, India" },
        ].map((c) => (
          <div key={c.t} className="card-soft p-6">
            <div className="h-12 w-12 grid place-items-center rounded-2xl bg-brand"><c.icon /></div>
            <h3 className="mt-4 font-semibold text-lg">{c.t}</h3>
            <div className="font-medium mt-1">{c.d}</div>
            <div className="text-sm text-muted">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-12 grid lg:grid-cols-2 gap-8">
        <div className="card-soft p-7">
          {sent ? (
            <div className="text-center py-16">
              <div className="h-16 w-16 grid place-items-center bg-brand rounded-full mx-auto"><FiCheckCircle className="text-3xl" /></div>
              <h3 className="text-2xl font-bold mt-4">Thanks! We'll get back soon.</h3>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="grid gap-4">
              <h3 className="text-2xl font-bold">Send us a message</h3>
              <input required placeholder="Your name" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
              <input required type="email" placeholder="Email" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
              <textarea required rows={4} placeholder="How can we help?" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
              <button className="btn-primary">Send Message</button>
            </form>
          )}
        </div>

        <div>
          <h3 className="text-2xl font-bold mb-4">FAQs</h3>
          <div className="grid gap-3">
            {FAQS.map(([q, a], i) => (
              <div key={q} className="card-soft overflow-hidden">
                <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-medium">{q}</span>
                  <FiChevronDown className={`transition ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i && <div className="px-5 pb-5 text-muted text-sm">{a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
