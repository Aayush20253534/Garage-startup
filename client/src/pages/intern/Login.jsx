import { useLocation, useNavigate } from "react-router-dom";
import StaffBrand from "@/components/staff/StaffBrand";
import InternPwaInstall from "@/components/staff/InternPwaInstall";
import StaffEmailOtpLoginForm from "@/components/auth/StaffEmailOtpLoginForm";
import { internApi } from "@/api/intern";
import { useApp } from "@/hooks/useApp";
import { FiCheckCircle, FiShield } from "react-icons/fi";

export default function InternLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();

  const handleAuthenticated = (internUser) => {
    login(internUser);
    navigate(state?.from?.pathname || "/intern", { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.72fr)]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7 lg:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
            <StaffBrand portal="intern" />
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
                Intern workspace
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                Intern login
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Use the intern ID or email created by an administrator.
              </p>
            </div>
          </div>

          <StaffEmailOtpLoginForm
            identifierLabel="Intern ID or email"
            identifierPlaceholder="intern@rovauto.com"
            expectedRole="INTERN"
            beginLogin={internApi.login}
            verifyOtp={internApi.verifyLoginOtp}
            resendOtp={internApi.resendLoginOtp}
            onSuccess={handleAuthenticated}
            submitLabel="Continue"
            loaderEyebrow="INTERN ACCESS"
            forgotPasswordTo="/intern/forgot-password"
          />

          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
            Intern accounts do not have self-registration. Password recovery
            is available through the registered intern email.
          </p>
        </section>

        <aside className="grid gap-5">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Operations access
            </p>
            <div className="mt-5 grid gap-3">
              {[
                "Open the assigned operations dashboard",
                "Work from the dedicated intern PWA shell",
                "Reset a forgotten password through verified email OTP",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-ink">
                  <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <InternPwaInstall compact />
        </aside>
      </div>
    </main>
  );
}
