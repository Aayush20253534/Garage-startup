import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle,
  FiBell,
  FiCheckCircle,
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
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const findCustomers = async (term = search) => {
    try {
      setSearching(true);
      setError("");
      const result = await customerSupportApi.searchEmailUsers({
        role: "CUSTOMER",
        search: term.trim(),
      });
      setCustomers(Array.isArray(result) ? result : []);
    } catch (err) {
      setCustomers([]);
      setError(
        err.response?.data?.message || err.message || "Unable to find customers",
      );
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    void findCustomers("");
  }, []);

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "audience" ? { userId: "", city: "" } : {}),
    }));
    setError("");
    setSuccess("");
  };

  const sendNotification = async (event) => {
    event.preventDefault();

    try {
      setSending(true);
      setError("");
      setSuccess("");

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
      setSuccess(
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
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send customer notification",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Customer communication
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink">
              <FiSend /> Send notifications
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Send an in-app and Web Push message to one customer, customers in a
              city, or every active customer.
            </p>
          </div>
          <Link
            to="/support/notify"
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft sm:w-auto"
          >
            <FiBell /> Open received alerts
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-ink">Send customer notification</h2>
          <p className="mt-1 text-sm text-muted">
            Use broad audiences only for messages approved for every affected customer.
          </p>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <FiAlertCircle className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            <FiCheckCircle className="mt-0.5 shrink-0" /> {success}
          </div>
        )}

        <form onSubmit={sendNotification} className="mt-5 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
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
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
            >
              <FiSend /> {sending ? "Sending..." : "Send notification"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
