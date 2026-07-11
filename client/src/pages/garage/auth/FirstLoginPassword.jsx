import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiLock,
  FiShield,
} from "react-icons/fi";

import { garageApi } from "@/api/garage";
import Logo from "@/components/common/Logo";
import { useApp } from "@/hooks/useApp";

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function GarageFirstLoginPassword() {
  const { garage, authLoading, logoutGarage } = useApp();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-line bg-white px-6 py-5 text-sm font-semibold text-muted shadow-soft">
          Checking your garage account...
        </div>
      </main>
    );
  }

  if (!garage) {
    return <Navigate to="/garage/login" replace />;
  }

  if (!garage.mustChangePassword) {
    return <Navigate to="/garage" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!PASSWORD_REGEX.test(newPassword)) {
      setError(
        "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Choose a new password different from your temporary password.");
      return;
    }

    setLoading(true);

    try {
      await garageApi.changePassword(currentPassword, newPassword);
      await logoutGarage();
      navigate("/garage/login", {
        replace: true,
        state: {
          passwordChanged: true,
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.68fr)]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7 lg:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
            <Logo className="h-14 w-auto" />
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
              First login
            </span>
          </div>

          <div className="mt-7 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
              <FiLock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Step 1 of 1
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                Create your private password
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Your phone number is only the temporary approval password. Set a
                private password before entering the garage portal.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Temporary password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter the phone-number password"
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                className="h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                className="h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-extrabold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                "Securing account..."
              ) : (
                <>
                  Save and continue <FiArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </section>

        <aside className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <FiShield className="h-4 w-4 text-brand-dark" />
            Why this is required
          </div>
          <div className="mt-5 grid gap-3">
            {[
              "The temporary phone-number password stops working as your portal password.",
              "All garage dashboard routes stay locked until this step is complete.",
              "After saving, sign in once with your new private password.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-line bg-slate-50 p-3"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-brand-dark shadow-sm">
                  <FiCheck className="h-4 w-4" />
                </span>
                <p className="text-sm leading-6 text-muted">{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
