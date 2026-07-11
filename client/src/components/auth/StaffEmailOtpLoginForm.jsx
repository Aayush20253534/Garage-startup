import { useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiLock,
  FiMail,
  FiRefreshCw,
  FiUser,
} from "react-icons/fi";

export default function StaffEmailOtpLoginForm({
  identifierLabel,
  identifierPlaceholder,
  identifierType = "text",
  expectedRole,
  beginLogin,
  verifyOtp,
  resendOtp,
  onSuccess,
  submitLabel = "Continue",
}) {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (!challenge) {
        const result = await beginLogin(
          form.identifier.trim(),
          form.password,
        );
        setChallenge(result);
        setOtp("");
        setNotice(`A 6-digit code was sent to ${result.maskedEmail}.`);
        return;
      }

      const result = await verifyOtp(challenge.challengeId, otp);
      const authenticatedUser = result?.user;

      if (!authenticatedUser || authenticatedUser.role !== expectedRole) {
        throw new Error("Invalid staff login response");
      }

      onSuccess(authenticatedUser);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to complete staff login",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!challenge?.challengeId) return;

    setResending(true);
    setError("");
    setNotice("");

    try {
      const result = await resendOtp(challenge.challengeId);
      setChallenge(result);
      setOtp("");
      setNotice(`A new code was sent to ${result.maskedEmail}.`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to resend the verification code",
      );
    } finally {
      setResending(false);
    }
  };

  const restart = () => {
    setChallenge(null);
    setOtp("");
    setError("");
    setNotice("");
  };

  return (
    <>
      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        {!challenge ? (
          <>
            <label className="grid gap-2 text-sm font-bold text-ink">
              {identifierLabel}
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  required
                  type={identifierType}
                  value={form.identifier}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      identifier: event.target.value,
                    }))
                  }
                  placeholder={identifierPlaceholder}
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
          </>
        ) : (
          <>
            <div className="rounded-xl border border-line bg-slate-50 p-4 text-sm leading-6 text-muted">
              Password accepted. Enter the code sent to {challenge.maskedEmail}.
              No staff session is created until this code is verified.
            </div>

            <label className="grid gap-2 text-sm font-bold text-ink">
              Email verification code
              <div className="relative">
                <FiMail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  required
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="6-digit OTP"
                  autoComplete="one-time-code"
                  className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm tracking-[0.3em] outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={loading || resending}
          className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-extrabold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            challenge ? "Verifying..." : "Checking password..."
          ) : (
            <>
              {challenge ? "Verify and login" : submitLabel}
              <FiArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {challenge && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={restart}
              disabled={loading || resending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink transition hover:border-ink hover:bg-slate-50 disabled:opacity-60"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink transition hover:border-ink hover:bg-slate-50 disabled:opacity-60"
            >
              <FiRefreshCw className="h-4 w-4" />
              {resending ? "Sending..." : "Resend OTP"}
            </button>
          </div>
        )}
      </form>
    </>
  );
}
