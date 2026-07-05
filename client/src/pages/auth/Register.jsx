import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "@/api/axios";
import { FcGoogle } from "react-icons/fc";
import completeGoogleAuth from "@/utils/googleAuth";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { useApp } from "@/hooks/useApp";

const COUNTRY_CODE = "+91";
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.";
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const getPhoneDigits = (value) => {
  let digits = value.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 10);
};

export default function Register() {
  const nav = useNavigate();
  const { login } = useApp();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: name === "phone" ? getPhoneDigits(value) : value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!PASSWORD_REGEX.test(form.password)) {
        throw new Error(PASSWORD_MESSAGE);
      }

      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const phoneDigits = getPhoneDigits(form.phone);
      const fullPhone = `${COUNTRY_CODE}${phoneDigits}`;

      if (!/^\+91[6-9]\d{9}$/.test(fullPhone)) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: fullPhone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: "CUSTOMER",
      };

      const signupLocation = null;

      await api.post("/auth/signup", payload);

      sessionStorage.setItem(
        "pendingSignupOtp",
        JSON.stringify({
          email: payload.email,
          phone: fullPhone,
          role: payload.role,
          signupLocation,
          createdAt: Date.now(),
        }),
      );

      nav("/otp", {
        state: {
          email: payload.email,
          phone: fullPhone,
          role: payload.role,
          signupLocation,
          fromSignup: true,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);

    try {
      const data = await completeGoogleAuth("CUSTOMER");
      const freshUser = data?.user;

      if (!freshUser) {
        throw new Error("Invalid Google signup response");
      }

      // The backend sets the HttpOnly cookie. Store only user-facing state.
      login(freshUser);

      const redirectPath = hasSavedUserLocation(freshUser)
        ? "/dashboard"
        : "/booking/address";

      nav(redirectPath, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Google signup failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x grid min-h-[80vh] gap-12 py-10 sm:py-16 lg:grid-cols-2">
      <div className="hidden lg:block">
        <h1 className="text-5xl font-bold leading-tight mt-38">
          Create your <span className="text-brand-dark">Rovauto</span> account.
        </h1>
      </div>

      <div className="card-soft p-7 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-bold">Create account</h2>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <form onSubmit={submit} className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 font-medium transition hover:border-ink disabled:opacity-60"
          >
            <FcGoogle className="text-xl" />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            or create with phone OTP
            <span className="h-px flex-1 bg-line" />
          </div>

          <input
            required
            name="name"
            value={form.name}
            onChange={change}
            placeholder="Full name"
            className="px-4 py-2.5 rounded-xl border border-line focus:border-ink outline-none"
          />

          <input
            required
            name="email"
            value={form.email}
            onChange={change}
            type="email"
            placeholder="Email"
            className="px-4 py-2.5 rounded-xl border border-line focus:border-ink outline-none"
          />

          <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white transition focus-within:border-ink">
            <div className="grid h-full w-16 shrink-0 place-items-center border-r border-line bg-bg-soft px-3 py-2.5 font-semibold text-ink">
              {COUNTRY_CODE}
            </div>

            <input
              required
              name="phone"
              value={form.phone}
              onChange={change}
              maxLength={10}
              inputMode="tel"
              placeholder="Mobile number"
              className="min-w-0 flex-1 border-0 px-4 py-2.5 outline-none"
            />
          </div>

          <label className="grid gap-1 text-sm">
            <input
              required
              name="password"
              value={form.password}
              onChange={change}
              type="password"
              placeholder="Create password"
              minLength={8}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
              title={PASSWORD_MESSAGE}
              className="px-4 py-2.5 rounded-xl border border-line focus:border-ink outline-none"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <input
              required
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={change}
              type="password"
              placeholder="Re-enter password"
              minLength={8}
              className="px-4 py-2.5 rounded-xl border border-line focus:border-ink outline-none"
            />
          </label>

          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p className="text-xs text-red-600">Passwords do not match.</p>
          )}

          <p className="text-[11px] leading-snug text-muted">
            {PASSWORD_MESSAGE}
          </p>

          <button disabled={loading} className="btn-primary mt-2">
            {loading ? "Creating..." : "Create Account"}
          </button>

          <div className="text-center text-sm text-muted">
            Already a member?{" "}
            <Link to="/login" className="text-ink font-medium">
              Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
