import { useEffect, useState } from "react";
import {
  FiMail,
  FiPhone,
  FiMapPin,
  FiCheckCircle,
  FiChevronDown,
} from "react-icons/fi";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";

const FAQS = [
  [
    "How does Rovauto pricing work?",
    "Every service shows transparent pricing upfront. You pay a small booking fee online and the rest at the garage after service completion.",
  ],
  [
    "Is there a warranty?",
    "Yes. Every service comes with a 30-day Rovauto warranty. If something goes wrong, we help resolve the issue.",
  ],
  [
    "Can I track my booking?",
    "Absolutely. You can track live status from assignment to completion.",
  ],
  [
    "What if I'm not happy?",
    "You can rate the garage and raise a complaint. Our support team will review it.",
  ],
];

const SUPPORT_PHONE_DISPLAY = "+91 98993 19913";

export default function Contact() {
  const { user, fetchProfile } = useApp();

  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(0);

  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fillUser = (data) => {
    setForm((prev) => ({
      ...prev,
      name: data?.name || "",
      email: data?.email || "",
    }));
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        setProfileLoading(true);

        if (user?.name || user?.email) {
          fillUser(user);
          return;
        }

        const profile = await fetchProfile?.();
        fillUser(profile);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load user details");
      } finally {
        setProfileLoading(false);
      }
    };

    loadUser();
  }, [user, fetchProfile]);

  const change = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      await api.post("/contact", {
        name: form.name,
        email: form.email,
        message: form.message,
      });

      setSent(true);
      setForm((prev) => ({ ...prev, message: "" }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x py-16">
      <div className="text-center max-w-2xl mx-auto">
        <span className="chip-brand">Contact</span>

        <h1 className="text-4xl sm:text-5xl font-bold mt-4">
          We're here to help.
        </h1>
      </div>

      <div className="mt-12 grid lg:grid-cols-3 gap-5">
        {[
          {
            icon: FiPhone,
            t: "Call us",
            d: SUPPORT_PHONE_DISPLAY,
            sub: "Mon–Sun, 8 AM–10 PM",
          },
          {
            icon: FiMail,
            t: "Email us",
            d: "rovauto.offical@gmail.com",
            sub: "Replies within 2 hours",
          },
          {
            icon: FiMapPin,
            t: "Visit HQ",
            d: "Sector 62, Noida",
            sub: "Uttar Pradesh, India",
          },
        ].map((c) => (
          <div key={c.t} className="card-soft p-6">
            <div className="h-12 w-12 grid place-items-center rounded-2xl bg-brand">
              <c.icon />
            </div>

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
              <div className="h-16 w-16 grid place-items-center bg-brand rounded-full mx-auto">
                <FiCheckCircle className="text-3xl" />
              </div>

              <h3 className="text-2xl font-bold mt-4">
                Thanks! We'll get back soon.
              </h3>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError("");
                }}
                className="btn-ghost mt-5"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <h3 className="text-2xl font-bold">Send us a message</h3>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <input
                required
                name="name"
                value={form.name}
                readOnly
                placeholder={profileLoading ? "Loading name..." : "Your name"}
                className="px-4 py-3 rounded-xl border border-line bg-bg-soft text-muted outline-none cursor-not-allowed"
              />

              <input
                required
                name="email"
                value={form.email}
                readOnly
                type="email"
                placeholder={profileLoading ? "Loading email..." : "Email"}
                className="px-4 py-3 rounded-xl border border-line bg-bg-soft text-muted outline-none cursor-not-allowed"
              />

              <textarea
                required
                name="message"
                value={form.message}
                onChange={change}
                rows={4}
                placeholder="How can we help?"
                className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
              />

              <button
                disabled={
                  loading || profileLoading || !form.name || !form.email
                }
                className="btn-primary disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </div>

        <div>
          <h3 className="text-2xl font-bold mb-4">FAQs</h3>

          <div className="grid gap-3">
            {FAQS.map(([q, a], i) => (
              <div key={q} className="card-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-medium">{q}</span>

                  <FiChevronDown
                    className={`transition ${open === i ? "rotate-180" : ""}`}
                  />
                </button>

                {open === i && (
                  <div className="px-5 pb-5 text-muted text-sm">{a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
