import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { internApi } from "@/api/intern";
import { useApp } from "@/hooks/useApp";
import { FiArrowRight, FiShield } from "react-icons/fi";

export default function InternLogin() {
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
      const result = await internApi.login(
        form.identifier.trim(),
        form.password,
      );

      const internUser = result?.user;

      if (!internUser || internUser.role !== "INTERN") {
        throw new Error("Invalid intern login response");
      }

      login(internUser);
      navigate(state?.from?.pathname || "/intern", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Intern login failed",
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
            <h1 className="text-2xl font-bold">Intern Login</h1>
            <p className="text-sm text-muted">
              Use the Intern ID or email created by an administrator.
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
            placeholder="Intern ID or email"
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

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              "Logging in..."
            ) : (
              <>
                Login <FiArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-5 text-muted">
          Intern accounts do not have self-registration or forgot-password access.
          Contact an administrator for account or password changes.
        </p>
      </div>
    </div>
  );
}
