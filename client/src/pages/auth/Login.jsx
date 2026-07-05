import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "@/api/axios";
import { FiArrowRight } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import completeGoogleAuth from "@/utils/googleAuth";
import { hasSavedUserLocation } from "@/utils/signupLocation";
import { useApp } from "@/hooks/useApp";

export default function Login() {
  const { state } = useLocation();
  const from = state?.from?.pathname || null;
  const notice = state?.message || "";

  const nav = useNavigate();
  const { login } = useApp();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      const freshUser = response.data?.data?.user;

      if (!freshUser) {
        throw new Error("Invalid login response");
      }

      // The backend stores the JWT in an HttpOnly cookie.
      // The frontend stores only non-sensitive user state.
      login(freshUser);

      const redirectPath = !hasSavedUserLocation(freshUser)
        ? "/booking/address"
        : from || "/dashboard";

      nav(redirectPath, { replace: true });
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
      const data = await completeGoogleAuth("CUSTOMER");
      const freshUser = data?.user;

      if (!freshUser) {
        throw new Error("Invalid Google login response");
      }

      login(freshUser);

      const redirectPath = !hasSavedUserLocation(freshUser)
        ? "/booking/address"
        : from || "/dashboard";

      nav(redirectPath, { replace: true });
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

      <div className="card-soft p-7 max-w-md w-full mx-auto">
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
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 font-medium transition hover:border-ink disabled:opacity-60"
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

          <button disabled={loading} className="btn-primary mt-2">
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
    </div>
  );
}
