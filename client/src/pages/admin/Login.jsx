import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import { FiArrowRight, FiShield } from "react-icons/fi";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useApp();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await adminApi.login(
        form.identifier.trim(),
        form.password,
      );

      const adminUser = result?.user;

      if (!adminUser || adminUser.role !== "ADMIN") {
        throw new Error("Invalid admin login response");
      }

      // The backend stores the JWT in an HttpOnly cookie.
      login(adminUser);
      navigate(state?.from?.pathname || "/admin", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Admin login failed",
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
            <FiShield />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Login</h1>
            <p className="text-sm text-muted">
              Use an account with ADMIN role.
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
            value={form.identifier}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                identifier: event.target.value,
              }))
            }
            placeholder="Email or phone"
            autoComplete="username"
            className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
          />

          <input
            required
            value={form.password}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                password: event.target.value,
              }))
            }
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
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
        </form>
      </div>
    </div>
  );
}
