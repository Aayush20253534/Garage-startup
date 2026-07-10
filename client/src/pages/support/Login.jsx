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

import Logo from "@/components/common/Logo";
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
    <main className="min-h-[80vh] bg-bg-soft">
      <div className="container-x grid min-h-[80vh] items-center py-8 sm:py-10 lg:py-12">
        <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.7fr)] lg:items-stretch">
          <section className="rounded-lg border border-line bg-white p-5 shadow-soft sm:p-7 lg:p-8">
            <Logo className="h-14 w-auto" />

            <div className="mt-8 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-white">
                <FiHeadphones className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted">
                  Support console
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-normal text-ink sm:text-3xl">
                  Sign in to support
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  Use the support account issued by an admin.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Email
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
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
                    className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-4 text-sm outline-none transition focus:border-ink"
                  />
                </div>
              </label>

              <label className="grid gap-2 text-sm font-bold text-ink">
                Password
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
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
                    className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-4 text-sm outline-none transition focus:border-ink"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-extrabold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
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
              Password recovery is unavailable for support accounts. Contact an
              admin for password changes.
            </p>
          </section>

          <div className="grid gap-5">
            <aside className="rounded-lg bg-ink p-5 text-white shadow-soft sm:p-7 lg:p-8">
              <div className="flex items-center gap-2 text-sm font-bold text-brand">
                <FiShield className="h-4 w-4" />
                Restricted workspace
              </div>

              <h2 className="mt-5 text-2xl font-extrabold leading-tight tracking-normal">
                Customer support desk
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Ticket handling, alerts, and customer communication stay inside
                this console.
              </p>

              <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
                {[
                  [FiMessageSquare, "Ticket queue", "Claim and reply flow"],
                  [FiBell, "Received alerts", "Live support notifications"],
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

            <div>
              <SupportPwaInstall compact />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
