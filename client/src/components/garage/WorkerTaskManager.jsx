import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCopy,
  FiExternalLink,
  FiRefreshCw,
  FiSend,
  FiSlash,
  FiSmartphone,
} from "react-icons/fi";
import { workerTaskApi } from "@/api/workerTasks";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const getBookingId = (booking) => booking?.bookingId || booking?.id;

const getDefaultTaskType = (booking) => {
  if (booking?.status === "CONFIRMED" && !booking?.handoverOtpVerifiedAt) {
    return "HANDOVER";
  }
  return "DELIVERY";
};

const getAvailableTaskTypes = (booking) => {
  const values = [];
  if (booking?.status === "CONFIRMED" && !booking?.handoverOtpVerifiedAt) {
    values.push("HANDOVER");
  }
  if (
    booking?.status === "IN_PROGRESS" &&
    booking?.handoverOtpVerifiedAt &&
    !booking?.deliveredAt
  ) {
    values.push("DELIVERY");
  }
  return values;
};

const statusClass = (status) => {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["REVOKED", "EXPIRED"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-800";
};

export default function WorkerTaskManager({ booking, garage }) {
  const bookingId = getBookingId(booking);
  const enabled = garage?.controllerAccountsEnabled === false;
  const isSelfDropOff = booking?.fulfillmentType === "SELF_DROP_OFF";
  const availableTaskTypes = useMemo(() => getAvailableTaskTypes(booking), [booking]);
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({
    workerName: "",
    workerPhone: "",
    taskType: getDefaultTaskType(booking),
    expiresInHours: 12,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [latestLink, setLatestLink] = useState("");
  const [latestWhatsappLink, setLatestWhatsappLink] = useState("");

  const loadTasks = useCallback(async () => {
    if (!enabled || !bookingId) return;
    setLoading(true);
    setError("");
    try {
      const result = await workerTaskApi.list(bookingId);
      setTasks(Array.isArray(result?.tasks) ? result.tasks : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load worker tasks");
    } finally {
      setLoading(false);
    }
  }, [bookingId, enabled]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      taskType: availableTaskTypes.includes(current.taskType)
        ? current.taskType
        : availableTaskTypes[0] || getDefaultTaskType(booking),
    }));
  }, [availableTaskTypes, booking]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (!enabled || !bookingId) return null;

  const createTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await workerTaskApi.create(bookingId, {
        ...form,
        expiresInHours: Number(form.expiresInHours),
      });
      setLatestLink(result?.taskUrl || "");
      setLatestWhatsappLink(result?.delivery?.whatsappLink || "");
      setSuccess(
        result?.delivery?.sent
          ? "Worker task sent on WhatsApp."
          : "Task created. Copy the link below if WhatsApp could not send automatically.",
      );
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create worker task");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (value) => {
    if (!value) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      window.prompt("Copy worker task link", value);
    }
    setSuccess("Worker task link copied.");
  };

  const resend = async (taskId) => {
    setSaving(true);
    setError("");
    try {
      const result = await workerTaskApi.resend(taskId, {
        expiresInHours: Number(form.expiresInHours),
      });
      setLatestLink(result?.taskUrl || "");
      setLatestWhatsappLink(result?.delivery?.whatsappLink || "");
      setSuccess(
        result?.delivery?.sent
          ? "A fresh task link was sent on WhatsApp."
          : "A fresh task link was generated. Copy it below.",
      );
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to resend worker task");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (taskId) => {
    if (!window.confirm("Revoke this worker task link immediately?")) return;
    setSaving(true);
    setError("");
    try {
      await workerTaskApi.revoke(taskId);
      setSuccess("Worker task revoked.");
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to revoke worker task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FiSmartphone className="text-lg" />
            <h3 className="font-bold text-ink">No-account worker task</h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            Assign this booking through WhatsApp. The worker opens one secure task
            and uploads required evidence without a controller login. Pickup and delivery
            journeys can also share live location.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTasks}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      {latestLink && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-bg-soft p-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all text-xs text-ink">{latestLink}</code>
          <button type="button" onClick={() => copyLink(latestLink)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold">
            <FiCopy /> Copy
          </button>
          <a href={latestLink} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold">
            <FiExternalLink /> Open
          </a>
          {latestWhatsappLink && (
            <a href={latestWhatsappLink} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white">
              <FiSend /> Open WhatsApp
            </a>
          )}
        </div>
      )}

      {availableTaskTypes.length > 0 ? (
        <form onSubmit={createTask} className="mt-4 grid gap-3 rounded-xl border border-line bg-bg-soft p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            Worker name
            <input required minLength={2} maxLength={120} value={form.workerName} onChange={(event) => setForm({ ...form, workerName: event.target.value })} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink" placeholder="Ramesh" />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            WhatsApp phone
            <input required value={form.workerPhone} onChange={(event) => setForm({ ...form, workerPhone: event.target.value })} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink" placeholder="+91 98765 43210" />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            Task
            <select value={form.taskType} onChange={(event) => setForm({ ...form, taskType: event.target.value })} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink">
              {availableTaskTypes.includes("HANDOVER") && (
                <option value="HANDOVER">
                  {isSelfDropOff ? "Vehicle handover at garage" : "Pickup / vehicle handover"}
                </option>
              )}
              {availableTaskTypes.includes("DELIVERY") && (
                <option value="DELIVERY">
                  {isSelfDropOff ? "Ready-for-self-pickup evidence" : "Vehicle delivery"}
                </option>
              )}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            Valid for
            <select value={form.expiresInHours} onChange={(event) => setForm({ ...form, expiresInHours: event.target.value })} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink">
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
            </select>
          </label>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-50 md:col-span-2 xl:col-span-4">
            <FiSend /> {saving ? "Creating…" : "Assign and send WhatsApp"}
          </button>
        </form>
      ) : (
        <div className="mt-4 rounded-lg border border-line bg-bg-soft p-3 text-sm text-muted">
          A task can be created after garage acceptance for handover, or during service for delivery.
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {tasks.map((task) => (
          <article key={task.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-ink">{task.workerName}</strong>
                  <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusClass(task.status)}`}>{task.status}</span>
                  <span className="rounded-md border border-line bg-bg-soft px-2 py-1 text-xs font-bold text-muted">{task.taskType}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{task.workerPhone} · Expires {formatDateTime(task.expiresAt)}</p>
                <p className="mt-1 text-xs text-muted">Opened {formatDateTime(task.openedAt)} · Last location {formatDateTime(task.lastLocationAt)}</p>
              </div>
              {!["COMPLETED", "REVOKED"].includes(task.status) && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => resend(task.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold"><FiSend /> New link</button>
                  <button type="button" disabled={saving} onClick={() => revoke(task.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700"><FiSlash /> Revoke</button>
                </div>
              )}
            </div>
          </article>
        ))}
        {!loading && tasks.length === 0 && <p className="text-sm text-muted">No worker task has been created for this booking.</p>}
      </div>
    </section>
  );
}
