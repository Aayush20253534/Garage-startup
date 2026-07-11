import { useLocation, useNavigate } from "react-router-dom";
import StaffBrand from "@/components/staff/StaffBrand";
import AdminPwaInstall from "@/components/staff/AdminPwaInstall";
import StaffEmailOtpLoginForm from "@/components/auth/StaffEmailOtpLoginForm";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import { FiCheckCircle, FiShield } from "react-icons/fi";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();

  const handleAuthenticated = (adminUser) => {
    login(adminUser);
    navigate(state?.from?.pathname || "/admin", { replace: true });
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

          <StaffEmailOtpLoginForm
            identifierLabel="Admin ID, email, or phone"
            identifierPlaceholder="admin"
            expectedRole="ADMIN"
            beginLogin={adminApi.login}
            verifyOtp={adminApi.verifyLoginOtp}
            resendOtp={adminApi.resendLoginOtp}
            onSuccess={handleAuthenticated}
            submitLabel="Continue"
          />
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
