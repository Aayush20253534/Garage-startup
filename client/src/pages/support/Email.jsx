import { useEffect, useState } from "react";
import { FiAlertCircle, FiMail, FiSearch, FiSend } from "react-icons/fi";

import { customerSupportApi } from "@/api/customerSupport";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

export default function CustomerSupportEmail() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = async (term = search) => {
    try {
      setLoading(true);
      const data = await customerSupportApi.searchEmailUsers({ search: term });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to find users");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await customerSupportApi.getEmailHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    void loadUsers("");
    void loadHistory();
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    void loadUsers(search.trim());
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    try {
      setSending(true);
      setError("");
      setSuccess("");
      await customerSupportApi.sendUserEmail({
        userId: selectedUser.id,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSuccess(`Email sent to ${selectedUser.email}`);
      setForm({ subject: "", message: "" });
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1300px] space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Customer communication</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink"><FiMail /> Email</h1>
        <p className="mt-2 text-sm text-muted">Search for a Rovauto user and send a support email. Every attempt is recorded against your support account.</p>
      </section>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><FiAlertCircle className="mt-0.5" /> {error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{success}</div>}

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold text-ink">Choose recipient</h2>
          <form onSubmit={submitSearch} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><div className="relative flex-1"><FiSearch className="absolute left-3 top-3.5 text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, or phone" className="h-11 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none focus:border-ink" /></div><button className="h-11 rounded-lg bg-ink px-4 text-sm font-bold text-white">Search</button></form>
          <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
            {loading ? <p className="rounded-lg bg-bg-soft p-4 text-sm text-muted">Searching...</p> : users.length ? users.map((item) => {
              const active = selectedUser?.id === item.id;
              return <button key={item.id} type="button" onClick={() => setSelectedUser(item)} className={`rounded-xl border p-3 text-left transition ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-bg-soft"}`}><p className="font-bold">{item.name}</p><p className={`mt-1 text-xs ${active ? "text-white/70" : "text-muted"}`}>{item.email}</p><p className={`mt-1 text-[11px] font-bold uppercase ${active ? "text-white/60" : "text-muted"}`}>{item.role}</p></button>;
            }) : <p className="rounded-lg bg-bg-soft p-4 text-sm text-muted">No users found.</p>}
          </div>
        </section>

        <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold text-ink">Compose email</h2>
          <p className="mt-1 text-sm text-muted">Recipient: {selectedUser?.email || "Select a user"}</p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-ink">Subject<input required value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className="rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-ink" /></label>
            <label className="grid gap-2 text-sm font-bold text-ink">Message<textarea required rows={10} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="resize-none rounded-lg border border-line px-3 py-3 text-sm outline-none focus:border-ink" /></label>
            <div className="flex justify-end"><button disabled={sending || !selectedUser} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"><FiSend /> {sending ? "Sending..." : "Send email"}</button></div>
          </div>
        </form>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">My email history</h2>
        <div className="mt-4 grid gap-3 sm:hidden">
          {history.length ? history.map((item) => (
            <article key={item.id} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{item.recipientName || "User"}</p>
                  <p className="mt-1 break-all text-xs text-muted">{item.recipientEmail}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "SENT" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.status}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-ink">{item.subject}</p>
              <p className="mt-2 text-xs text-muted">{formatDate(item.createdAt)}</p>
            </article>
          )) : <p className="rounded-xl bg-bg-soft p-4 text-center text-sm text-muted">No email history yet.</p>}
        </div>
        <div className="mt-4 hidden overflow-x-auto sm:block"><table className="min-w-full text-left text-sm"><thead className="bg-bg-soft text-xs uppercase text-muted"><tr><th className="px-3 py-3">Recipient</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Sent</th></tr></thead><tbody className="divide-y divide-line">{history.length ? history.map((item) => <tr key={item.id}><td className="px-3 py-3"><p className="font-semibold text-ink">{item.recipientName || "User"}</p><p className="text-xs text-muted">{item.recipientEmail}</p></td><td className="px-3 py-3 text-ink">{item.subject}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "SENT" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.status}</span></td><td className="px-3 py-3 text-xs text-muted">{formatDate(item.createdAt)}</td></tr>) : <tr><td colSpan="4" className="px-3 py-8 text-center text-muted">No email history yet.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}
