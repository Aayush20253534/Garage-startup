import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import api from "@/api/axios";

export default function Forgot() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/forgot-password", { email, role: "CUSTOMER" });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send reset OTP");
    }
  };

  return (
    <div className="container-x py-16 min-h-[80vh] grid place-items-center">
      <div className="card-soft p-7 max-w-md w-full">
        <Logo className="h-9" showText={false} />

        {sent ? (
          <div className="text-center py-8">
            <div className="h-14 w-14 grid place-items-center bg-brand rounded-full mx-auto">
              <FiCheckCircle className="text-2xl" />
            </div>

            <h2 className="text-2xl font-bold mt-4">Check your email</h2>

            <p className="text-muted text-sm mt-2">
              Password reset OTP was sent to {email}.
            </p>

            <button
              onClick={() => nav("/reset-password", { state: { email, role: "CUSTOMER" } })}
              className="btn-dark mt-6 inline-flex"
            >
              Reset Password
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <h2 className="text-2xl font-bold">Forgot password</h2>

            <p className="text-sm text-muted">
              Enter your registered email.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <input
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
            />

            <button className="btn-primary">Send OTP</button>

            <Link to="/login" className="text-sm text-muted text-center hover:text-ink">
              Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
