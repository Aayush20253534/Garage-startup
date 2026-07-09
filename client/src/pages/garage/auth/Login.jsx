import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { FiMail, FiLock, FiArrowRight, FiAlertCircle } from "react-icons/fi";
import { garageApi } from "@/api/garage";

export default function GarageLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const { loginGarage } = useApp();

  const returnTo = location.state?.from
    ? `${location.state.from.pathname || "/garage"}${
        location.state.from.search || ""
      }`
    : "/garage";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await garageApi.login(identifier.trim(), password);
      const garage = result?.garage;

      if (!garage) {
        throw new Error("Invalid garage login response");
      }

      // The backend stores the garage JWT in an HttpOnly cookie.
      loginGarage(garage);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Unable to sign in",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-soft">
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md card-soft p-8"
        >
          <h1 className="text-3xl font-bold mb-2">Garage Login</h1>
          <p className="text-muted mb-8">Sign in to manage your garage</p>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">
                Email or Phone
              </label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="garage@email.com"
                  autoComplete="username"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <Link
                to="/garage/forgot-password"
                className="text-muted hover:text-ink"
              >
                Forgot Password?
              </Link>
              <Link
                to="/garage/onboarding"
                className="text-ink font-semibold hover:underline"
              >
                Apply as garage
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
              <FiArrowRight className="h-4 w-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
