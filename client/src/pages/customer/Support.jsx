import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiImage,
  FiMessageSquare,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiShield,
  FiX,
} from "react-icons/fi";

import supportApi from "@/api/support";

const STATUS_LABELS = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  WAITING_CUSTOMER: "Waiting for you",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const CATEGORY_LABELS = {
  GENERAL: "General help",
  BOOKING: "Booking",
  PAYMENT: "Payment",
  GARAGE: "Garage",
  SERVICE: "Service quality",
  WARRANTY: "Warranty",
  ACCOUNT: "Account",
  TECHNICAL: "Technical issue",
  OTHER: "Other",
};

const STATUS_STYLES = {
  OPEN: "bg-blue-50 text-blue-700",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  WAITING_CUSTOMER: "bg-violet-50 text-violet-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const PRIORITY_STYLES = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-50 text-orange-700",
  URGENT: "bg-red-50 text-red-700",
};

const INITIAL_FORM = {
  type: "SUPPORT",
  category: "GENERAL",
  priority: "NORMAL",
  bookingId: "",
  subject: "",
  description: "",
  images: [],
};

const formatDateTime = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatStatus = (value) =>
  STATUS_LABELS[value] || String(value || "").replaceAll("_", " ");

function Modal({ children, onClose, maxWidth = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        className={`relative max-h-[94vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}

export default function Support() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError("");
      const [ticketResult, bookingResult] = await Promise.all([
        supportApi.listTickets(),
        supportApi.getBookings(),
      ]);
      setTickets(Array.isArray(ticketResult) ? ticketResult : []);
      setBookings(Array.isArray(bookingResult) ? bookingResult : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load support tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (!ticketId || selectedTicket?.id === ticketId) return;

    const openFromUrl = async () => {
      try {
        setDetailLoading(true);
        const ticket = await supportApi.getTicket(ticketId);
        setSelectedTicket(ticket);
      } catch {
        const next = new URLSearchParams(searchParams);
        next.delete("ticket");
        setSearchParams(next, { replace: true });
      } finally {
        setDetailLoading(false);
      }
    };

    void openFromUrl();
  }, [searchParams, selectedTicket?.id, setSearchParams]);

  const stats = useMemo(() => {
    const openStatuses = new Set(["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"]);
    return {
      open: tickets.filter((item) => openStatuses.has(item.status)).length,
      waiting: tickets.filter((item) => item.status === "WAITING_CUSTOMER").length,
      resolved: tickets.filter((item) => ["RESOLVED", "CLOSED"].includes(item.status)).length,
      disputes: tickets.filter((item) => item.type === "DISPUTE").length,
    };
  }, [tickets]);

  const openTicket = async (ticketId) => {
    try {
      setDetailLoading(true);
      setError("");
      const ticket = await supportApi.getTicket(ticketId);
      setSelectedTicket(ticket);
      const next = new URLSearchParams(searchParams);
      next.set("ticket", ticketId);
      setSearchParams(next, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to open this ticket.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeTicketModal = () => {
    setSelectedTicket(null);
    setReply("");
    const next = new URLSearchParams(searchParams);
    next.delete("ticket");
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      const created = await supportApi.createTicket(form);
      setTickets((current) => [created, ...current]);
      setForm(INITIAL_FORM);
      setShowCreate(false);
      await openTicket(created.id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to create the ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (event) => {
    event.preventDefault();
    if (!selectedTicket || !reply.trim()) return;

    try {
      setSubmitting(true);
      setError("");
      const updated = await supportApi.reply(selectedTicket.id, reply.trim());
      setSelectedTicket(updated);
      setReply("");
      await loadTickets();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send the reply.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      setSubmitting(true);
      const updated = await supportApi.close(selectedTicket.id);
      setSelectedTicket(updated);
      await loadTickets();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to close the ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Customer care</p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">Support tickets & disputes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Ask for help, follow support replies, or raise a booking dispute with evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-black"
          >
            <FiPlus /> New ticket
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [FiClock, stats.open, "Open tickets"],
          [FiMessageSquare, stats.waiting, "Waiting for you"],
          [FiCheckCircle, stats.resolved, "Resolved"],
          [FiShield, stats.disputes, "Disputes"],
        ].map(([Icon, value, label]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-bg-soft text-lg text-ink">
                <Icon />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-ink">{value}</p>
                <p className="text-xs font-semibold text-muted">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-bold text-ink">Your tickets</h2>
            <p className="mt-1 text-xs text-muted">Most recently updated first</p>
          </div>
          <button
            type="button"
            onClick={() => void loadTickets()}
            disabled={loading}
            className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink transition hover:bg-bg-soft disabled:opacity-50"
            aria-label="Refresh tickets"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading support tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center">
            <FiMessageSquare className="mx-auto text-3xl text-muted" />
            <h3 className="mt-3 font-bold text-ink">No tickets yet</h3>
            <p className="mt-1 text-sm text-muted">Create a ticket whenever you need help.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => void openTicket(ticket.id)}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-bg-soft"
              >
                <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg-soft text-ink">
                  {ticket.type === "DISPUTE" ? <FiShield /> : <FiMessageSquare />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">{ticket.ticketCode}</span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[ticket.status] || "bg-gray-100"}`}>
                      {formatStatus(ticket.status)}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${PRIORITY_STYLES[ticket.priority] || "bg-gray-100"}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-bold text-ink">{ticket.subject}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {ticket.messages?.[0]?.body || ticket.description}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {CATEGORY_LABELS[ticket.category] || ticket.category}
                    {ticket.booking?.bookingCode ? ` · Booking ${ticket.booking.bookingCode}` : ""}
                    {` · Updated ${formatDateTime(ticket.lastMessageAt)}`}
                  </p>
                </div>
                <FiChevronRight className="mt-3 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <Modal onClose={() => !submitting && setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="flex items-start justify-between border-b border-line p-5">
              <div>
                <h2 className="text-xl font-extrabold text-ink">Create support ticket</h2>
                <p className="mt-1 text-sm text-muted">Provide clear details so the team can respond faster.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-line">
                <FiX />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-ink">
                Ticket type
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value,
                      category: event.target.value === "DISPUTE" ? "BOOKING" : current.category,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 outline-none focus:border-ink"
                >
                  <option value="SUPPORT">Support request</option>
                  <option value="DISPUTE">Booking dispute</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-ink">
                Category
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 outline-none focus:border-ink"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-ink">
                Priority
                <select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 outline-none focus:border-ink"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-ink">
                Related booking {form.type === "DISPUTE" ? "*" : "(optional)"}
                <select
                  required={form.type === "DISPUTE"}
                  value={form.bookingId}
                  onChange={(event) => setForm((current) => ({ ...current, bookingId: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 outline-none focus:border-ink"
                >
                  <option value="">No booking selected</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.bookingCode} · {booking.vehicle?.brand} {booking.vehicle?.model} · {booking.status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-ink sm:col-span-2">
                Subject
                <input
                  required
                  minLength={4}
                  maxLength={160}
                  value={form.subject}
                  onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Briefly describe the issue"
                  className="mt-2 h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-ink"
                />
              </label>

              <label className="text-sm font-semibold text-ink sm:col-span-2">
                Description
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={6}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Explain what happened, what you expected, and what resolution you are seeking."
                  className="mt-2 w-full rounded-lg border border-line px-3 py-3 outline-none focus:border-ink"
                />
              </label>

              <label className="text-sm font-semibold text-ink sm:col-span-2">
                Evidence images (optional, up to 5)
                <span className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-bg-soft p-4 text-center text-muted transition hover:border-ink">
                  <FiImage className="text-2xl" />
                  <span className="mt-2 text-xs font-semibold">
                    {form.images.length ? `${form.images.length} image(s) selected` : "Choose screenshots, bills, or service photos"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        images: Array.from(event.target.files || []).slice(0, 5),
                      }))
                    }
                  />
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-line p-5">
              <button type="button" onClick={() => setShowCreate(false)} className="h-11 rounded-xl border border-line px-5 text-sm font-bold text-ink">
                Cancel
              </button>
              <button disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">
                <FiFileText /> {submitting ? "Creating..." : "Create ticket"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {(selectedTicket || detailLoading) && (
        <Modal onClose={closeTicketModal} maxWidth="max-w-4xl">
          {detailLoading && !selectedTicket ? (
            <div className="p-12 text-center text-sm text-muted">Loading ticket...</div>
          ) : selectedTicket ? (
            <div>
              <div className="flex items-start justify-between border-b border-line p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">{selectedTicket.ticketCode}</span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[selectedTicket.status] || "bg-gray-100"}`}>
                      {formatStatus(selectedTicket.status)}
                    </span>
                  </div>
                  <h2 className="mt-2 text-xl font-extrabold text-ink">{selectedTicket.subject}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {selectedTicket.type === "DISPUTE" ? "Booking dispute" : "Support request"} · {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                  </p>
                </div>
                <button type="button" onClick={closeTicketModal} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line">
                  <FiX />
                </button>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
                <div>
                  <div className="space-y-3">
                    {(selectedTicket.messages || []).map((message) => {
                      const customer = message.authorType === "CUSTOMER";
                      return (
                        <div key={message.id} className={`flex ${customer ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${customer ? "bg-ink text-white" : "bg-bg-soft text-ink"}`}>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                              <span>{customer ? "You" : message.authorName || "Rovauto support"}</span>
                              <span className={customer ? "text-white/60" : "text-muted"}>{formatDateTime(message.createdAt)}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedTicket.status !== "CLOSED" && (
                    <form onSubmit={handleReply} className="mt-5 rounded-2xl border border-line p-4">
                      <label className="text-sm font-bold text-ink">Reply to support</label>
                      <textarea
                        required
                        rows={4}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Add more information or answer the support team..."
                        className="mt-2 w-full rounded-lg border border-line px-3 py-3 text-sm outline-none focus:border-ink"
                      />
                      <div className="mt-3 flex flex-wrap justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => void handleCloseTicket()}
                          disabled={submitting}
                          className="h-10 rounded-lg border border-line px-4 text-sm font-bold text-muted transition hover:text-ink disabled:opacity-50"
                        >
                          Close ticket
                        </button>
                        <button disabled={submitting || !reply.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-50">
                          <FiSend /> {submitting ? "Sending..." : "Send reply"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <aside className="space-y-4">
                  <div className="rounded-2xl bg-bg-soft p-4 text-sm">
                    <p className="font-bold text-ink">Ticket details</p>
                    <dl className="mt-3 space-y-3 text-muted">
                      <div><dt className="text-xs font-bold uppercase">Created</dt><dd className="mt-1 text-ink">{formatDateTime(selectedTicket.createdAt)}</dd></div>
                      <div><dt className="text-xs font-bold uppercase">Priority</dt><dd className="mt-1 text-ink">{selectedTicket.priority}</dd></div>
                      <div><dt className="text-xs font-bold uppercase">Assigned to</dt><dd className="mt-1 text-ink">{selectedTicket.supportAssignee?.name || "Support queue"}</dd></div>
                    </dl>
                  </div>

                  {selectedTicket.booking && (
                    <div className="rounded-2xl border border-line p-4 text-sm">
                      <p className="font-bold text-ink">Related booking</p>
                      <p className="mt-2 font-semibold text-ink">{selectedTicket.booking.bookingCode}</p>
                      <p className="mt-1 text-muted">{selectedTicket.booking.vehicle?.brand} {selectedTicket.booking.vehicle?.model}</p>
                      <p className="mt-1 text-muted">{selectedTicket.booking.garage?.name || "Garage not assigned"}</p>
                    </div>
                  )}

                  {(selectedTicket.attachments || []).length > 0 && (
                    <div className="rounded-2xl border border-line p-4">
                      <p className="text-sm font-bold text-ink">Evidence</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {selectedTicket.attachments.map((item) => (
                          <a key={item.id} href={item.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line">
                            <img src={item.imageUrl} alt="Ticket evidence" className="h-24 w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTicket.resolutionNote && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                      <p className="font-bold text-emerald-800">Resolution</p>
                      <p className="mt-2 whitespace-pre-wrap text-emerald-700">{selectedTicket.resolutionNote}</p>
                      {selectedTicket.resolutionOutcome && (
                        <p className="mt-2 text-xs font-bold uppercase text-emerald-700">{selectedTicket.resolutionOutcome.replaceAll("_", " ")}</p>
                      )}
                    </div>
                  )}
                </aside>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
