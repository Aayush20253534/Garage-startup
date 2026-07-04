import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSend,
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

const inputClass =
  "h-10 rounded-lg border border-line bg-bg-soft px-3 text-sm text-muted outline-none";

const textareaClass =
  "min-h-[120px] resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none transition focus:border-ink";

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

  const change = (event) => {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

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

  const contactCards = [
    {
      icon: FiPhone,
      title: "Call us",
      detail: SUPPORT_PHONE_DISPLAY,
      sub: "Mon-Sun, 8 AM-10 PM",
    },
    {
      icon: FiMail,
      title: "Email us",
      detail: "rovauto.offical@gmail.com",
      sub: "Replies within 2 hours",
    },
    {
      icon: FiMapPin,
      title: "Visit HQ",
      detail: "Sector 62, Noida",
      sub: "Uttar Pradesh, India",
    },
  ];

  return (
    <div className="container-x py-10">
      <div className="mx-auto max-w-6xl space-y-8 overflow-x-hidden">
        <section className="text-center">
          <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink">
            Contact
          </span>

          <h1 className="mt-4 text-3xl font-bold text-ink sm:text-5xl">
            We're here to help.
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted sm:text-base">
            Questions, booking issues, garage concerns, or payment problems.
            Send the message here so support can untangle the machinery.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {contactCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="card-soft rounded-2xl p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-black">
                  <Icon />
                </div>

                <h3 className="mt-4 font-bold text-ink">{card.title}</h3>

                <div className="mt-1 text-sm font-semibold text-ink">
                  {card.detail}
                </div>

                <div className="mt-1 text-xs text-muted">{card.sub}</div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="card-soft rounded-2xl p-4 shadow-sm sm:p-5">
            {sent ? (
              <div className="py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-black">
                  <FiCheckCircle />
                </div>

                <h3 className="mt-4 text-xl font-bold text-ink">
                  Thanks! We'll get back soon.
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Your message reached support. A rare win for forms.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setError("");
                  }}
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-4">
                <div>
                  <h3 className="text-xl font-bold text-ink">
                    Send us a message
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Your name and email are filled from your profile.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <FiAlertCircle className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    required
                    name="name"
                    value={form.name}
                    readOnly
                    placeholder={
                      profileLoading ? "Loading name..." : "Your name"
                    }
                    className={inputClass}
                  />

                  <input
                    required
                    name="email"
                    value={form.email}
                    readOnly
                    type="email"
                    placeholder={profileLoading ? "Loading email..." : "Email"}
                    className={inputClass}
                  />
                </div>

                <textarea
                  required
                  name="message"
                  value={form.message}
                  onChange={change}
                  rows={5}
                  placeholder="How can we help?"
                  className={textareaClass}
                />

                <div className="flex justify-end">
                  <button
                    disabled={
                      loading || profileLoading || !form.name || !form.email
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiSend />
                    {loading ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div>
            <div className="mb-3">
              <h3 className="text-xl font-bold text-ink">FAQs</h3>
              <p className="mt-1 text-sm text-muted">
                Quick answers before humanity files another ticket.
              </p>
            </div>

            <div className="grid gap-3">
              {FAQS.map(([question, answer], index) => (
                <div
                  key={question}
                  className="card-soft overflow-hidden rounded-2xl shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(open === index ? -1 : index)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <span className="font-semibold text-ink">{question}</span>

                    <FiChevronDown
                      className={[
                        "shrink-0 text-muted transition",
                        open === index ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>

                  {open === index && (
                    <div className="border-t border-line px-4 py-3 text-sm text-muted">
                      {answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}