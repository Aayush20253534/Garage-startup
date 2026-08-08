import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "@/api/axios";
import { FcGoogle } from "react-icons/fc";
import { FiCheck, FiExternalLink, FiEye, FiEyeOff, FiShield, FiX } from "react-icons/fi";
import startGoogleAuth, { completeGoogleRedirectAuth } from "@/utils/googleAuth";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { useApp } from "@/hooks/useApp";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";

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
  const { state } = useLocation();
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
  const [error, setError] = useState(state?.message || "");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [googleConsentOpen, setGoogleConsentOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false,
  });
  const loading = Boolean(loadingAction);

  const togglePasswordVisibility = (field) => {
    setShowPasswords((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

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
        acceptedTerms,
        acceptedPrivacy,
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

  const openGoogleConsent = () => {
    if (actionLockRef.current) return;
    setError("");
    setGoogleConsentOpen(true);
  };

  const closeGoogleConsent = () => {
    if (actionLockRef.current) return;
    setGoogleConsentOpen(false);
  };

  useEffect(() => {
    if (!googleConsentOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !actionLockRef.current) {
        setGoogleConsentOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [googleConsentOpen]);

  const handleGoogleAuth = async () => {
    if (actionLockRef.current) return;

    if (!acceptedTerms || !acceptedPrivacy) {
      setGoogleConsentOpen(true);
      return;
    }

    actionLockRef.current = true;
    setGoogleConsentOpen(false);
    setError("");
    setLoadingAction("GOOGLE");

    try {
      const data = await startGoogleAuth("CUSTOMER", {
        mode: "SIGNUP",
        acceptedTerms,
        acceptedPrivacy,
      });
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
    <>
      <CustomerLoginLoader
        visible={loading}
        eyebrow="CUSTOMER SIGNUP"
        title={
          loadingAction === "GOOGLE"
            ? "Connecting your Google account"
            : "Creating your Rovauto account"
        }
        message={
          loadingAction === "GOOGLE"
            ? "Completing secure sign-up and preparing your customer profile."
            : "Saving your account securely before OTP verification."
        }
      />
      {googleConsentOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-consent-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGoogleConsent();
          }}
        >
          <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-line bg-white shadow-2xl sm:max-w-lg sm:rounded-[28px]">
            <div className="border-b border-line px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-bg-soft">
                    <FcGoogle className="text-2xl" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="google-consent-title" className="mt-0.5 text-xl font-black tracking-tight text-ink sm:text-2xl">
                      One quick confirmation
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeGoogleConsent}
                  disabled={loading}
                  aria-label="Close Google signup confirmation"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-bg-soft hover:text-ink disabled:opacity-50"
                >
                  <FiX />
                </button>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4 sm:px-6 sm:py-5">
              <div className={`rounded-2xl border p-4 transition ${
                acceptedTerms
                  ? "border-brand/70 bg-brand/10"
                  : "border-line bg-white hover:border-ink/30 hover:bg-bg-soft/60"
              }`}>
                <label htmlFor="google-terms-consent" className="flex cursor-pointer items-start gap-3">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                    acceptedTerms
                      ? "border-brand-dark bg-brand text-black"
                      : "border-line bg-white"
                  }`}>
                    {acceptedTerms && <FiCheck className="text-sm" />}
                  </span>
                  <input
                    id="google-terms-consent"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="sr-only"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">I agree to the Terms and Conditions</span>
                  </span>
                </label>
                <Link
                  to="/terms-and-conditions"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-8 mt-2 inline-flex items-center gap-1 text-xs font-bold text-ink underline underline-offset-2"
                >
                  Read Terms and Conditions <FiExternalLink />
                </Link>
              </div>

              <div className={`rounded-2xl border p-4 transition ${
                acceptedPrivacy
                  ? "border-brand/70 bg-brand/10"
                  : "border-line bg-white hover:border-ink/30 hover:bg-bg-soft/60"
              }`}>
                <label htmlFor="google-privacy-consent" className="flex cursor-pointer items-start gap-3">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                    acceptedPrivacy
                      ? "border-brand-dark bg-brand text-black"
                      : "border-line bg-white"
                  }`}>
                    {acceptedPrivacy && <FiCheck className="text-sm" />}
                  </span>
                  <input
                    id="google-privacy-consent"
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                    className="sr-only"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">I agree to the Privacy Policy</span>
                  </span>
                </label>
                <Link
                  to="/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-8 mt-2 inline-flex items-center gap-1 text-xs font-bold text-ink underline underline-offset-2"
                >
                  Read Privacy Policy <FiExternalLink />
                </Link>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-line bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading || !acceptedTerms || !acceptedPrivacy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FcGoogle className="text-xl" />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={closeGoogleConsent}
                disabled={loading}
                className="mt-2 h-9 w-full rounded-lg text-xs font-bold text-muted transition hover:bg-bg-soft hover:text-ink disabled:opacity-50"
              >
                Use another signup method
              </button>
            </div>
          </section>
        </div>
      )}
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
            onClick={openGoogleConsent}
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

          <div className="relative">
            <input
              required
              name="password"
              value={form.password}
              onChange={change}
              type={showPasswords.password ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create password"
              minLength={8}
              title={PASSWORD_MESSAGE}
              disabled={loading}
              className="w-full rounded-xl border border-line py-2.5 pl-4 pr-12 outline-none focus:border-ink disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility("password")}
              aria-label={showPasswords.password ? "Hide password" : "Show password"}
              aria-pressed={showPasswords.password}
              disabled={loading}
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-bg-soft hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
            >
              {showPasswords.password ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <div className="relative">
            <input
              required
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={change}
              type={showPasswords.confirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter password"
              minLength={8}
              disabled={loading}
              className="w-full rounded-xl border border-line py-2.5 pl-4 pr-12 outline-none focus:border-ink disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility("confirmPassword")}
              aria-label={showPasswords.confirmPassword ? "Hide re-entered password" : "Show re-entered password"}
              aria-pressed={showPasswords.confirmPassword}
              disabled={loading}
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-bg-soft hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
            >
              {showPasswords.confirmPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p className="text-xs text-red-600">Passwords do not match.</p>
          )}

          <p className="text-[11px] leading-snug text-muted">
            {PASSWORD_MESSAGE}
          </p>

          <div className="grid gap-2 rounded-xl border border-line bg-bg-soft p-3 text-xs text-ink">
            <label className="flex items-start gap-2"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5" /><span>I agree to the <Link to="/terms-and-conditions" target="_blank" className="font-semibold underline">Terms and Conditions</Link>.</span></label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} className="mt-0.5" /><span>I agree to the <Link to="/privacy-policy" target="_blank" className="font-semibold underline">Privacy Policy</Link>.</span></label>
          </div>

          <button
            type="submit"
            disabled={loading || !acceptedTerms || !acceptedPrivacy}
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
    </>
  );
}
