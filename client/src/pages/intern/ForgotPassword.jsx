import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiKey,
  FiMail,
  FiRefreshCw,
} from "react-icons/fi";
import { internApi } from "@/api/intern";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import StaffBrand from "@/components/staff/StaffBrand";

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Use at least 8 characters with uppercase, lowercase, number and symbol.";

export default function InternForgotPassword() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const requestOtp = async ({ isResend = false } = {}) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      throw new Error("Enter the registered intern email address");
    }

    await internApi.requestPasswordReset(cleanEmail);
    setEmail(cleanEmail);
    setOtp("");
    setStep("reset");
    setNotice(
      isResend
        ? "A new password reset OTP was sent."
        : "If an active intern account exists, a reset OTP was sent.",
    );
  };

  const handleRequest = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      await requestOtp();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to request a password reset",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      await requestOtp({ isResend: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Unable to resend OTP",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the complete 6-digit OTP");
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      setError(PASSWORD_MESSAGE);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await internApi.resetPassword({ email, otp, newPassword });
      setStep("success");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to reset password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:py-10">
      <CustomerLoginLoader
        visible={loading}
        eyebrow="INTERN RECOVERY"
        title={step === "email" ? "Sending reset OTP" : "Securing your account"}
        message="Verifying the registered intern email and protecting your workspace."
      />

      <div className="mx-auto w-full max-w-lg">
        <Link
          to="/intern/login"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <FiArrowLeft /> Back to intern login
        </Link>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7">
          <div className="border-b border-line pb-5">
            <StaffBrand portal="intern" />
          </div>

          {step === "success" ? (
            <div className="py-7 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime-100 text-3xl text-lime-700">
                <FiCheckCircle />
              </span>
              <h1 className="mt-5 text-2xl font-extrabold text-ink">
                Password updated
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
                Your existing intern sessions were closed. Sign in again with
                the new password and email OTP.
              </p>
              <Link
                to="/intern/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink-2"
              >
                Return to intern login
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-6 flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
                  {step === "email" ? <FiMail /> : <FiKey />}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    Secure recovery
                  </p>
                  <h1 className="mt-1 text-2xl font-extrabold text-ink">
                    {step === "email" ? "Forgot password?" : "Set a new password"}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {step === "email"
                      ? "Enter the email assigned to your intern account."
                      : `Enter the OTP sent for ${email}.`}
                  </p>
                </div>
              </div>

              {error && (
                <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              {notice && (
                <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  {notice}
                </p>
              )}

              {step === "email" ? (
                <form onSubmit={handleRequest} className="mt-6 grid gap-4">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    Registered intern email
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="intern@rovauto.com"
                      className="h-12 rounded-xl border border-line px-4 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink-2 disabled:opacity-60"
                  >
                    Send reset OTP
                  </button>
                </form>
              ) : (
                <form onSubmit={handleReset} className="mt-6 grid gap-4">
                  <label className="grid gap-2 text-sm font-bold text-ink">
                    6-digit OTP
                    <input
                      required
                      inputMode="numeric"
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      autoComplete="one-time-code"
                      placeholder="000000"
                      className="h-12 rounded-xl border border-line px-4 text-center text-lg font-bold tracking-[0.35em] outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                    />
                  </label>

                  {["New password", "Confirm password"].map((label) => {
                    const isConfirmation = label.startsWith("Confirm");
                    const value = isConfirmation ? confirmPassword : newPassword;
                    const setValue = isConfirmation
                      ? setConfirmPassword
                      : setNewPassword;

                    return (
                      <label key={label} className="grid gap-2 text-sm font-bold text-ink">
                        {label}
                        <div className="relative">
                          <input
                            required
                            type={showPassword ? "text" : "password"}
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            autoComplete="new-password"
                            placeholder={label}
                            className="h-12 w-full rounded-xl border border-line px-4 pr-12 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((visible) => !visible)}
                            aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                            className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-slate-50 hover:text-ink"
                          >
                            {showPassword ? <FiEyeOff /> : <FiEye />}
                          </button>
                        </div>
                      </label>
                    );
                  })}

                  <p className="text-xs leading-5 text-muted">{PASSWORD_MESSAGE}</p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink-2 disabled:opacity-60"
                  >
                    Reset password
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setError("");
                        setNotice("");
                      }}
                      className="font-semibold text-muted transition hover:text-ink"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading}
                      className="inline-flex items-center gap-2 font-semibold text-ink disabled:opacity-60"
                    >
                      <FiRefreshCw /> Resend OTP
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
