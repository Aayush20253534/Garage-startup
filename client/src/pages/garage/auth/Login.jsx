import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiEyeOff,
  FiHome,
  FiLock,
  FiMapPin,
  FiShield,
  FiTruck,
  FiUser,
} from "react-icons/fi";

import { garageApi } from "@/api/garage";
import GaragePwaInstall from "@/components/garage/GaragePwaInstall";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import { useApp } from "@/hooks/useApp";

export default function GarageLogin() {
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accountRole, setAccountRole] = useState(() =>
    searchParams.get("role") === "GARAGE_CONTROLLER"
      ? "GARAGE_CONTROLLER"
      : "GARAGE_OWNER",
  );

  const navigate = useNavigate();
  const location = useLocation();
  const { loginGarage } = useApp();

  const returnTo = location.state?.from
    ? `${location.state.from.pathname || "/garage"}${
        location.state.from.search || ""
      }`
    : "/garage";

  const isReturningToRequest = useMemo(
    () =>
      returnTo.startsWith("/garage/magic/") ||
      returnTo.startsWith("/garage/requests/"),
    [returnTo],
  );

  const controllerReturnTo = useMemo(() => {
    const allowed =
      returnTo === "/garage" ||
      returnTo === "/garage/bookings" ||
      returnTo.startsWith("/garage/bookings/") ||
      returnTo === "/garage/wallet" ||
      returnTo.startsWith("/garage/magic/") ||
      returnTo.startsWith("/garage/requests/");
    return allowed ? returnTo : "/garage";
  }, [returnTo]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await garageApi.login(identifier.trim(), password, accountRole);
      const garage = result?.garage;

      if (!garage) {
        throw new Error("Invalid garage login response");
      }

      loginGarage(garage);

      if (result?.user?.mustChangePassword || garage.mustChangePassword) {
        navigate("/garage/first-login", {
          replace: true,
          state: location.state,
        });
        return;
      }

      navigate(accountRole === "GARAGE_CONTROLLER" ? controllerReturnTo : returnTo, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Unable to sign in",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <CustomerLoginLoader
        visible={loading}
        eyebrow="GARAGE PORTAL"
        title={
          isReturningToRequest
            ? "Opening your booking request"
            : "Signing in to your garage"
        }
        message={
          isReturningToRequest
            ? `Verifying the ${accountRole === "GARAGE_CONTROLLER" ? "controller" : "owner"} account before returning to the customer request.`
            : `Verifying your ${accountRole === "GARAGE_CONTROLLER" ? "controller workspace" : "approved garage workspace"}.`
        }
      />
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-4 sm:px-6 sm:py-8 lg:py-10">
      <div className="mx-auto grid w-full max-w-5xl items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.65fr)] lg:items-center">
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <header className="border-b border-line bg-slate-50/80 px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
                {isReturningToRequest ? (
                  <FiTruck className="h-5 w-5" />
                ) : (
                  <FiHome className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                  Rovauto garage portal
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                  {isReturningToRequest
                    ? "Sign in to open the request"
                    : accountRole === "GARAGE_CONTROLLER" ? "Garage controller login" : "Garage owner login"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {isReturningToRequest
                    ? "After login, you will return directly to the booking received on WhatsApp."
                    : accountRole === "GARAGE_CONTROLLER"
                      ? "Use the phone or email and password created for you by the garage owner or Rovauto admin."
                      : "Use the owner account approved for your garage workspace."}
                </p>
              </div>
            </div>
          </header>

          <div className="space-y-5 p-5 sm:p-7">
            {isReturningToRequest && (
              <dl className="overflow-hidden rounded-xl border border-brand/30 bg-brand/10 divide-y divide-brand/20">
                <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="font-semibold text-muted">Opening</dt>
                  <dd className="text-right font-extrabold text-ink">
                    Booking request
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="font-semibold text-muted">After sign-in</dt>
                  <dd className="text-right font-extrabold text-ink">
                    Return automatically
                  </dd>
                </div>
              </dl>
            )}

            {location.state?.passwordChanged && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                <FiCheckCircle className="h-4 w-4 shrink-0" />
                <span>Password secured. Sign in with your new password.</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Garage account type">
                {[["GARAGE_OWNER", "Garage owner"], ["GARAGE_CONTROLLER", "Controller / staff"]].map(([value, label]) => <button key={value} type="button" onClick={() => { setAccountRole(value); setError(""); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${accountRole === value ? "bg-white text-ink shadow-sm" : "text-muted"}`}>{label}</button>)}
              </div>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Email or phone
                <div className="relative">
                  <FiUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Email or mobile number"
                    autoComplete="username"
                    inputMode="email"
                    className="h-12 min-w-0 w-full rounded-xl border border-line bg-white pl-11 pr-3 text-[13px] outline-none transition placeholder:text-xs focus:border-ink focus:ring-2 focus:ring-slate-100 sm:pr-4 sm:text-sm sm:placeholder:text-sm"
                    required
                  />
                </div>
              </label>

              <label className="grid gap-2 text-sm font-bold text-ink">
                Password
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-12 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <FiEyeOff className="h-4 w-4" />
                    ) : (
                      <FiEye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between gap-3 text-sm">
                <Link
                  to={`/garage/forgot-password?role=${accountRole}`}
                  state={location.state}
                  className="font-semibold text-muted transition hover:text-ink"
                >
                  Forgot password?
                </Link>
                {!isReturningToRequest && (
                  <Link
                    to="/garage/onboarding"
                    className="font-semibold text-ink transition hover:text-brand-dark"
                  >
                    Apply as garage
                  </Link>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-extrabold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  "Signing in..."
                ) : (
                  <>
                    {isReturningToRequest ? "Sign in and open request" : "Sign in"}
                    <FiArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-xs leading-5 text-muted">
              {accountRole === "GARAGE_CONTROLLER"
                ? "Controller accounts are created garage-wise by the garage owner or Rovauto admin. They cannot access another garage."
                : "Garage owner access is available after Rovauto approves the partner application."}
            </div>
          </div>
        </section>

        <div className="lg:hidden">
          <GaragePwaInstall compact />
        </div>

        <aside className="hidden gap-5 lg:grid">
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
    </>
  );
}
