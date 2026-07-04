import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { FiCheckCircle, FiMail, FiRefreshCw, FiSearch, FiSend } from "react-icons/fi";

const roles = [
  { value: "", label: "All roles" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "GARAGE_OWNER", label: "Garage owners" },
  { value: "ADMIN", label: "Admins" },
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
    [filters],
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email</h2>
        <p className="text-muted">
          Send mail to registered Rovauto users.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700">
          <FiCheckCircle />
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
        <section className="card-soft p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px] lg:grid-cols-1">
            <label className="relative min-w-0">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                placeholder="Search name, email, phone"
                className="w-full rounded-xl border border-line py-3 pl-11 pr-4 outline-none focus:border-ink"
              />
            </label>

            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loadingUsers}
            className="btn-ghost mt-3 w-full justify-center !py-2"
          >
            <FiRefreshCw className={loadingUsers ? "animate-spin" : ""} />
            Refresh
          </button>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {loadingUsers ? (
              <div className="rounded-xl border border-line p-4 text-sm text-muted">
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
                      "w-full rounded-xl border p-4 text-left transition",
                      selected
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-white text-ink hover:border-ink",
                    ].join(" ")}
                  >
                    <span className="block truncate text-sm font-bold">
                      {user.name || "Unnamed user"}
                    </span>
                    <span
                      className={[
                        "mt-1 block truncate text-xs",
                        selected ? "text-white/75" : "text-muted",
                      ].join(" ")}
                    >
                      {user.email}
                    </span>
                    <span
                      className={[
                        "mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                        selected ? "bg-white/15 text-white" : "bg-bg-soft text-muted",
                      ].join(" ")}
                    >
                      {user.role?.replace("_", " ") || "USER"}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-line p-4 text-sm text-muted">
                No users found.
              </div>
            )}
          </div>
        </section>

        <form onSubmit={submit} className="card-soft grid gap-4 p-5">
          <label className="grid gap-2 text-sm font-medium">
            Recipient email
            <div className="relative">
              <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={selectedEmail}
                placeholder="Select a user"
                readOnly
                className="w-full rounded-xl border border-line bg-bg-soft py-3 pl-11 pr-4 outline-none"
              />
            </div>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Subject
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Email subject"
              className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Message
            <textarea
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Write message"
              rows={10}
              className="resize-none rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
            />
          </label>

          <button
            disabled={sending || !selectedUser}
            className="btn-primary w-full justify-center md:w-auto"
          >
            <FiSend />
            {sending ? "Sending..." : "Send Email"}
          </button>
        </form>
      </div>
    </div>
  );
}
