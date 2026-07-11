import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "@/api/axios";
import { FiArrowRight } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import startGoogleAuth, { completeGoogleRedirectAuth } from "@/utils/googleAuth";
import { verifyCurrentSession } from "@/utils/authSession";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { useApp } from "@/hooks/useApp";
import CustomerPwaInstall from "@/components/pwa/CustomerPwaInstall";
import { preloadCustomerPortal } from "@/utils/customerPreload";

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
  const { login, preloadCustomerData } = useApp();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const completeLogin = (freshUser) => {
    login(freshUser);

    const targetPath = !hasSavedUserLocation(freshUser)
      ? "/booking/address"
      : from || "/dashboard";

    // Start fetching the customer dashboard and route chunks before the next
    // screen mounts. Navigation remains immediate; the preload never blocks
    // login and any request is reused by the destination page.
    preloadCustomerPortal({ targetPath });
    preloadCustomerData?.({
      force: true,
      userId: freshUser.id,
    });

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

        const freshUser = data?.user;
        if (!freshUser) {
          throw new Error("Invalid Google login response");
        }

        completeLogin(freshUser);
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
    setLoading(true);

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

      completeLogin(freshUser);
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
    setLoading(true);

    try {
      const data = await startGoogleAuth("CUSTOMER");
      if (!data) return;

      const freshUser = data?.user;

      if (!freshUser) {
        throw new Error("Invalid Google login response");
      }

      completeLogin(freshUser);
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

        <p className="text-sm text-muted mt-1">Use email/phone and password</p>

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

          <input
            required
            name="password"
            value={form.password}
            onChange={change}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
          />

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
  );
}
