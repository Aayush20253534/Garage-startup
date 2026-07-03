import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiAlertCircle } from "react-icons/fi";

export default function GarageOtpLogin() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-soft">
      <div className="container-x py-8">
        <Link
          to="/garage/login"
          className="inline-flex items-center gap-2 text-muted hover:text-ink"
        >
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
          <FiAlertCircle className="mx-auto mb-4 h-14 w-14 text-yellow-700" />
          <h1 className="text-3xl font-bold mb-2">OTP Login Unavailable</h1>
          <p className="text-muted mb-6">
            SMS OTP is currently disabled on the backend. Use email or phone
            with password login for garage accounts.
          </p>
          <Link to="/garage/login" className="btn-primary w-full">
            Use Password Login
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
