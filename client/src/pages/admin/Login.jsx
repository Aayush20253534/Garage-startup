import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import StaffBrand from "@/components/staff/StaffBrand";
import AdminPwaInstall from "@/components/staff/AdminPwaInstall";
import StaffEmailOtpLoginForm from "@/components/auth/StaffEmailOtpLoginForm";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import { FiCheckCircle, FiShield, FiUsers } from "react-icons/fi";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();
  const [selectedRole, setSelectedRole] = useState("ADMIN");

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
            <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted sm:inline-flex">Staff only</span>
          </div>

          <div className="mt-7 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white"><FiShield className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Platform operations</p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">Admin login</h1>
              <p className="mt-2 text-sm leading-6 text-muted">Choose the account type assigned to you. Every action is recorded against your individual account.</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-xl bg-bg-soft p-1">
            {[
              { role: "ADMIN", label: "Main admin", icon: FiShield },
              { role: "SUB_ADMIN", label: "Sub admin", icon: FiUsers },
            ].map(({ role, label, icon: Icon }) => (
              <button key={role} type="button" onClick={() => setSelectedRole(role)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold ${selectedRole === role ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                <Icon /> {label}
              </button>
            ))}
          </div>

          <StaffEmailOtpLoginForm
            key={selectedRole}
            identifierLabel={selectedRole === "ADMIN" ? "Main admin ID, email, or phone" : "Sub-admin email"}
            identifierPlaceholder={selectedRole === "ADMIN" ? "admin" : "name@rovauto.com"}
            expectedRole={selectedRole}
            beginLogin={(identifier, password) => adminApi.login(identifier, password, selectedRole)}
            verifyOtp={(challengeId, otp) => adminApi.verifyLoginOtp(challengeId, otp, selectedRole)}
            resendOtp={adminApi.resendLoginOtp}
            onSuccess={handleAuthenticated}
            submitLabel="Continue"
            loaderEyebrow={selectedRole === "ADMIN" ? "MAIN ADMIN ACCESS" : "SUB ADMIN ACCESS"}
          />

          {selectedRole === "SUB_ADMIN" && (
            <div className="mt-4 text-center">
              <Link to="/admin/forgot-password" className="text-sm font-bold text-ink ">Forgot password</Link>
            </div>
          )}
        </section>

        <aside className="grid gap-5">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Secure access</p>
            <div className="mt-5 grid gap-3">
              {["Email OTP is required after the password", "Audit logs identify the exact staff account", "Dangerous and staff-management actions remain main-admin-only"].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-ink"><FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" /><span>{item}</span></div>
              ))}
            </div>
          </div>
          <AdminPwaInstall compact />
        </aside>
      </div>
    </main>
  );
}
