import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import {
  FiCheckCircle,
  FiMail,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiUser,
} from "react-icons/fi";

const roles = [
  { value: "", label: "All roles" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "GARAGE_OWNER", label: "Garage owners" },
];

export default function AdminEmail() {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ search: "", role: "" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedEmail = selectedUser?.email || "";

  const userParams = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    [filters]
  );

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError("");

    try {
      const data = await adminApi.searchEmailUsers(userParams);
      setUsers(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadUsers, 250);
    return () => clearTimeout(timer);
  }, [userParams]);

  const selectUser = (user) => {
    setSelectedUser(user);
    setSuccess("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");

    try {
      if (!selectedUser?.id) {
        throw new Error("Select a user before sending email");
      }

      await adminApi.sendUserEmail({
        userId: selectedUser.id,
        subject: form.subject,
        message: form.message,
      });

      setSuccess(`Email sent to ${selectedUser.email}.`);
      setForm({ subject: "", message: "" });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-ink">Email Users</h2>
        <p className="text-sm text-muted">
          Send email messages to registered Rovauto users.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <FiCheckCircle className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="card-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-ink">Users</h3>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loadingUsers}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={loadingUsers ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                placeholder="Search users"
                className="w-full rounded-lg border border-line py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-ink"
              />
            </label>

            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none transition focus:border-ink"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {loadingUsers ? (
              <div className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
                Loading users...
              </div>
            ) : users.length ? (
              users.map((user) => {
                const selected = selectedUser?.id === user.id;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => selectUser(user)}
                    className={[
                      "group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                      selected
                        ? "border-ink bg-ink text-white shadow-sm"
                        : "border-line bg-white text-ink hover:border-ink hover:bg-bg-soft",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        selected
                          ? "bg-white/15 text-white"
                          : "bg-bg-soft text-muted group-hover:text-ink",
                      ].join(" ")}
                    >
                      <FiUser />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {user.name || "Unnamed user"}
                        </span>

                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            selected
                              ? "bg-white/15 text-white"
                              : "bg-bg-soft text-muted",
                          ].join(" ")}
                        >
                          {user.role?.replace("_", " ") || "USER"}
                        </span>
                      </div>

                      <span
                        className={[
                          "mt-1 block truncate text-xs",
                          selected ? "text-white/75" : "text-muted",
                        ].join(" ")}
                      >
                        {user.email}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
                No users found.
              </div>
            )}
          </div>
        </section>

        <form onSubmit={submit} className="card-soft p-5">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-ink">Compose Email</h3>
            <p className="text-sm text-muted">
              Select a user from the left and write your message.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Recipient email
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={selectedEmail}
                  placeholder="Select a user"
                  readOnly
                  className="w-full rounded-lg border border-line bg-bg-soft py-2.5 pl-10 pr-3 text-sm outline-none"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Subject
              <input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Email subject"
                className="rounded-lg border border-line px-3 py-2.5 text-sm outline-none transition focus:border-ink"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Message
              <textarea
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Write your message"
                rows={9}
                className="resize-none rounded-lg border border-line px-3 py-2.5 text-sm outline-none transition focus:border-ink"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !selectedUser}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSend />
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
