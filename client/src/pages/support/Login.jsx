import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBell,
  FiHeadphones,
  FiLock,
  FiMail,
  FiMessageSquare,
  FiShield,
} from "react-icons/fi";

import SupportBrand from "@/components/support/SupportBrand";
import SupportPwaInstall from "@/components/support/SupportPwaInstall";
import { customerSupportApi } from "@/api/customerSupport";
import { useApp } from "@/hooks/useApp";

export default function CustomerSupportLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await customerSupportApi.login(
        form.email.trim().toLowerCase(),
        form.password,
      );

      if (!result?.user || result.user.role !== "CUSTOMER_SUPPORT") {
        throw new Error("Invalid customer support login response");
      }

      login(result.user);
      navigate(state?.from?.pathname || "/support", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Customer support login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-8 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
          <SupportBrand />
          <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-600 sm:inline-flex">
            Staff only
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.7fr)] lg:items-start">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7 lg:p-8">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
                <FiHeadphones className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                  Support console
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                  Sign in to support
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  Use the separate support account created by an administrator.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Support email
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="support@rovauto.com"
                    autoComplete="username"
                    className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </label>

              <label className="grid gap-2 text-sm font-bold text-ink">
                Password
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-extrabold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  "Signing in..."
                ) : (
                  <>
                    Sign in <FiArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
              Support accounts have no registration or forgot-password flow.
              Contact an admin to reset or change the password.
            </p>
          </section>

          <div className="grid gap-5">
            <aside className="rounded-2xl bg-ink p-5 text-white shadow-soft sm:p-7">
              <div className="flex items-center gap-2 text-sm font-bold text-brand">
                <FiShield className="h-4 w-4" /> Restricted workspace
              </div>
              <h2 className="mt-5 text-2xl font-extrabold leading-tight">
                Customer support desk
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Ticket handling, received alerts, and customer communication
                remain inside this dedicated portal.
              </p>

              <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {[
                  [FiMessageSquare, "Ticket queue", "Claim and reply safely"],
                  [FiBell, "Received alerts", "PWA ticket notifications"],
                  [FiMail, "Customer email", "Recorded outbound messages"],
                ].map(([Icon, title, copy]) => (
                  <div key={title} className="flex items-center gap-3 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-brand">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{title}</p>
                      <p className="text-xs leading-5 text-white/55">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <SupportPwaInstall compact />
          </div>
        </div>
      </div>
    </main>
  );
}
