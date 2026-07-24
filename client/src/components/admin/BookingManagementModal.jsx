import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { formatRupees } from "@/utils/priceRange";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiHome,
  FiMapPin,
  FiRefreshCw,
  FiSave,
  FiUser,
  FiX,
} from "react-icons/fi";

const statuses = [
  "PENDING_PAYMENT",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];

const formatStatus = (status) => status?.replaceAll("_", " ") || "-";
const formatDateTime = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-";

const getStatusClass = (status) => {
  if (["COMPLETED", "CONFIRMED"].includes(status)) return "bg-lime-100 text-ink";
  if (["CANCELLED", "EXPIRED"].includes(status)) return "bg-red-50 text-red-700";
  if (["IN_PROGRESS", "GARAGE_ASSIGNED"].includes(status)) return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-800";
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const toLocalDateTimeInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const buildOverrideForm = (booking = {}) => ({
  reason: "",
  scheduledDate: toLocalDateTimeInput(booking.scheduledDate),
  acceptedAt: toLocalDateTimeInput(booking.acceptedAt),
  deliveredAt: toLocalDateTimeInput(booking.deliveredAt),
  customerAcceptedAt: toLocalDateTimeInput(booking.customerAcceptedAt),
  startTime: booking.startTime || "",
  endTime: booking.endTime || "",
  customerAddress: booking.customerAddress || "",
  handlingFee: booking.handlingFee ?? "",
  payableAmount: booking.payableAmount ?? "",
  totalServiceAmount: booking.totalServiceAmount ?? "",
  totalServiceMaxAmount: booking.totalServiceMaxAmount ?? "",
  searchExpiresAt: toLocalDateTimeInput(booking.searchExpiresAt),
  servicePrices: (booking.services || []).map((item) => ({
    bookingServiceId: item.id,
    serviceName: item.service?.name || "Service",
    finalPrice: item.finalPrice ?? "",
    estimate: item.estimatedPrice ?? item.estimatedMinPrice ?? null,
  })),
});

export default function BookingManagementModal({ bookingId, isAdmin, onClose, onUpdated }) {
  const [booking, setBooking] = useState(null);
  const [garages, setGarages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusForm, setStatusForm] = useState({ status: "", note: "" });
  const [garageForm, setGarageForm] = useState({ garageId: "", note: "" });
  const [internalNote, setInternalNote] = useState("");
  const [overrideForm, setOverrideForm] = useState(() => buildOverrideForm());
  const [overrideInitial, setOverrideInitial] = useState(() => buildOverrideForm());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingData, garageData] = await Promise.all([
        adminApi.getBooking(bookingId),
        isAdmin ? adminApi.getGarages({ isActive: true }) : Promise.resolve([]),
      ]);
      setBooking(bookingData);
      setGarages(Array.isArray(garageData) ? garageData : []);
      setStatusForm((current) => ({ ...current, status: bookingData.status || "" }));
      setGarageForm((current) => ({ ...current, garageId: bookingData.garageId || "" }));
      const nextOverrideForm = buildOverrideForm(bookingData);
      setOverrideForm(nextOverrideForm);
      setOverrideInitial(nextOverrideForm);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load booking details"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [bookingId]);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const serviceTotal = useMemo(
    () => (booking?.services || []).reduce((sum, item) => sum + Number(item.finalPrice ?? item.estimatedPrice ?? item.estimatedMinPrice ?? 0), 0),
    [booking],
  );

  const finishAction = async (updated, message) => {
    setBooking(updated);
    setStatusForm({ status: updated.status || "", note: "" });
    setGarageForm({ garageId: updated.garageId || "", note: "" });
    setInternalNote("");
    const nextOverrideForm = buildOverrideForm(updated);
    setOverrideForm(nextOverrideForm);
    setOverrideInitial(nextOverrideForm);
    setSuccess(message);
    onUpdated?.(updated);
  };

  const saveStatus = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await adminApi.updateBookingStatus(bookingId, statusForm);
      await finishAction(updated, "Booking status updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update booking status"));
    } finally {
      setSaving(false);
    }
  };

  const saveGarage = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await adminApi.reassignBookingGarage(bookingId, garageForm);
      await finishAction(updated, "Garage assignment updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to assign garage"));
    } finally {
      setSaving(false);
    }
  };

  const saveOverride = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload = { reason: overrideForm.reason.trim() };
      const dateFields = ["scheduledDate", "searchExpiresAt", "acceptedAt", "deliveredAt", "customerAcceptedAt"];
      const textFields = ["startTime", "endTime", "customerAddress"];
      const numberFields = ["handlingFee", "payableAmount", "totalServiceAmount", "totalServiceMaxAmount"];

      dateFields.forEach((key) => {
        if (overrideForm[key] !== overrideInitial[key]) {
          payload[key] = overrideForm[key] ? new Date(overrideForm[key]).toISOString() : null;
        }
      });
      textFields.forEach((key) => {
        if (overrideForm[key] !== overrideInitial[key]) payload[key] = overrideForm[key] || null;
      });
      numberFields.forEach((key) => {
        if (String(overrideForm[key]) !== String(overrideInitial[key])) {
          payload[key] = Number(overrideForm[key] || 0);
        }
      });

      const initialPrices = new Map(
        (overrideInitial.servicePrices || []).map((item) => [item.bookingServiceId, item.finalPrice]),
      );
      const changedServicePrices = (overrideForm.servicePrices || [])
        .filter((item) => String(item.finalPrice) !== String(initialPrices.get(item.bookingServiceId) ?? ""))
        .map((item) => ({
          bookingServiceId: item.bookingServiceId,
          finalPrice: item.finalPrice === "" ? null : Number(item.finalPrice),
        }));
      if (changedServicePrices.length) payload.servicePrices = changedServicePrices;

      if (Object.keys(payload).length === 1) {
        throw new Error("Change at least one field before saving the override");
      }
      const updated = await adminApi.manualOverrideBooking(bookingId, payload);
      await finishAction(updated, "Manual booking override saved.");
    } catch (err) { setError(getErrorMessage(err, "Unable to save manual override")); } finally { setSaving(false); }
  };

  const addNote = async (event) => {
    event.preventDefault();
    if (!internalNote.trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await adminApi.addBookingNote(bookingId, internalNote.trim());
      await finishAction(updated, "Internal note added.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add internal note"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-black/65 px-3 py-4 sm:px-6 sm:py-8"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section role="dialog" aria-modal="true" className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-bg-soft shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Booking management</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-ink">#{booking?.bookingCode || bookingId.slice(0, 8)}</h3>
              {booking?.status && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClass(booking.status)}`}>{formatStatus(booking.status)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} disabled={loading} className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink">
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
            </button>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink"><FiX /></button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {error && <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><FiAlertCircle />{error}</div>}
          {success && <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"><FiCheckCircle />{success}</div>}

          {loading && !booking ? (
            <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">Loading booking details...</div>
          ) : booking ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-ink"><FiUser /> Customer</div>
                    <p className="mt-3 text-lg font-bold text-ink">{booking.user?.name || "-"}</p>
                    <p className="mt-1 text-sm text-muted">{booking.user?.email || "-"}</p>
                    <p className="mt-1 text-sm text-muted">{booking.user?.phone || "-"}</p>
                    <p className="mt-3 flex items-start gap-2 text-sm text-muted"><FiMapPin className="mt-0.5 shrink-0" />{booking.customerAddress || booking.user?.customerProfile?.address || "Address unavailable"}</p>
                  </article>

                  <article className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-ink"><FiHome /> Assigned garage</div>
                    <p className="mt-3 text-lg font-bold text-ink">{booking.garage?.name || "Unassigned"}</p>
                    <p className="mt-1 text-sm text-muted">{booking.garage?.city || "-"}</p>
                    <p className="mt-1 text-sm text-muted">{booking.garage?.phone || "-"}</p>
                    <p className="mt-3 text-xs text-muted">Accepted: {formatDateTime(booking.acceptedAt)}</p>
                  </article>
                </div>

                <article className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-ink">Vehicle and services</h4>
                      <p className="mt-1 text-sm text-muted">
                        {booking.vehicle?.brand} {booking.vehicle?.model} {booking.vehicle?.registrationNumber ? `· ${booking.vehicle.registrationNumber}` : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-bg-soft px-3 py-2 text-sm font-bold text-ink">{formatRupees(booking.totalServiceAmount || serviceTotal)}</span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {(booking.services || []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg-soft px-3 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-ink">{item.service?.name || "Service"}</p>
                          <p className="text-xs text-muted">{item.service?.category?.name || ""}</p>
                        </div>
                        <span className="font-bold text-ink">{formatRupees(item.finalPrice ?? item.estimatedPrice ?? item.estimatedMinPrice ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border border-line bg-white p-4">
                  <h4 className="font-bold text-ink">Payment and scheduling</h4>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl bg-bg-soft p-3"><p className="text-xs text-muted">Payment</p><p className="mt-1 font-bold text-ink">{booking.payment?.status || "Not created"}</p></div>
                    <div className="rounded-xl bg-bg-soft p-3"><p className="text-xs text-muted">Payable</p><p className="mt-1 font-bold text-ink">{formatRupees(booking.payableAmount || booking.payment?.amount || 0)}</p></div>
                    <div className="rounded-xl bg-bg-soft p-3"><p className="text-xs text-muted">Scheduled</p><p className="mt-1 font-bold text-ink">{formatDateTime(booking.scheduledDate)}</p></div>
                  </div>
                </article>

                <article className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center gap-2"><FiClock className="text-muted" /><h4 className="font-bold text-ink">Booking timeline</h4></div>
                  <div className="mt-4 grid gap-0">
                    {(booking.timeline || []).map((event, index) => (
                      <div key={event.id} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                        <div className="relative flex justify-center">
                          <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${event.type === "ADMIN" ? "bg-blue-500" : "bg-ink"}`} />
                          {index < booking.timeline.length - 1 && <span className="absolute bottom-0 top-4 w-px bg-line" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-bold text-ink">{event.title}</p>
                            <time className="text-xs text-muted">{formatDateTime(event.date)}</time>
                          </div>
                          {event.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{event.detail}</p>}
                          {event.metadata?.actorName && <p className="mt-1 text-xs font-semibold text-blue-700">By {event.metadata.actorName}{event.metadata.actorRole ? ` · ${formatStatus(event.metadata.actorRole)}` : ""}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                {(booking.reassignments || []).length > 0 && (
                  <article className="rounded-2xl border border-line bg-white p-4">
                    <h4 className="font-bold text-ink">Garage reassignment history</h4>
                    <div className="mt-3 grid gap-3">
                      {booking.reassignments.map((item) => (
                        <div key={item.id} className="rounded-xl bg-bg-soft p-3 text-sm">
                          <p className="font-bold text-ink">{item.previousGarageName || "Unassigned"} → {item.newGarageName}</p>
                          <p className="mt-1 text-xs text-muted">{item.reason || "No reason recorded"}</p>
                          <p className="mt-1 text-xs font-semibold text-blue-700">By {item.actorName} · {formatStatus(item.actorRole)} · {formatDateTime(item.createdAt)}</p>
                          <p className="mt-1 text-xs text-muted">Customer notification: {item.customerNotified ? "sent" : "not confirmed"}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              </div>

              <aside className="space-y-4">
                {isAdmin ? (
                  <>
                    <form onSubmit={saveStatus} className="rounded-2xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2"><FiEdit3 className="text-muted" /><h4 className="font-bold text-ink">Change status</h4></div>
                      <select value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })} className="mt-4 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink">
                        {statuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                      </select>
                      <textarea value={statusForm.note} onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })} placeholder="Reason or context (optional)" rows="3" className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink" />
                      <button type="submit" disabled={saving || statusForm.status === booking.status} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-50"><FiSave />Save status</button>
                    </form>

                    <form onSubmit={saveGarage} className="rounded-2xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2"><FiHome className="text-muted" /><h4 className="font-bold text-ink">Assign or reassign garage</h4></div>
                      <select required value={garageForm.garageId} onChange={(event) => setGarageForm({ ...garageForm, garageId: event.target.value })} className="mt-4 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink">
                        <option value="">Select active garage</option>
                        {garages.map((garage) => <option key={garage.id} value={garage.id}>{garage.name} · {garage.city}</option>)}
                      </select>
                      <textarea value={garageForm.note} onChange={(event) => setGarageForm({ ...garageForm, note: event.target.value })} placeholder="Reason for assignment (optional)" rows="3" className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink" />
                      <button type="submit" disabled={saving || !garageForm.garageId || garageForm.garageId === booking.garageId} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-bold text-black disabled:opacity-50"><FiSave />Assign garage</button>
                    </form>

                    <form onSubmit={saveOverride} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2"><FiEdit3 className="text-amber-700" /><h4 className="font-bold text-ink">Manual override</h4></div>
                      <p className="mt-1 text-xs text-muted">Use only when automatic values need operational correction. Every changed field is permanently recorded.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-bold text-muted">Scheduled date<input type="datetime-local" value={overrideForm.scheduledDate} onChange={(e)=>setOverrideForm({...overrideForm,scheduledDate:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink" /></label>
                        <label className="text-xs font-bold text-muted">Search expiry<input type="datetime-local" value={overrideForm.searchExpiresAt} onChange={(e)=>setOverrideForm({...overrideForm,searchExpiresAt:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink" /></label>
                        <label className="text-xs font-bold text-muted">Accepted at<input type="datetime-local" value={overrideForm.acceptedAt} onChange={(e)=>setOverrideForm({...overrideForm,acceptedAt:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink" /></label>
                        <label className="text-xs font-bold text-muted">Delivered at<input type="datetime-local" value={overrideForm.deliveredAt} onChange={(e)=>setOverrideForm({...overrideForm,deliveredAt:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink" /></label>
                        <label className="text-xs font-bold text-muted">Customer accepted at<input type="datetime-local" value={overrideForm.customerAcceptedAt} onChange={(e)=>setOverrideForm({...overrideForm,customerAcceptedAt:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink" /></label>
                        <label className="text-xs font-bold text-muted">Start time<input type="time" value={overrideForm.startTime} onChange={(e)=>setOverrideForm({...overrideForm,startTime:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm" /></label>
                        <label className="text-xs font-bold text-muted">End time<input type="time" value={overrideForm.endTime} onChange={(e)=>setOverrideForm({...overrideForm,endTime:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm" /></label>
                        {[["handlingFee","Handling fee"],["payableAmount","Payable amount"],["totalServiceAmount","Service amount"],["totalServiceMaxAmount","Service max amount"]].map(([key,label])=><label key={key} className="text-xs font-bold text-muted">{label}<input type="number" min="0" value={overrideForm[key]} onChange={(e)=>setOverrideForm({...overrideForm,[key]:e.target.value})} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm" /></label>)}
                      </div>
                      {(overrideForm.servicePrices || []).length > 0 && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted">Final service prices</p>
                          <div className="mt-2 grid gap-2">
                            {overrideForm.servicePrices.map((item, index) => (
                              <label key={item.bookingServiceId} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-2 text-xs font-semibold text-ink">
                                <span className="truncate">{item.serviceName}</span>
                                <input type="number" min="0" value={item.finalPrice} placeholder={item.estimate == null ? "Unset" : `Est. ${item.estimate}`} onChange={(e)=>setOverrideForm((current)=>({ ...current, servicePrices: current.servicePrices.map((entry, entryIndex)=>entryIndex===index?{...entry,finalPrice:e.target.value}:entry) }))} className="h-9 rounded-lg border border-line px-2 text-sm" />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <textarea value={overrideForm.customerAddress} onChange={(e)=>setOverrideForm({...overrideForm,customerAddress:e.target.value})} placeholder="Customer service address" rows="2" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
                      <textarea required minLength="5" value={overrideForm.reason} onChange={(e)=>setOverrideForm({...overrideForm,reason:e.target.value})} placeholder="Required reason for manual override" rows="3" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
                      <button type="submit" disabled={saving || overrideForm.reason.trim().length < 5} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white disabled:opacity-50"><FiSave />Save manual override</button>
                    </form>

                    <form onSubmit={addNote} className="rounded-2xl border border-line bg-white p-4">
                      <h4 className="font-bold text-ink">Internal admin note</h4>
                      <p className="mt-1 text-xs text-muted">Visible only in the staff booking timeline.</p>
                      <textarea required value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Add investigation, support or operational context" rows="4" className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink" />
                      <button type="submit" disabled={saving || !internalNote.trim()} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink hover:border-ink disabled:opacity-50"><FiSave />Add note</button>
                    </form>
                  </>
                ) : (
                  <div className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">Intern access is read-only. An admin can change status, garage assignment, or add internal notes.</div>
                )}

                {(booking.complaints || []).length > 0 && (
                  <article className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <h4 className="font-bold text-red-800">Complaints</h4>
                    <div className="mt-3 grid gap-2">
                      {booking.complaints.map((complaint) => <div key={complaint.id} className="rounded-xl bg-white/80 p-3 text-sm"><p className="font-bold text-ink">{complaint.title}</p><p className="mt-1 text-xs text-muted">{complaint.status} · {formatDateTime(complaint.createdAt)}</p></div>)}
                    </div>
                  </article>
                )}

                <article className="rounded-2xl border border-line bg-white p-4 text-sm">
                  <div className="flex items-center gap-2 font-bold text-ink"><FiCalendar /> System dates</div>
                  <dl className="mt-3 grid gap-2 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-muted">Created</dt><dd className="font-semibold text-ink">{formatDateTime(booking.createdAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Last updated</dt><dd className="font-semibold text-ink">{formatDateTime(booking.updatedAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Delivered</dt><dd className="font-semibold text-ink">{formatDateTime(booking.deliveredAt)}</dd></div>
                  </dl>
                </article>
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
