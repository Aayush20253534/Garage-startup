import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiKey,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiUserCheck,
  FiUserX,
  FiX,
} from "react-icons/fi";

import { adminApi } from "@/api/admin";

const EMPTY_CREATE = {
  name: "",
  loginId: "",
  email: "",
  password: "",
};

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Never";

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

export default function InternAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editing, setEditing] = useState(null);
  const [passwordAccount, setPasswordAccount] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const summary = useMemo(() => {
    const active = accounts.filter((account) => account.isActive).length;
    const hasLoggedIn = accounts.filter((account) => account.lastLoginAt).length;

    return {
      total: accounts.length,
      active,
      disabled: accounts.length - active,
      hasLoggedIn,
    };
  }, [accounts]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await adminApi.getInternAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load intern accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createAccount = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await adminApi.createInternAccount({
        name: createForm.name.trim(),
        loginId: createForm.loginId.trim().toLowerCase(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
      });

      setCreateForm(EMPTY_CREATE);
      setSuccess("Intern account created successfully.");
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to create intern account"));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await adminApi.updateInternAccount(editing.id, {
        name: editing.name.trim(),
        loginId: editing.loginId.trim().toLowerCase(),
        email: String(editing.email || "").trim().toLowerCase(),
        isActive: Boolean(editing.isActive),
      });

      setEditing(null);
      setSuccess("Intern account updated successfully.");
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to update intern account"));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!passwordAccount) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await adminApi.changeInternPassword(passwordAccount.id, newPassword);

      setPasswordAccount(null);
      setNewPassword("");
      setSuccess("Intern password changed. Existing sessions are now invalid.");
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to change intern password"));
    } finally {
      setSaving(false);
    }
  };

  const summaryCards = [
    {
      label: "Total interns",
      value: summary.total,
      icon: FiShield,
    },
    {
      label: "Active accounts",
      value: summary.active,
      icon: FiUserCheck,
    },
    {
      label: "Disabled accounts",
      value: summary.disabled,
      icon: FiUserX,
    },
    {
      label: "Have logged in",
      value: summary.hasLoggedIn,
      icon: FiActivity,
    },
  ];

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Staff account management
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink">
              <FiShield /> Intern accounts
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Create individual intern IDs and passwords from the admin console.
              Interns use the existing Intern Login page and cannot create or
              recover accounts themselves. Disabling an account blocks it on
              the next authenticated request.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-ink transition hover:border-ink disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <FiCheckCircle className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-soft"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-extrabold text-ink">{value}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-bg-soft text-lg text-ink">
                <Icon />
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <FiPlus /> Create intern account
        </h2>

        <form
          onSubmit={createAccount}
          className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-[1fr_0.9fr_1.2fr_1fr_auto]"
        >
          <input
            required
            value={createForm.name}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Full name"
            autoComplete="off"
            className="h-11 min-w-0 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <input
            required
            value={createForm.loginId}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                loginId: event.target.value,
              }))
            }
            placeholder="Intern ID"
            autoCapitalize="none"
            autoComplete="off"
            className="h-11 min-w-0 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <input
            type="email"
            value={createForm.email}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="Email (optional)"
            autoComplete="off"
            className="h-11 min-w-0 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <input
            required
            type="password"
            value={createForm.password}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Strong password"
            autoComplete="new-password"
            className="h-11 min-w-0 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <button
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2 2xl:col-span-1 2xl:w-auto"
          >
            <FiPlus /> Create
          </button>
        </form>

        <div className="mt-3 grid gap-1 text-xs leading-5 text-muted">
          <p>
            Intern IDs must be 3-60 characters and can use letters, numbers,
            dots, underscores, and hyphens.
          </p>
          <p>
            Passwords require at least 8 characters with uppercase, lowercase,
            a number, and a symbol.
          </p>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-ink">Managed intern accounts</h2>
          <p className="mt-1 text-sm text-muted">
            Interns can sign in with either their Intern ID or their optional email.
          </p>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg-soft text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 sm:px-6">Account</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Security</th>
                <th className="px-4 py-3 sm:px-6">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-muted">
                    Loading intern accounts...
                  </td>
                </tr>
              ) : accounts.length ? (
                accounts.map((account) => (
                  <tr key={account.id} className="align-top">
                    <td className="px-4 py-4 sm:px-6">
                      <p className="font-bold text-ink">{account.name}</p>
                      <p className="mt-1 font-mono text-xs font-semibold text-ink/70">
                        ID: {account.loginId}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {account.email || "No email added"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          account.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {account.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs leading-5 text-muted">
                      {formatDate(account.lastLoginAt)}
                    </td>

                    <td className="px-4 py-4 text-xs leading-5 text-muted">
                      <p>Password changed:</p>
                      <p className="font-semibold text-ink/70">
                        {formatDate(account.passwordChangedAt)}
                      </p>
                    </td>

                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing({ ...account })}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold text-ink transition hover:border-ink"
                        >
                          <FiEdit2 /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordAccount(account);
                            setNewPassword("");
                          }}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold text-ink transition hover:border-ink"
                        >
                          <FiKey /> Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-muted">
                    No intern accounts have been created from the admin console.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4">
          <button
            type="button"
            aria-label="Close edit dialog"
            className="absolute inset-0"
            onClick={() => setEditing(null)}
          />

          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">Edit intern account</h2>
                <p className="mt-1 text-sm text-muted">
                  Changes apply to the intern login immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-ink">
                Name
                <input
                  value={editing.name}
                  onChange={(event) =>
                    setEditing((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-ink">
                Intern ID
                <input
                  value={editing.loginId}
                  onChange={(event) =>
                    setEditing((current) => ({
                      ...current,
                      loginId: event.target.value,
                    }))
                  }
                  autoCapitalize="none"
                  className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-ink">
                Email (optional)
                <input
                  type="email"
                  value={editing.email || ""}
                  onChange={(event) =>
                    setEditing((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink"
                />
              </label>

              <label className="flex items-start gap-3 rounded-xl bg-bg-soft p-4 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(event) =>
                    setEditing((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-bold">Account active</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    Disabled interns cannot log in and existing sessions stop
                    working on their next request.
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
              >
                <FiSave /> Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordAccount && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4">
          <button
            type="button"
            aria-label="Close password dialog"
            className="absolute inset-0"
            onClick={() => setPasswordAccount(null)}
          />

          <form
            onSubmit={changePassword}
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">Change password</h2>
                <p className="mt-1 text-sm text-muted">
                  {passwordAccount.name} · {passwordAccount.loginId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordAccount(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line"
              >
                <FiX />
              </button>
            </div>

            <label className="mt-5 grid gap-2 text-sm font-bold text-ink">
              New password
              <input
                required
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink"
              />
            </label>

            <p className="mt-3 text-xs leading-5 text-muted">
              Changing the password invalidates tokens issued before this change.
            </p>

            <button
              disabled={saving}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
            >
              <FiKey /> Change password
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
