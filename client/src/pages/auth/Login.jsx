import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "@/api/axios";
import { FiArrowRight, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import startGoogleAuth, { completeGoogleRedirectAuth } from "@/utils/googleAuth";
import { verifyCurrentSession } from "@/utils/authSession";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { useApp } from "@/hooks/useApp";
import CustomerPwaInstall from "@/components/pwa/CustomerPwaInstall";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import { preloadCustomerPortal } from "@/utils/customerPreload";

const MOBILE_LOGIN_LOADER_MINIMUM_MS = 1100;

const buildReturnPath = (fromLocation) => {
  if (!fromLocation?.pathname) return null;

  return `${fromLocation.pathname}${fromLocation.search || ""}${
    fromLocation.hash || ""
  }`;
};

export default function Login() {
  const { state } = useLocation();
  const fromLocation = state?.from || null;
  const from = buildReturnPath(fromLocation);
  const notice = state?.message || "";

  const nav = useNavigate();
  const { login, fetchProfile, preloadCustomerData } = useApp();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loadingStartedAtRef = useRef(0);

  const beginLoginLoading = () => {
    loadingStartedAtRef.current = Date.now();
    setLoading(true);
  };

  const completeMobileLoaderAnimation = async () => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 639px)").matches
    ) {
      return;
    }

    const elapsed = Date.now() - loadingStartedAtRef.current;
    const remaining = MOBILE_LOGIN_LOADER_MINIMUM_MS - elapsed;

    if (remaining > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, remaining));
    }
  };

  const completeLogin = async (freshUser) => {
    login(freshUser);

    let resolvedUser = freshUser;
    let locationCheckCompleted = hasSavedUserLocation(freshUser);

    if (!locationCheckCompleted) {
      try {
        // The authentication response can be available before the complete
        // customer profile is hydrated. Check the authoritative profile before
        // deciding that an existing customer needs address confirmation.
        const profile = await fetchProfile?.({ force: true });

        if (profile?.id === freshUser.id) {
          resolvedUser = profile;
          locationCheckCompleted = true;
        }
      } catch (profileError) {
        // A temporary profile failure must not force a returning customer
        // through location confirmation. Booking routes will verify again.
        console.warn("Unable to verify saved location after login:", profileError);
      }
    }

    const needsLocationConfirmation =
      locationCheckCompleted && !hasSavedUserLocation(resolvedUser);
    const targetPath = needsLocationConfirmation
      ? "/booking/address"
      : from || "/dashboard";

    // Start fetching the customer dashboard and route chunks before the next
    // screen mounts. Navigation remains immediate after the location check;
    // preload failures never block login.
    preloadCustomerPortal({ targetPath });
    preloadCustomerData?.({
      force: true,
      userId: freshUser.id,
    });

    await completeMobileLoaderAnimation();

    if (targetPath === "/booking/address") {
      nav(targetPath, {
        replace: true,
        state: fromLocation ? { from: fromLocation } : undefined,
      });
      return;
    }

    nav(targetPath, { replace: true });
  };

  useEffect(() => {
    let active = true;

    const finishRedirectLogin = async () => {
      try {
        const data = await completeGoogleRedirectAuth();
        if (!active || !data) return;

        beginLoginLoading();
        const freshUser = data?.user;
        if (!freshUser) {
          throw new Error("Invalid Google login response");
        }

        await completeLogin(freshUser);
      } catch (err) {
        if (!active) return;
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Google login failed",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    finishRedirectLogin();

    return () => {
      active = false;
    };
  }, []);

  const change = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    setError("");
    beginLoginLoading();

    try {
      const response = await api.post("/auth/login", {
        identifier: form.identifier.trim(),
        password: form.password,
        role: "CUSTOMER",
      });

      const loginUser = response.data?.data?.user;

      if (!loginUser) {
        throw new Error("Invalid login response");
      }

      // Confirm that the HttpOnly cookie is usable before opening a protected
      // route. A successful login response alone is not proof that the browser
      // persisted the cookie.
      const freshUser = await verifyCurrentSession({
        expectedRole: "CUSTOMER",
      });

      await completeLogin(freshUser);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    beginLoginLoading();

    try {
      const data = await startGoogleAuth("CUSTOMER");
      if (!data) return;

      const freshUser = data?.user;

      if (!freshUser) {
        throw new Error("Invalid Google login response");
      }

      await completeLogin(freshUser);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Google login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <CustomerLoginLoader visible={loading} />
      <div className="container-x grid min-h-[80vh] items-center gap-12 py-10 sm:py-16 lg:grid-cols-2 mt-0 pb-30">
        <div className="hidden lg:block">
          <h1 className="text-5xl font-bold leading-tight">
            Welcome back.
            <br />
            <span className="text-muted">Your garage on demand.</span>
          </h1>
        </div>

        <div className="mx-auto grid w-full max-w-md gap-4">
          <div className="card-soft w-full p-7">
            <h2 className="text-2xl font-bold">Login to Rovauto</h2>

            <p className="text-sm text-muted mt-1">
              Use email/phone and password
            </p>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            {notice && !error && (
              <p className="mt-3 text-sm text-red-600">{notice}</p>
            )}

            <form onSubmit={submit} className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
          >
            <FcGoogle className="text-xl" />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <input
            required
            name="identifier"
            value={form.identifier}
            onChange={change}
            placeholder="Email or phone"
            autoComplete="username"
            className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
          />

          <div className="relative">
            <input
              required
              name="password"
              value={form.password}
              onChange={change}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-line py-3 pl-4 pr-12 outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-bg-soft hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <button
            disabled={loading}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              "Logging in..."
            ) : (
              <>
                Login <FiArrowRight />
              </>
            )}
          </button>

          <Link
            to="/forgot"
            className="text-sm text-muted hover:text-ink text-center mt-1"
          >
            Forgot password?
          </Link>

          <div className="text-center text-sm text-muted">
            New to Rovauto?{" "}
            <Link to="/register" className="text-ink font-medium">
              Create account
            </Link>
          </div>
            </form>
          </div>
          <CustomerPwaInstall compact />
        </div>
      </div>
    </>
  );
}
