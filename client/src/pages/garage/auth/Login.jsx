import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiHome,
  FiLock,
  FiMapPin,
  FiShield,
  FiUser,
} from "react-icons/fi";

import { garageApi } from "@/api/garage";
import Logo from "@/components/common/Logo";
import GaragePwaInstall from "@/components/garage/GaragePwaInstall";
import { useApp } from "@/hooks/useApp";

export default function GarageLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const { loginGarage } = useApp();

  const returnTo = location.state?.from
    ? `${location.state.from.pathname || "/garage"}${
        location.state.from.search || ""
      }`
    : "/garage";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await garageApi.login(identifier.trim(), password);
      const garage = result?.garage;

      if (!garage) {
        throw new Error("Invalid garage login response");
      }

      loginGarage(garage);

      if (result?.user?.mustChangePassword || garage.mustChangePassword) {
        navigate("/garage/first-login", { replace: true });
        return;
      }

      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Unable to sign in",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.72fr)]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7 lg:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
            <Logo className="h-14 w-auto" />
            <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted sm:inline-flex">
              Garage portal
            </span>
          </div>

          <div className="mt-7 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
              <FiHome className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Partner workspace
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                Garage login
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Sign in with the garage owner account approved by Rovauto.
              </p>
            </div>
          </div>

          {location.state?.passwordChanged && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <FiCheckCircle className="h-4 w-4 shrink-0" />
              <span>Password secured. Sign in with your new password.</span>
            </div>
          )}

          {error && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Email or phone
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="garage@email.com"
                  autoComplete="username"
                  className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                  required
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink">
              Password
              <div className="relative">
                <FiLock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                  required
                />
              </div>
            </label>

            <div className="flex items-center justify-between gap-3 text-sm">
              <Link
                to="/garage/forgot-password"
                className="font-semibold text-muted transition hover:text-ink"
              >
                Forgot password?
              </Link>
              <Link
                to="/garage/onboarding"
                className="font-semibold text-ink transition hover:text-brand-dark"
              >
                Apply as garage
              </Link>
            </div>

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
            Garage access opens after application approval. Use the same email
            or phone linked with the owner account.
          </p>
        </section>

        <aside className="grid gap-5">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <FiShield className="h-4 w-4 text-brand-dark" />
              Verified garage workspace
            </div>

            <div className="mt-5 grid gap-3">
              {[
                [FiClock, "Live requests", "Accept nearby service bookings"],
                [FiMapPin, "Route support", "Navigate to customer locations"],
                [FiCheckCircle, "Service flow", "Receive, repair, and complete"],
              ].map(([Icon, title, copy]) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-xl border border-line bg-slate-50 p-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand-dark shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <GaragePwaInstall compact />
        </aside>
      </div>
    </main>
  );
}
