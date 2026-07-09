import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "@/api/axios";
import { FcGoogle } from "react-icons/fc";
import startGoogleAuth, { completeGoogleRedirectAuth } from "@/utils/googleAuth";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { useApp } from "@/hooks/useApp";

const COUNTRY_CODE = "+91";
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.";
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const getPhoneDigits = (value = "") => {
  let digits = String(value).replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 10);
};

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

export default function Register() {
  const nav = useNavigate();
  const { login } = useApp();
  const actionLockRef = useRef(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const loading = Boolean(loadingAction);

  const completeGoogleLogin = (freshUser) => {
    login(freshUser);

    nav(hasSavedUserLocation(freshUser) ? "/dashboard" : "/booking/address", {
      replace: true,
    });
  };

  useEffect(() => {
    let active = true;

    const finishRedirectSignup = async () => {
      try {
        const data = await completeGoogleRedirectAuth();
        if (!active || !data) return;

        const freshUser = data?.user;
        if (!freshUser) {
          throw new Error("Invalid Google signup response");
        }

        completeGoogleLogin(freshUser);
      } catch (err) {
        if (!active) return;
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Google signup failed",
        );
      } finally {
        if (active) {
          actionLockRef.current = false;
          setLoadingAction("");
        }
      }
    };

    finishRedirectSignup();

    return () => {
      active = false;
    };
  }, []);

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: name === "phone" ? getPhoneDigits(value) : value,
    }));

    if (error) setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (actionLockRef.current) return;

    actionLockRef.current = true;
    setError("");
    setLoadingAction("FORM");

    try {
      const name = form.name.trim();
      const email = normalizeEmail(form.email);
      const phoneDigits = getPhoneDigits(form.phone);
      const fullPhone = `${COUNTRY_CODE}${phoneDigits}`;

      if (name.length < 2) {
        throw new Error("Enter your full name.");
      }

      if (!email) {
        throw new Error("Enter a valid email address.");
      }

      if (!PASSWORD_REGEX.test(form.password)) {
        throw new Error(PASSWORD_MESSAGE);
      }

      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      if (!/^\+91[6-9]\d{9}$/.test(fullPhone)) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }

      const payload = {
        name,
        email,
        phone: fullPhone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: "CUSTOMER",
      };

      // Location is collected after authentication. This avoids delaying signup
      // with an extra geocoding request and keeps the Google key server-side.
      const signupLocation = null;

      await api.post("/auth/signup", payload);

      const pendingOtp = {
        email: payload.email,
        phone: payload.phone,
        role: payload.role,
        signupLocation,
        createdAt: Date.now(),
      };

      sessionStorage.setItem("pendingSignupOtp", JSON.stringify(pendingOtp));

      nav("/otp", {
        replace: true,
        state: {
          ...pendingOtp,
          fromSignup: true,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Signup failed");
    } finally {
      actionLockRef.current = false;
      setLoadingAction("");
    }
  };

  const handleGoogleAuth = async () => {
    if (actionLockRef.current) return;

    actionLockRef.current = true;
    setError("");
    setLoadingAction("GOOGLE");

    try {
      const data = await startGoogleAuth("CUSTOMER");
      if (!data) return;

      const freshUser = data?.user;

      if (!freshUser) {
        throw new Error("Invalid Google signup response");
      }

      completeGoogleLogin(freshUser);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Google signup failed",
      );
    } finally {
      actionLockRef.current = false;
      setLoadingAction("");
    }
  };

  return (
    <div className="container-x grid min-h-[80vh] gap-12 py-10 sm:py-16 lg:grid-cols-2">
      <div className="hidden lg:block">
        <h1 className="mt-38 text-5xl font-bold leading-tight">
          Create your <span className="text-brand-dark">Rovauto</span> account.
        </h1>
      </div>

      <div className="card-soft mx-auto w-full max-w-md p-7">
        <h2 className="text-2xl font-bold">Create account</h2>

        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FcGoogle className="text-xl" />
            {loadingAction === "GOOGLE" ? "Connecting..." : "Continue with Google"}
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
            autoComplete="name"
            placeholder="Full name"
            disabled={loading}
            className="rounded-xl border border-line px-4 py-2.5 outline-none focus:border-ink disabled:opacity-60"
          />

          <input
            required
            name="email"
            value={form.email}
            onChange={change}
            type="email"
            autoComplete="email"
            placeholder="Email"
            disabled={loading}
            className="rounded-xl border border-line px-4 py-2.5 outline-none focus:border-ink disabled:opacity-60"
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
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="Mobile number"
              disabled={loading}
              className="min-w-0 flex-1 border-0 px-4 py-2.5 outline-none disabled:opacity-60"
            />
          </div>

          <input
            required
            name="password"
            value={form.password}
            onChange={change}
            type="password"
            autoComplete="new-password"
            placeholder="Create password"
            minLength={8}
            title={PASSWORD_MESSAGE}
            disabled={loading}
            className="rounded-xl border border-line px-4 py-2.5 outline-none focus:border-ink disabled:opacity-60"
          />

          <input
            required
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={change}
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            minLength={8}
            disabled={loading}
            className="rounded-xl border border-line px-4 py-2.5 outline-none focus:border-ink disabled:opacity-60"
          />

          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p className="text-xs text-red-600">Passwords do not match.</p>
          )}

          <p className="text-[11px] leading-snug text-muted">
            {PASSWORD_MESSAGE}
          </p>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingAction === "FORM" ? "Creating..." : "Create Account"}
          </button>

          <div className="text-center text-sm text-muted">
            Already a member?{" "}
            <Link to="/login" className="font-medium text-ink">
              Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
