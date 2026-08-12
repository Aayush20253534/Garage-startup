import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiRefreshCw, FiSave, FiStar } from "react-icons/fi";
import { adminApi } from "@/api/admin";

const fieldClass = "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink disabled:bg-bg-soft disabled:text-muted";
const initial = { mode: "OFF", manualEnabled: false, startsAt: "", endsAt: "", active: false };
const localValue = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";

export default function IndependenceCampaign() {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const apply = (data) => setForm({
    ...initial,
    ...data,
    startsAt: localValue(data?.startsAt),
    endsAt: localValue(data?.endsAt),
  });

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      apply(await adminApi.getIndependenceCampaign());
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load campaign");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = { mode: form.mode };
      if (form.mode === "MANUAL") payload.manualEnabled = true;
      if (form.mode === "SCHEDULED") {
        if (!form.startsAt || !form.endsAt) throw new Error("Choose both schedule times");
        payload.startsAt = new Date(form.startsAt).toISOString();
        payload.endsAt = new Date(form.endsAt).toISOString();
      }
      apply(await adminApi.updateIndependenceCampaign(payload));
      setMessage(form.mode === "OFF" ? "Campaign deactivated." : "Campaign settings saved.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const manualSelected = form.mode === "MANUAL";
  const scheduledSelected = form.mode === "SCHEDULED";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Festival campaigns</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink sm:text-3xl"><FiStar className="text-orange-500" />Independence Day</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Controls the built-in Independence banner and restrained tricolour homepage accents. Manual and scheduled modes are mutually exclusive.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-bold"><FiRefreshCw className={loading ? "animate-spin" : ""} />Refresh</button>
        </div>
      </header>

      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><FiAlertTriangle className="mt-0.5 shrink-0" />{error}</div>}
      {message && <div className="flex gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><FiCheckCircle className="mt-0.5 shrink-0" />{message}</div>}

      <form onSubmit={save} className="space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="rounded-xl border border-line bg-bg-soft p-4">
          <div className="flex items-center justify-between gap-4"><div><p className="font-bold text-ink">Current public status</p><p className="text-sm text-muted">Mode: {form.mode}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${form.active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>{form.active ? "ACTIVE" : "INACTIVE"}</span></div>
        </div>

        <fieldset disabled={loading || saving} className="grid gap-3 sm:grid-cols-3">
          {[{ value: "OFF", label: "Deactivated", help: "Normal Rovauto homepage only" }, { value: "MANUAL", label: "Manual", help: "Active until an admin turns it off" }, { value: "SCHEDULED", label: "Scheduled", help: "Active only between selected times" }].map((option) => (
            <label key={option.value} className={`cursor-pointer rounded-xl border p-4 ${form.mode === option.value ? "border-orange-400 bg-orange-50" : "border-line"}`}>
              <input type="radio" name="mode" value={option.value} checked={form.mode === option.value} onChange={() => setForm({ ...form, mode: option.value })} className="mr-2" />
              <span className="font-bold text-ink">{option.label}</span><span className="mt-1 block text-xs leading-5 text-muted">{option.help}</span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-ink"><span className="mb-2 flex items-center gap-2"><FiClock />Starts at</span><input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} disabled={!scheduledSelected || saving} required={scheduledSelected} className={fieldClass} /></label>
          <label className="text-sm font-bold text-ink"><span className="mb-2 flex items-center gap-2"><FiClock />Ends at</span><input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} disabled={!scheduledSelected || saving} required={scheduledSelected} className={fieldClass} /></label>
        </div>

        <p className="text-xs leading-5 text-muted">{manualSelected ? "Scheduled fields are locked while Manual mode is selected." : scheduledSelected ? "Manual activation is unavailable while Scheduled mode is selected." : "Select Manual or Scheduled to activate the campaign."}</p>
        <button disabled={loading || saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white disabled:opacity-60"><FiSave />{saving ? "Saving..." : "Save campaign"}</button>
      </form>
    </div>
  );
}
