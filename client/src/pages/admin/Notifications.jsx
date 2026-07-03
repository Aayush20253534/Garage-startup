import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import CitySelect from "@/components/common/CitySelect";

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
    adminApi.getCustomers().then(setCustomers).catch(() => setCustomers([]));
  }, []);

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
      setSuccess(form.audience === "CITY" ? `Notification sent to ${result.sent || 0} users.` : "Notification sent.");
      setForm({ ...form, title: "", message: "", link: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send notification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notifications</h2>
        <p className="text-muted">Send notifications to everyone, a city audience, or a specific user.</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-xl bg-green-50 p-4 text-green-700">{success}</div>}

      <form onSubmit={submit} className="card-soft grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink">
            <option value="ALL">All users</option>
            <option value="CITY">Users by city</option>
            <option value="USER">Specific user</option>
          </select>

          {form.audience === "CITY" && (
            <CitySelect required value={form.city} onChange={(city) => setForm({ ...form, city })} placeholder="Select city" className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink" />
          )}

          {form.audience === "USER" && (
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink">
              <option value="">Select customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} - {customer.email}</option>)}
            </select>
          )}

          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink">
            {["SYSTEM", "PROMOTION", "BOOKING", "PAYMENT", "WARRANTY", "SOS"].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink" />
        <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" rows={5} className="resize-none rounded-xl border border-line px-4 py-3 outline-none focus:border-ink" />
        <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Optional link, e.g. /dashboard/bookings" className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink" />
        <button disabled={loading} className="btn-primary w-full md:w-auto">{loading ? "Sending..." : "Send Notification"}</button>
      </form>
    </div>
  );
}
