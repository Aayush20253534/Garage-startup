import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiKey,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiUsers,
  FiUserX,
  FiX,
} from "react-icons/fi";

const EMPTY = {
  name: "",
  email: "",
  password: "",
  role: "SUB_ADMIN",
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";

const getError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const roleLabel = (role) => (role === "ADMIN" ? "Main Admin" : "Admin");

export default function SubAdminAccounts() {
  const { user } = useApp();
  const isMainAdmin = user?.role === "ADMIN";
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [passwordAccount, setPasswordAccount] = useState(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const summary = useMemo(
    () => ({
      total: accounts.length,
      active: accounts.filter((account) => account.isActive).length,
      mainAdmins: accounts.filter((account) => account.role === "ADMIN").length,
      admins: accounts.filter((account) => account.role === "SUB_ADMIN").length,
    }),
    [accounts],
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.getSubAdminAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(getError(loadError, "Unable to load admin accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const selectedRole = isMainAdmin ? form.role : "SUB_ADMIN";
      await adminApi.createSubAdminAccount({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: selectedRole,
      });
      setForm(EMPTY);
      setSuccess(
        `${roleLabel(selectedRole)} created. They can sign in using email, password and OTP.`,
      );
      await load();
    } catch (createError) {
      setError(getError(createError, "Unable to create admin account"));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name: editing.name.trim(),
        email: editing.email.trim().toLowerCase(),
        isActive: Boolean(editing.isActive),
      };

      if (isMainAdmin && editing.id !== user?.id) {
        payload.role = editing.role;
      }

      const roleChanged = editing.role !== editing.originalRole;
      await adminApi.updateSubAdminAccount(editing.id, payload);
      setEditing(null);
      setSuccess(
        roleChanged
          ? "Admin role switched successfully. Existing sessions were revoked."
          : "Admin account updated.",
      );
      await load();
    } catch (saveError) {
      setError(getError(saveError, "Unable to update admin account"));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await adminApi.changeSubAdminPassword(passwordAccount.id, password);
      setPasswordAccount(null);
      setPassword("");
      setSuccess("Password changed and all existing sessions were revoked.");
      await load();
    } catch (passwordError) {
      setError(getError(passwordError, "Unable to change password"));
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (account) => {
    setEditing({ ...account, originalRole: account.role });
    setError("");
    setSuccess("");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Staff access control
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink">
              <FiShield /> Admin accounts
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Admin and Main Admin accounts share operational access. Main Admin
              additionally controls dangerous commands and can switch another
              account between Admin and Main Admin.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-bold"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {error && (
        <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex gap-2 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <FiCheckCircle className="mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", summary.total, FiShield],
          ["Main Admin", summary.mainAdmins, FiUserCheck],
          ["Admin", summary.admins, FiUsers],
          ["Disabled", summary.total - summary.active, FiUserX],
        ].map(([label, value, Icon]) => (
          <article key={label} className="rounded-lg border border-line bg-white p-5">
            <Icon className="h-5 w-5" />
            <p className="mt-3 text-xs font-bold uppercase text-muted">{label}</p>
            <p className="text-3xl font-extrabold text-ink">{value}</p>
          </article>
        ))}
      </section>

      <form
        onSubmit={create}
        className="grid gap-3 rounded-lg border border-line bg-white p-5 md:grid-cols-2 xl:grid-cols-5"
      >
        <input
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Full name"
          className="h-11 rounded-md border border-line px-3"
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Email"
          className="h-11 rounded-md border border-line px-3"
        />
        <input
          required
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Strong password"
          className="h-11 rounded-md border border-line px-3"
        />
        <select
          value={isMainAdmin ? form.role : "SUB_ADMIN"}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
          disabled={!isMainAdmin}
          className="h-11 rounded-md border border-line bg-white px-3 disabled:bg-bg-soft disabled:text-muted"
          aria-label="Admin account role"
        >
          <option value="SUB_ADMIN">Admin</option>
          <option value="ADMIN">Main Admin</option>
        </select>
        <button
          disabled={saving}
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiPlus /> Create account
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg-soft text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Account</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Created by</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-ink">{account.name}</p>
                    <p className="text-xs text-muted">{account.email}</p>
                    {account.id === user?.id && (
                      <p className="mt-1 text-xs font-bold text-brand-dark">
                        Current session
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-md border border-line bg-bg-soft px-2.5 py-1 text-xs font-bold text-ink">
                      {roleLabel(account.role)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {account.createdByName || "Main Admin"}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {formatDate(account.lastLoginAt)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${
                        account.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {account.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(account)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-line"
                        aria-label={`Edit ${account.name}`}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasswordAccount(account)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-line"
                        aria-label={`Change password for ${account.name}`}
                      >
                        <FiKey />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !accounts.length && (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-muted">
                    No admin accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Account settings
                </p>
                <h2 className="mt-1 text-lg font-bold text-ink">Edit admin</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="grid h-9 w-9 place-items-center rounded-md border border-line"
                aria-label="Close edit dialog"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
                className="h-11 rounded-md border border-line px-3"
                aria-label="Admin name"
              />
              <input
                type="email"
                value={editing.email}
                onChange={(event) =>
                  setEditing({ ...editing, email: event.target.value })
                }
                className="h-11 rounded-md border border-line px-3"
                aria-label="Admin email"
              />

              <label className="grid gap-1.5 text-sm font-bold text-ink">
                Role
                <select
                  value={editing.role}
                  onChange={(event) =>
                    setEditing({ ...editing, role: event.target.value })
                  }
                  disabled={!isMainAdmin || editing.id === user?.id}
                  className="h-11 rounded-md border border-line bg-white px-3 font-normal disabled:bg-bg-soft disabled:text-muted"
                >
                  <option value="SUB_ADMIN">Admin</option>
                  <option value="ADMIN">Main Admin</option>
                </select>
              </label>

              {!isMainAdmin && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Only a Main Admin can switch account roles.
                </p>
              )}

              {isMainAdmin && editing.id === user?.id && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Your own role cannot be changed while this account is signed in.
                </p>
              )}

              {editing.role !== editing.originalRole && (
                <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  Switching the role will revoke every active session for this
                  account. The user must sign in again using the new account type.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  disabled={editing.id === user?.id}
                  onChange={(event) =>
                    setEditing({ ...editing, isActive: event.target.checked })
                  }
                />
                Active account
              </label>

              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="h-11 rounded-md bg-ink font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordAccount && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4">
          <form
            onSubmit={changePassword}
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Security
                </p>
                <h2 className="mt-1 text-lg font-bold text-ink">
                  Change password
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPasswordAccount(null)}
                className="grid h-9 w-9 place-items-center rounded-md border border-line"
                aria-label="Close password dialog"
              >
                <FiX />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">{passwordAccount.name}</p>
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New strong password"
              className="mt-4 h-11 w-full rounded-md border border-line px-3"
            />
            <button
              disabled={saving}
              className="mt-3 h-11 w-full rounded-md bg-ink font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Change password and revoke sessions
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
