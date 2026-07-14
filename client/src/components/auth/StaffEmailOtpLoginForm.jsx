import { useEffect, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiLock,
  FiMail,
  FiRefreshCw,
  FiUser,
} from "react-icons/fi";

const OTP_LENGTH = 6;

const createEmptyOtp = () => Array(OTP_LENGTH).fill("");

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
  const otpRefs = useRef([]);
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState(createEmptyOtp);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!challenge) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      otpRefs.current[0]?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [challenge]);

  const handleOtpChange = (index, rawValue) => {
    const digits = String(rawValue || "").replace(/\D/g, "");

    setOtp((current) => {
      const next = [...current];

      if (!digits) {
        next[index] = "";
        return next;
      }

      digits
        .slice(0, OTP_LENGTH - index)
        .split("")
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });

      return next;
    });

    if (digits) {
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpRefs.current[nextIndex]?.focus();
      otpRefs.current[nextIndex]?.select();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();

      setOtp((current) => {
        const next = [...current];

        if (next[index]) {
          next[index] = "";
          return next;
        }

        if (index > 0) {
          next[index - 1] = "";
        }

        return next;
      });

      if (!otp[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      setOtp((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }

    if (event.key.length === 1 && !/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  };

  const handleOtpPaste = (event) => {
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    event.preventDefault();
    if (!digits) return;

    setOtp(
      Array.from(
        { length: OTP_LENGTH },
        (_, index) => digits[index] || "",
      ),
    );

    const focusIndex = Math.min(digits.length, OTP_LENGTH) - 1;
    otpRefs.current[focusIndex]?.focus();
    otpRefs.current[focusIndex]?.select();
  };

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
        setOtp(createEmptyOtp());
        return;
      }

      const submittedOtp = otp.join("");

      if (!/^\d{6}$/.test(submittedOtp)) {
        throw new Error("Enter the complete 6-digit verification code");
      }

      const result = await verifyOtp(
        challenge.challengeId,
        submittedOtp,
      );
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
      setOtp(createEmptyOtp());
      setNotice("A new verification code was sent.");
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
    setOtp(createEmptyOtp());
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
            <fieldset className="grid gap-3">
              <legend className="text-sm font-bold text-ink">
                Email verification code
              </legend>

              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <FiMail className="h-4 w-4 shrink-0" />
                Enter the 6-digit code sent to the staff email.
              </div>

              <div
                className="grid grid-cols-6 gap-2"
                onPaste={handleOtpPaste}
                aria-label="Six-digit email verification code"
              >
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    required
                    type="text"
                    value={digit}
                    onChange={(event) =>
                      handleOtpChange(index, event.target.value)
                    }
                    onKeyDown={(event) =>
                      handleOtpKeyDown(index, event)
                    }
                    onBeforeInput={(event) => {
                      if (event.data && /\D/.test(event.data)) {
                        event.preventDefault();
                      }
                    }}
                    inputMode="numeric"
                    pattern="[0-9]"
                    maxLength={1}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`Verification code digit ${index + 1}`}
                    disabled={loading || resending}
                    className="h-12 min-w-0 rounded-xl border border-line bg-white text-center text-lg font-extrabold text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 sm:h-14 sm:text-xl"
                  />
                ))}
              </div>
            </fieldset>
          </>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            resending ||
            (Boolean(challenge) && otp.some((digit) => !digit))
          }
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
