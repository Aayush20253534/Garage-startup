import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiMail, FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import api from "@/api/axios";

export default function GarageForgotPassword() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpFromServer, setOtpFromServer] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const otpRefs = useRef([]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/forgot-password", {
        email,
        role: "GARAGE_OWNER",
      });
      const data = res.data.data || {};

      if (data.otp) {
        setOtpFromServer(data.otp);
      }

      setStep("reset");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send reset OTP",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");

    const finalOtp = otp.join("");

    if (!/^\d{6}$/.test(finalOtp)) {
      setError("Enter a valid 6-digit OTP");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        email,
        otp: finalOtp,
        newPassword,
        role: "GARAGE_OWNER",
      });

      setStep("success");
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

  const setOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];

    next[index] = digit;
    setOtp(next);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key !== "Backspace" || otp[index]) return;
    otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();

    const pastedOtp = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    const next = Array(6).fill("");
    pastedOtp.split("").forEach((digit, index) => {
      next[index] = digit;
    });

    setOtp(next);
    otpRefs.current[Math.min(pastedOtp.length, 5)]?.focus();
  };

  return (
    <div className="min-h-screen bg-bg-soft">
      <div className="container-x pt-5 pb-3 sm:pt-6">
        <Link
          to="/garage/login"
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
            <>
              <FiCheckCircle className="mx-auto mb-4 h-16 w-16 text-brand" />

              <h1 className="mb-2 text-3xl font-bold">Password updated</h1>

              <p className="mb-6 text-muted">
                Your password has been set. Use your email and new password to
                login.
              </p>

              <Link to="/garage/login" className="btn-primary w-full">
                Back to Login
              </Link>
            </>
          ) : step === "email" ? (
            <>
              <h1 className="mb-2 text-3xl font-bold">Forgot Password?</h1>

              <p className="mb-8 text-muted">
                Enter your email to receive a password reset OTP.
              </p>

              {error && (
                <div className="mb-4 text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="mb-2 block text-left text-sm font-medium">
                    Email
                  </label>

                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@example.com"
                      className="w-full rounded-xl border border-line py-3 pl-11 pr-4 text-left outline-none transition-colors focus:border-ink"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-4 text-lg"
                >
                  {loading ? "Sending..." : "Send Reset OTP"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-3xl font-bold">Reset Password</h1>

              <p className="mb-4 text-muted">
                We sent a reset OTP to <strong>{email}</strong>.
              </p>

              {otpFromServer && (
                <div className="mb-4 rounded-xl border border-line bg-yellow-50 p-3 text-sm text-ink">
                  <strong>OTP:</strong> {otpFromServer}
                </div>
              )}

              {error && (
                <div className="mb-4 text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleReset} className="space-y-4 text-left">
                <div>
                  <label className="mb-2 block text-sm font-medium">OTP</label>

                  <div className="flex justify-center gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <input
                        key={index}
                        ref={(el) => (otpRefs.current[index] = el)}
                        type="text"
                        value={otp[index] || ""}
                        onChange={(e) => setOtpDigit(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        maxLength={1}
                        inputMode="numeric"
                        className="h-14 w-12 rounded-2xl border border-ink text-center text-xl font-bold outline-none"
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
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-4 text-lg"
                >
                  {loading ? "Setting..." : "Set New Password"}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
