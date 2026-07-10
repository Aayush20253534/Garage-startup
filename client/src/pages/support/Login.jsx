import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight, FiHeadphones } from "react-icons/fi";

import Logo from "@/components/common/Logo";
import { customerSupportApi } from "@/api/customerSupport";
import { useApp } from "@/hooks/useApp";

export default function CustomerSupportLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await customerSupportApi.login(
        form.email.trim().toLowerCase(),
        form.password,
      );

      if (!result?.user || result.user.role !== "CUSTOMER_SUPPORT") {
        throw new Error("Invalid customer support login response");
      }

      login(result.user);
      navigate(state?.from?.pathname || "/support", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Customer support login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x grid min-h-[80vh] items-center py-10">
      <div className="mx-auto w-full max-w-md card-soft p-7">
        <Logo />

        <div className="mt-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-white">
            <FiHeadphones />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Customer Support Login</h1>
            <p className="text-sm text-muted">
              Sign in with the email and password created by an admin.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 grid gap-3">
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="Support email"
            autoComplete="username"
            className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
          />

          <input
            required
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
            placeholder="Password"
            autoComplete="current-password"
            className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
          />

          <button disabled={loading} className="btn-primary mt-2">
            {loading ? "Logging in..." : <>Login <FiArrowRight /></>}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-muted">
          Password recovery is intentionally unavailable. Contact an admin to
          reset or change this account password.
        </p>
      </div>
    </div>
  );
}
