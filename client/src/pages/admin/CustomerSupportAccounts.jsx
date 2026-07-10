import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiHeadphones,
  FiKey,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiX,
} from "react-icons/fi";

import { adminApi } from "@/api/admin";

const EMPTY_CREATE = { name: "", email: "", password: "" };

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Never";

export default function CustomerSupportAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editing, setEditing] = useState(null);
  const [passwordAccount, setPasswordAccount] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await adminApi.getCustomerSupportAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load support accounts");
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
      await adminApi.createCustomerSupportAccount({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
      });
      setCreateForm(EMPTY_CREATE);
      setSuccess("Customer support account created successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to create account");
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
      await adminApi.updateCustomerSupportAccount(editing.id, {
        name: editing.name.trim(),
        email: editing.email.trim().toLowerCase(),
        isActive: Boolean(editing.isActive),
      });
      setEditing(null);
      setSuccess("Customer support account updated.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to update account");
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
      await adminApi.changeCustomerSupportPassword(passwordAccount.id, newPassword);
      setPasswordAccount(null);
      setNewPassword("");
      setSuccess("Customer support password changed.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Separate account type</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink"><FiHeadphones /> Customer support accounts</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Create multiple email-and-password accounts for the dedicated customer support portal. Support agents have no forgot-password flow; admins control their passwords and account status. Disabling an account releases its active tickets back to the shared queue.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-ink disabled:opacity-50"><FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
      </section>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><FiAlertCircle className="mt-0.5" /> {error}</div>}
      {success && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><FiCheckCircle /> {success}</div>}

      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><FiPlus /> Create customer support account</h2>
        <form onSubmit={createAccount} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr_1fr_auto]">
          <input required value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink" />
          <input required type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} placeholder="support.agent@rovauto.com" className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink" />
          <input required type="password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} placeholder="Strong password" className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink" />
          <button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:opacity-50"><FiPlus /> Create</button>
        </form>
        <p className="mt-3 text-xs text-muted">Password requires at least 8 characters with uppercase, lowercase, a number, and a symbol.</p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg-soft text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Active tickets</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-line">
              {loading ? <tr><td colSpan="5" className="px-4 py-10 text-center text-muted">Loading accounts...</td></tr> : accounts.length ? accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-4 py-4"><p className="font-bold text-ink">{account.name}</p><p className="mt-1 text-xs text-muted">{account.email}</p></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${account.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{account.isActive ? "Active" : "Disabled"}</span></td>
                  <td className="px-4 py-4"><p className="font-bold text-ink">{account.activeTicketCount || 0}</p><p className="text-xs text-muted">{account._count?.assignedTickets || 0} total assigned</p></td>
                  <td className="px-4 py-4"><p className="text-xs text-muted">Last login: {formatDate(account.lastLoginAt)}</p><p className="mt-1 text-xs text-muted">Password changed: {formatDate(account.passwordChangedAt)}</p></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditing({ ...account })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold text-ink"><FiEdit2 /> Edit</button><button type="button" onClick={() => { setPasswordAccount(account); setNewPassword(""); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold text-ink"><FiKey /> Password</button></div></td>
                </tr>
              )) : <tr><td colSpan="5" className="px-4 py-10 text-center text-muted">No customer support accounts have been created.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4"><button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setEditing(null)} /><div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-ink">Edit support account</h2><button type="button" onClick={() => setEditing(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-line"><FiX /></button></div><div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-bold text-ink">Name<input value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-lg border border-line px-3 text-sm outline-none" /></label><label className="grid gap-2 text-sm font-bold text-ink">Email<input type="email" value={editing.email} onChange={(event) => setEditing((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-lg border border-line px-3 text-sm outline-none" /></label><label className="flex items-center gap-3 rounded-lg bg-bg-soft p-3 text-sm font-bold text-ink"><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing((current) => ({ ...current, isActive: event.target.checked }))} /> Account active</label><button type="button" onClick={() => void saveEdit()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"><FiSave /> Save changes</button></div></div></div>}

      {passwordAccount && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4"><button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setPasswordAccount(null)} /><form onSubmit={changePassword} className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-ink">Change password</h2><p className="mt-1 text-sm text-muted">{passwordAccount.name} · {passwordAccount.email}</p></div><button type="button" onClick={() => setPasswordAccount(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-line"><FiX /></button></div><label className="mt-5 grid gap-2 text-sm font-bold text-ink">New password<input required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 rounded-lg border border-line px-3 text-sm outline-none" /></label><button disabled={saving} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"><FiKey /> Change password</button></form></div>}
    </div>
  );
}
