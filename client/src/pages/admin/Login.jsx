import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StaffBrand from "@/components/staff/StaffBrand";
import AdminPwaInstall from "@/components/staff/AdminPwaInstall";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import {
  FiArrowRight,
  FiCheckCircle,
  FiLock,
  FiShield,
  FiUser,
} from "react-icons/fi";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await adminApi.login(
        form.identifier.trim(),
        form.password,
      );

      const adminUser = result?.user;

      if (!adminUser || adminUser.role !== "ADMIN") {
        throw new Error("Invalid admin login response");
      }

      // The backend stores the JWT in an HttpOnly cookie.
      login(adminUser);
      navigate(state?.from?.pathname || "/admin", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Admin login failed",
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
            <StaffBrand portal="admin" />
            <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted sm:inline-flex">
              Staff only
            </span>
          </div>

          <div className="mt-7 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
              <FiShield className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Platform operations
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                Admin login
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Use the admin account created for Rovauto operations.
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
              Email or phone
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  required
                  value={form.identifier}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      identifier: event.target.value,
                    }))
                  }
                  placeholder="admin@rovauto.com"
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
                  value={form.password}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                  type="password"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-extrabold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                "Logging in..."
              ) : (
                <>
                  Login <FiArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </section>

        <aside className="grid gap-5">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Secure access
            </p>
            <div className="mt-5 grid gap-3">
              {[
                "Manage garages, services, and staff accounts",
                "Review bookings, payments, and support tickets",
                "Use dangerous actions only from trusted devices",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-ink">
                  <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <AdminPwaInstall compact />
        </aside>
      </div>
    </main>
  );
}
