import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import CitySelect from "@/components/common/CitySelect";
import { FiBell, FiCheckCircle, FiSend, FiXCircle } from "react-icons/fi";

const notificationTypes = [
  "SYSTEM",
  "PROMOTION",
  "BOOKING",
  "PAYMENT",
  "WARRANTY",
  "SOS",
];

export default function Notifications() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    audience: "ALL",
    userId: "",
    city: "",
    title: "",
    message: "",
    type: "SYSTEM",
    link: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    adminApi
      .getCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, []);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "audience" && {
        city: "",
        userId: "",
      }),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await adminApi.sendNotification({
        audience: form.audience,
        userId: form.audience === "USER" ? form.userId : undefined,
        city: form.audience === "CITY" ? form.city : undefined,
        title: form.title,
        message: form.message,
        type: form.type,
        link: form.link || undefined,
      });

      setSuccess(
        form.audience === "CITY"
          ? `Notification sent to ${result.sent || 0} users.`
          : "Notification sent."
      );

      setForm((prev) => ({
        ...prev,
        title: "",
        message: "",
        link: "",
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send notification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Notifications</h2>
          <p className="mt-1 text-sm text-muted">
            Send notifications to all users, city users, or one specific user.
          </p>
        </div>

        <div className="hidden h-11 w-11 items-center justify-center rounded-xl bg-lime-100 text-xl text-ink md:flex">
          <FiBell />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiXCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <FiCheckCircle className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form
        onSubmit={submit}
        className="card-soft rounded-2xl p-4 shadow-sm md:p-5"
      >
        <div className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              Audience
              <select
                value={form.audience}
                onChange={(e) => updateForm("audience", e.target.value)}
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink"
              >
                <option value="ALL">All users</option>
                <option value="CITY">Users by city</option>
                <option value="USER">Specific user</option>
              </select>
            </label>

            {form.audience === "CITY" && (
              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                City
                <CitySelect
                  required
                  value={form.city}
                  onChange={(city) => updateForm("city", city)}
                  placeholder="Select city"
                  className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink"
                />
              </label>
            )}

            {form.audience === "USER" && (
              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Customer
                <select
                  required
                  value={form.userId}
                  onChange={(e) => updateForm("userId", e.target.value)}
                  className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.email}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              Type
              <select
                value={form.type}
                onChange={(e) => updateForm("type", e.target.value)}
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink"
              >
                {notificationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-semibold text-ink">
            Title
            <input
              required
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="Notification title"
              className="h-11 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-ink">
            Message
            <textarea
              required
              value={form.message}
              onChange={(e) => updateForm("message", e.target.value)}
              placeholder="Write notification message"
              rows={4}
              className="min-h-[120px] resize-none rounded-lg border border-line px-3 py-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-ink">
            Link
            <input
              value={form.link}
              onChange={(e) => updateForm("link", e.target.value)}
              placeholder="Optional link, e.g. /dashboard/bookings"
              className="h-11 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <div className="flex justify-end border-t border-line pt-4">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-lime-400 px-5 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSend />
              {loading ? "Sending..." : "Send Notification"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}