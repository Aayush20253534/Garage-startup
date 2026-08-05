import { useLocation, useNavigate } from "react-router-dom";
import {
  FiBell,
  FiCheckCircle,
  FiHeadphones,
  FiMail,
  FiMessageSquare,
  FiShield,
} from "react-icons/fi";

import SupportBrand from "@/components/support/SupportBrand";
import SupportPwaInstall from "@/components/support/SupportPwaInstall";
import StaffEmailOtpLoginForm from "@/components/auth/StaffEmailOtpLoginForm";
import { customerSupportApi } from "@/api/customerSupport";
import { useApp } from "@/hooks/useApp";

export default function CustomerSupportLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();
  const handleAuthenticated = (supportUser) => {
    login(supportUser);
    navigate(state?.from?.pathname || "/support", { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-5 2xl:max-w-[84rem] 2xl:gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.72fr)]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7 lg:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
            <SupportBrand />
            <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted sm:inline-flex">
              Staff only
            </span>
          </div>

          <div className="mt-7 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
              <FiHeadphones className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Support console
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                Support login
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Use the separate support account created by an administrator.
              </p>
            </div>
          </div>

          <StaffEmailOtpLoginForm
            identifierLabel="Support email"
            identifierPlaceholder="support@rovauto.com"
            identifierType="email"
            expectedRole="CUSTOMER_SUPPORT"
            beginLogin={customerSupportApi.login}
            verifyOtp={customerSupportApi.verifyLoginOtp}
            resendOtp={customerSupportApi.resendLoginOtp}
            onSuccess={handleAuthenticated}
            submitLabel="Continue"
            loaderEyebrow="SUPPORT ACCESS"
          />

          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
            Support accounts have no registration or forgot-password flow.
            Contact an admin to reset or change the password.
          </p>
        </section>

        <aside className="grid gap-5">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <FiShield className="h-4 w-4 text-brand-dark" />
              Restricted workspace
            </div>

            <div className="mt-5 grid gap-3">
              {[
                [FiMessageSquare, "Ticket queue", "Claim and reply safely"],
                [FiBell, "Received alerts", "PWA ticket notifications"],
                [FiMail, "Customer email", "Recorded outbound messages"],
              ].map(([Icon, title, copy]) => (
                <div key={title} className="flex items-start gap-3 rounded-xl border border-line bg-slate-50 p-3">
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

            <div className="mt-5 flex items-start gap-3 text-sm text-ink">
              <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
              <span className="leading-5">
                Support activity stays in this dedicated portal.
              </span>
            </div>
          </div>

          <SupportPwaInstall compact />
        </aside>
      </div>
    </main>
  );
}
