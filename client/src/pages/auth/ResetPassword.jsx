import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCheckCircle, FiLock } from "react-icons/fi";
import api from "@/api/axios";

export default function ResetPassword() {
  const routeLocation = useLocation();
  const [step, setStep] = useState("form");
  const resetRole = routeLocation.state?.role || "CUSTOMER";
  const [email, setEmail] = useState(routeLocation.state?.email || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(email) && !/^\+91[6-9]\d{9}$/.test(email)) {
      setError("Enter a valid email or use the registered email address");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP");
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
        otp,
        newPassword,
        role: resetRole,
      });

      setStep("success");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex flex-col bg-bg-soft">
        <div className="container-x py-8">
          <Link to="/garage/login" className="inline-flex items-center gap-2 text-muted hover:text-ink">
            <FiArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md card-soft p-8 text-center"
          >
            <FiCheckCircle className="w-16 h-16 mx-auto text-brand mb-4" />
            <h1 className="text-3xl font-bold mb-2">Password updated</h1>
            <p className="text-muted mb-6">Your password has been set. Use your email and new password to login.</p>
            <button onClick={() => nav('/garage/login')} className="btn-primary w-full">Go to Login</button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-soft">
      <div className="container-x py-8">
        <Link to="/garage/login" className="inline-flex items-center gap-2 text-muted hover:text-ink">
          <FiArrowLeft className="w-4 h-4" />
          <span>Back to Login</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md card-soft p-8"
        >
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><FiLock /> Reset password</h1>
          <p className="text-muted mb-6">Enter the OTP you received and set a new password.</p>

          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Setting..." : "Set password"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
