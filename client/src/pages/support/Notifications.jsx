import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle,
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiRefreshCw,
  FiSearch,
  FiSend,
} from "react-icons/fi";

import { customerSupportApi } from "@/api/customerSupport";
import CitySelect from "@/components/common/CitySelect";

const NOTIFICATION_TYPES = [
  "SYSTEM",
  "PROMOTION",
  "BOOKING",
  "PAYMENT",
  "WARRANTY",
  "SOS",
];

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const initialForm = {
  audience: "USER",
  userId: "",
  city: "",
  title: "",
  message: "",
  type: "SYSTEM",
  link: "",
};

export default function CustomerSupportNotifications() {
  const [data, setData] = useState({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");

  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setInboxError("");
      const result = await customerSupportApi.getNotifications();
      setData(result || { items: [], unreadCount: 0 });
      window.dispatchEvent(
        new CustomEvent("rov:support-notifications-updated", {
          detail: { unreadCount: result?.unreadCount || 0 },
        }),
      );
    } catch (err) {
      setInboxError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load support notifications",
      );
    } finally {
      setLoading(false);
    }
  };

  const findCustomers = async (term = search) => {
    try {
      setSearching(true);
      setSendError("");
      const result = await customerSupportApi.searchEmailUsers({
        role: "CUSTOMER",
        search: term.trim(),
      });
      setCustomers(Array.isArray(result) ? result : []);
    } catch (err) {
      setCustomers([]);
      setSendError(
        err.response?.data?.message || err.message || "Unable to find customers",
      );
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    void load();
    void findCustomers("");
  }, []);

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "audience" ? { userId: "", city: "" } : {}),
    }));
    setSendError("");
    setSendSuccess("");
  };

  const sendNotification = async (event) => {
    event.preventDefault();

    try {
      setSending(true);
      setSendError("");
      setSendSuccess("");

      const result = await customerSupportApi.sendCustomerNotification({
        audience: form.audience,
        userId: form.audience === "USER" ? form.userId : undefined,
        city: form.audience === "CITY" ? form.city : undefined,
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        link: form.link.trim() || undefined,
      });

      const sentCount = Number(result?.sent);
      setSendSuccess(
        form.audience === "CITY"
          ? `Notification sent to ${Number.isFinite(sentCount) ? sentCount : 0} customer${sentCount === 1 ? "" : "s"}.`
          : form.audience === "ALL"
            ? "Notification sent to all active customers."
            : "Notification sent to the selected customer.",
      );
      setForm((current) => ({
        ...current,
        title: "",
        message: "",
        link: "",
      }));
    } catch (err) {
      setSendError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send customer notification",
      );
    } finally {
      setSending(false);
    }
  };

  const markRead = async (item) => {
    if (!item.isRead) {
      await customerSupportApi.markNotificationRead(item.id);
      setData((current) => {
        const unreadCount = Math.max((current.unreadCount || 0) - 1, 0);
        window.dispatchEvent(
          new CustomEvent("rov:support-notifications-updated", {
            detail: { unreadCount },
          }),
        );
        return {
          items: current.items.map((entry) =>
            entry.id === item.id ? { ...entry, isRead: true } : entry,
          ),
          unreadCount,
        };
      });
    }
  };

  const markAll = async () => {
    await customerSupportApi.markAllNotificationsRead();
    setData((current) => ({
      items: current.items.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
    }));
    window.dispatchEvent(
      new CustomEvent("rov:support-notifications-updated", {
        detail: { unreadCount: 0 },
      }),
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
          Customer communication
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink">
          <FiBell /> Notifications
        </h1>
        <p className="mt-2 text-sm text-muted">
          Send an in-app and Web Push notification to one customer, a city, or all
          active customers. Your private support inbox appears below.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-ink">Send customer notification</h2>
          <p className="mt-1 text-sm text-muted">
            Use broad audiences only for messages approved for every affected customer.
          </p>
        </div>

        {sendError && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <FiAlertCircle className="mt-0.5 shrink-0" /> {sendError}
          </div>
        )}
        {sendSuccess && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            <FiCheckCircle className="mt-0.5 shrink-0" /> {sendSuccess}
          </div>
        )}

        <form onSubmit={sendNotification} className="mt-5 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Audience
              <select
                value={form.audience}
                onChange={(event) => updateForm("audience", event.target.value)}
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
              >
                <option value="USER">Specific customer</option>
                <option value="CITY">Customers by city</option>
                <option value="ALL">All active customers</option>
              </select>
            </label>

            {form.audience === "CITY" && (
              <label className="grid gap-2 text-sm font-bold text-ink">
                City
                <CitySelect
                  required
                  value={form.city}
                  onChange={(value) => updateForm("city", value)}
                  placeholder="Select city"
                  className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
                />
              </label>
            )}

            <label className="grid gap-2 text-sm font-bold text-ink">
              Type
              <select
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value)}
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
              >
                {NOTIFICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.audience === "USER" && (
            <div className="rounded-xl border border-line bg-bg-soft p-4">
              <label className="text-sm font-bold text-ink">Customer</label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-3.5 text-muted" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, email, or phone"
                    className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none focus:border-ink"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void findCustomers(search)}
                  disabled={searching}
                  className="h-11 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
              <select
                required
                value={form.userId}
                onChange={(event) => updateForm("userId", event.target.value)}
                className="mt-3 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} — {customer.email || customer.phone || "No contact"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="grid gap-2 text-sm font-bold text-ink">
            Title
            <input
              required
              maxLength={160}
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              placeholder="Notification title"
              className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink">
            Message
            <textarea
              required
              maxLength={1000}
              rows={5}
              value={form.message}
              onChange={(event) => updateForm("message", event.target.value)}
              placeholder="Write the customer message"
              className="resize-none rounded-lg border border-line px-3 py-3 text-sm outline-none focus:border-ink"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink">
            Link <span className="font-normal text-muted">(optional)</span>
            <input
              maxLength={500}
              value={form.link}
              onChange={(event) => updateForm("link", event.target.value)}
              placeholder="Example: /dashboard/bookings"
              className="h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink"
            />
          </label>

          <div className="flex justify-end border-t border-line pt-4">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              <FiSend /> {sending ? "Sending..." : "Send notification"}
            </button>
          </div>
        </form>
      </section>

      {inboxError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" /> {inboxError}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-ink">My support alerts</h2>
            <p className="mt-1 text-sm text-muted">
              New tickets, customer replies, and admin assignments.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-bold text-ink disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={!data.unreadCount}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              <FiCheck /> Mark all read
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Alert history</h3>
          <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-ink">
            {data.unreadCount || 0} unread
          </span>
        </div>

        <div className="mt-3 grid gap-3">
          {loading ? (
            <p className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
              Loading alerts...
            </p>
          ) : (data.items || []).length ? (
            data.items.map((item) => (
              <Link
                key={item.id}
                to={item.link || "/support/notifications"}
                onClick={() => void markRead(item)}
                className={`rounded-xl border p-4 transition hover:border-ink ${
                  item.isRead
                    ? "border-line bg-white"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {item.message}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  {!item.isRead && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                  )}
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
              No customer support alerts yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
