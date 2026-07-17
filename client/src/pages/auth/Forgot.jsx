import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiLock,
  FiMail,
} from "react-icons/fi";
import api from "@/api/axios";

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const PASSWORD_MESSAGE =
  "Password must contain uppercase, lowercase, number, symbol and at least 8 characters";

export default function Forgot() {
  const [step, setStep] = useState("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const otpRefs = useRef([]);

  const sendResetOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      throw new Error("Enter a valid registered email address");
    }

    await api.post("/auth/forgot-password", {
      email: cleanEmail,
      role: "CUSTOMER",
    });

    setEmail(cleanEmail);
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendResetOtp();

      setOtp(Array(6).fill(""));
      setStep("reset");
      setMessage("A password reset OTP was sent to your email.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send password reset OTP",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendResetOtp();

      setOtp(Array(6).fill(""));
      setMessage("A new OTP was sent to your email.");
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to resend password reset OTP",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    const finalOtp = otp.join("");

    if (!/^\d{6}$/.test(finalOtp)) {
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
      await api.post("/auth/reset-password", {
        email: email.trim().toLowerCase(),
        otp: finalOtp,
        newPassword,
        role: "CUSTOMER",
      });

      setStep("success");
      setOtp(Array(6).fill(""));
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

  const setOtpDigit = (index, inputValue) => {
    const digit = inputValue.replace(/\D/g, "").slice(0, 1);
    const nextOtp = [...otp];

    nextOtp[index] = digit;
    setOtp(nextOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key !== "Backspace") {
      return;
    }

    if (otp[index]) {
      const nextOtp = [...otp];
      nextOtp[index] = "";
      setOtp(nextOtp);
      return;
    }

    if (index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();

    const pastedOtp = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedOtp) {
      return;
    }

    const nextOtp = Array(6).fill("");

    pastedOtp.split("").forEach((digit, index) => {
      nextOtp[index] = digit;
    });

    setOtp(nextOtp);

    const focusIndex = Math.min(pastedOtp.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const goBackToEmail = () => {
    setStep("email");
    setOtp(Array(6).fill(""));
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-bg-soft">
      <div className="container-x pt-5 pb-3 sm:pt-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
        >
          <FiArrowLeft className="h-4 w-4" />
          <span>Back to Login</span>
        </Link>
      </div>

      <div className="flex justify-center px-4 pt-4 pb-10 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-soft w-full max-w-md p-6 text-center sm:p-8"
        >
          {step === "success" ? (
            <SuccessStep />
          ) : step === "email" ? (
            <EmailStep
              email={email}
              setEmail={setEmail}
              loading={loading}
              error={error}
              onSubmit={handleSendOtp}
            />
          ) : (
            <ResetStep
              email={email}
              otp={otp}
              otpRefs={otpRefs}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              loading={loading}
              error={error}
              message={message}
              setOtpDigit={setOtpDigit}
              handleOtpKeyDown={handleOtpKeyDown}
              handleOtpPaste={handleOtpPaste}
              setNewPassword={setNewPassword}
              setConfirmPassword={setConfirmPassword}
              handleResetPassword={handleResetPassword}
              handleResendOtp={handleResendOtp}
              goBackToEmail={goBackToEmail}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function EmailStep({
  email,
  setEmail,
  loading,
  error,
  onSubmit,
}) {
  return (
    <>
      <FiLock className="mx-auto mb-4 h-12 w-12 text-brand" />

      <h1 className="mb-2 text-3xl font-bold">Forgot Password?</h1>

      <p className="mb-8 text-muted">
        Enter your registered email to receive a password reset OTP.
      </p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-left text-sm font-medium">
            Email
          </label>

          <div className="relative">
            <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-line py-3 pl-11 pr-4 text-left outline-none transition-colors focus:border-ink"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send Reset OTP"}
        </button>
      </form>
    </>
  );
}

function ResetStep({
  email,
  otp,
  otpRefs,
  newPassword,
  confirmPassword,
  loading,
  error,
  message,
  setOtpDigit,
  handleOtpKeyDown,
  handleOtpPaste,
  setNewPassword,
  setConfirmPassword,
  handleResetPassword,
  handleResendOtp,
  goBackToEmail,
}) {
  return (
    <>
      <FiLock className="mx-auto mb-4 h-12 w-12 text-brand" />

      <h1 className="mb-2 text-3xl font-bold">Reset Password</h1>

      <p className="mb-4 text-muted">
        Enter the OTP sent to <strong>{email}</strong>.
      </p>

      {message && (
        <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form
        onSubmit={handleResetPassword}
        className="space-y-5 text-left"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">
            Verification OTP
          </label>

          <div className="flex justify-center gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  otpRefs.current[index] = element;
                }}
                type="text"
                value={digit}
                onChange={(event) =>
                  setOtpDigit(index, event.target.value)
                }
                onKeyDown={(event) =>
                  handleOtpKeyDown(index, event)
                }
                onPaste={handleOtpPaste}
                maxLength={1}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                className="h-14 w-12 rounded-2xl border border-ink text-center text-xl font-bold outline-none focus:ring-2 focus:ring-brand/30"
                required
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            New password
          </label>

          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
            required
          />

          <p className="mt-2 text-xs leading-5 text-muted">
            Use at least 8 characters with uppercase, lowercase, number
            and symbol.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Confirm new password
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Setting password..." : "Set New Password"}
        </button>

        <div className="flex items-center justify-between gap-4 text-sm">
          <button
            type="button"
            onClick={goBackToEmail}
            disabled={loading}
            className="text-muted hover:text-ink"
          >
            Change email
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={loading}
            className="font-medium text-ink hover:underline"
          >
            Resend OTP
          </button>
        </div>
      </form>
    </>
  );
}

function SuccessStep() {
  return (
    <>
      <FiCheckCircle className="mx-auto mb-4 h-16 w-16 text-brand" />

      <h1 className="mb-2 text-3xl font-bold">Password updated</h1>

      <p className="mb-6 text-muted">
        Your password has been updated. Log in using your new password.
      </p>

      <Link to="/login" className="btn-primary w-full">
        Back to Login
      </Link>
    </>
  );
}
