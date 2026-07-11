import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFilter,
  FiInbox,
  FiLock,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiShield,
  FiUnlock,
  FiUserCheck,
  FiX,
  FiZap,
} from "react-icons/fi";

import { customerSupportApi } from "@/api/customerSupport";
import { useApp } from "@/hooks/useApp";

const STATUS_OPTIONS = ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER", "RESOLVED"];
const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "URGENT"];
const CATEGORY_OPTIONS = [
  "GENERAL",
  "BOOKING",
  "PAYMENT",
  "GARAGE",
  "SERVICE",
  "WARRANTY",
  "ACCOUNT",
  "TECHNICAL",
  "OTHER",
];

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

const EMPTY_FILTERS = {
  search: "",
  queue: "AVAILABLE",
  type: "",
  status: "",
  priority: "",
  category: "",
};

const formatLabel = (value) =>
  String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDateTime = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 sm:items-center sm:p-5">
      <button type="button" aria-label="Close dialog" className="absolute inset-0" onClick={onClose} />
      <div className="relative h-[100dvh] w-full max-w-6xl overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-2xl sm:border sm:border-line">
        {children}
      </div>
    </div>
  );
}

export default function CustomerSupportTickets() {
  const { user } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState({ ...EMPTY_FILTERS, page: 1, limit: 25 });
  const [result, setResult] = useState({ items: [], page: 1, totalPages: 1, total: 0 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [edit, setEdit] = useState({
    status: "OPEN",
    priority: "NORMAL",
    resolutionNote: "",
  });

  const loadTickets = async (params = query) => {
    try {
      setLoading(true);
      setError("");
      const data = await customerSupportApi.getTickets(
        Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
        ),
      );
      setResult(data || { items: [], page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load support tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets(query);
  }, [query]);

  const syncEdit = (ticket) => {
    setEdit({
      status: ticket.status || "OPEN",
      priority: ticket.priority || "NORMAL",
      resolutionNote: ticket.resolutionNote || "",
    });
  };

  const openTicket = async (ticketId, { updateUrl = true } = {}) => {
    try {
      setDetailLoading(true);
      setError("");
      const data = await customerSupportApi.getTicket(ticketId);
      setSelected(data);
      syncEdit(data);
      setReply("");
      setInternalNote(false);
      if (updateUrl) setSearchParams({ ticket: ticketId });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to open support ticket.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId && selected?.id !== ticketId) {
      void openTicket(ticketId, { updateUrl: false });
    }
  }, [searchParams]);

  const closeTicketModal = () => {
    setSelected(null);
    setSearchParams({});
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setQuery({ ...filters, page: 1, limit: query.limit || 25 });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQuery({ ...EMPTY_FILTERS, page: 1, limit: query.limit || 25 });
  };

  const claim = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      setError("");
      const updated = await customerSupportApi.claimTicket(selected.id);
      setSelected(updated);
      syncEdit(updated);
      await loadTickets(query);
    } catch (err) {
      setError(
        err.response?.status === 409
          ? "Another support agent claimed this ticket first. Refresh the queue and choose another ticket."
          : err.response?.data?.message || err.message || "Unable to claim ticket.",
      );
      if (err.response?.status === 409) {
        await openTicket(selected.id, { updateUrl: false });
      }
    } finally {
      setSaving(false);
    }
  };

  const release = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      setError("");
      const updated = await customerSupportApi.releaseTicket(selected.id);
      setSelected(updated);
      syncEdit(updated);
      await loadTickets(query);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to release ticket.");
    } finally {
      setSaving(false);
    }
  };

  const saveTicket = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      setError("");
      const updated = await customerSupportApi.updateTicket(selected.id, {
        status: edit.status,
        priority: edit.priority,
        resolutionNote: edit.resolutionNote || null,
      });
      setSelected(updated);
      syncEdit(updated);
      await loadTickets(query);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to update ticket.");
      if (err.response?.status === 409) {
        await openTicket(selected.id, { updateUrl: false });
      }
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      setSaving(true);
      setError("");
      const updated = await customerSupportApi.replyToTicket(selected.id, {
        body: reply.trim(),
        isInternal: internalNote,
      });
      setSelected(updated);
      syncEdit(updated);
      setReply("");
      await loadTickets(query);
    } catch (err) {
      setError(
        err.response?.status === 409
          ? "Another support agent is handling this ticket. Your reply was not sent."
          : err.response?.data?.message || err.message || "Unable to send reply.",
      );
      if (err.response?.status === 409) {
        await openTicket(selected.id, { updateUrl: false });
      }
    } finally {
      setSaving(false);
    }
  };

  const tickets = Array.isArray(result.items) ? result.items : [];
  const queueSummary = useMemo(() => {
    const mine = tickets.filter((ticket) => ticket.assignedToMe).length;
    const unassigned = tickets.filter((ticket) => !ticket.supportAssigneeId).length;
    const urgent = tickets.filter((ticket) => ticket.priority === "URGENT").length;
    return { mine, unassigned, urgent };
  }, [tickets]);

  return (
    <div className="mx-auto max-w-[1450px] space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Protected shared queue</p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">Support tickets & disputes</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Any support account can claim an unassigned ticket. The first successful claim owns it, preventing two agents from replying at the same time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTickets(query)}
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-bg-soft disabled:opacity-50 sm:w-auto"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [FiUserCheck, queueSummary.mine, "Visible assigned to me"],
          [FiInbox, queueSummary.unassigned, "Visible unassigned"],
          [FiZap, queueSummary.urgent, "Visible urgent"],
        ].map(([Icon, value, label]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-bg-soft text-lg"><Icon /></span>
              <div><p className="text-2xl font-extrabold text-ink">{value}</p><p className="text-xs font-semibold text-muted">{label}</p></div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,2fr)_repeat(5,minmax(125px,1fr))_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-3.5 text-muted" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Ticket, customer or booking"
              className="h-11 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none focus:border-ink"
            />
          </label>
          <select value={filters.queue} onChange={(event) => setFilters((current) => ({ ...current, queue: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none">
            <option value="AVAILABLE">Available + mine</option>
            <option value="MINE">Assigned to me</option>
            <option value="UNASSIGNED">Unassigned only</option>
            <option value="ALL">All tickets</option>
          </select>
          <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none"><option value="">All types</option><option value="SUPPORT">Support</option><option value="DISPUTE">Dispute</option></select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none"><option value="">All statuses</option>{[...STATUS_OPTIONS, "CLOSED"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select>
          <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none"><option value="">All priorities</option>{PRIORITY_OPTIONS.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none"><option value="">All categories</option>{CATEGORY_OPTIONS.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select>
          <div className="flex gap-2 sm:col-span-2 xl:col-span-1"><button className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white xl:flex-none"><FiFilter /> Apply</button><button type="button" onClick={clearFilters} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line"><FiX /></button></div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="grid gap-3 p-3 sm:hidden">
          {loading ? (
            <p className="rounded-xl bg-bg-soft p-5 text-center text-sm text-muted">Loading support queue...</p>
          ) : tickets.length ? (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => void openTicket(ticket.id)}
                className="rounded-xl border border-line p-4 text-left transition active:scale-[0.99] active:bg-bg-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink">{ticket.ticketCode}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-ink">{ticket.subject}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${PRIORITY_STYLES[ticket.priority] || "bg-bg-soft"}`}>{formatLabel(ticket.priority)}</span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-ink">{ticket.user?.name}</p>
                <p className="mt-1 truncate text-xs text-muted">{ticket.user?.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[ticket.status] || "bg-bg-soft"}`}>{formatLabel(ticket.status)}</span>
                  <span className="rounded-full bg-bg-soft px-2 py-1 text-[10px] font-bold text-muted">{formatLabel(ticket.type)}</span>
                  {ticket.assignedToMe ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><FiUserCheck /> Mine</span> : ticket.supportAssignee ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-600"><FiLock /> {ticket.supportAssignee.name}</span> : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700"><FiUnlock /> Available</span>}
                </div>
                <p className="mt-3 text-[11px] text-muted">Updated {formatDateTime(ticket.lastMessageAt)}</p>
              </button>
            ))
          ) : (
            <p className="rounded-xl bg-bg-soft p-5 text-center text-sm text-muted">No tickets match these filters.</p>
          )}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg-soft text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Ownership</th><th className="px-4 py-3">Updated</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-muted">Loading support queue...</td></tr>
              ) : tickets.length ? (
                tickets.map((ticket) => (
                  <tr key={ticket.id} onClick={() => void openTicket(ticket.id)} className="cursor-pointer transition hover:bg-bg-soft/70">
                    <td className="px-4 py-4"><p className="font-bold text-ink">{ticket.ticketCode}</p><p className="mt-1 max-w-sm truncate text-xs text-muted">{ticket.subject}</p><p className="mt-1 text-[11px] font-bold uppercase text-muted">{formatLabel(ticket.type)} · {formatLabel(ticket.category)}</p></td>
                    <td className="px-4 py-4"><p className="font-semibold text-ink">{ticket.user?.name}</p><p className="mt-1 text-xs text-muted">{ticket.user?.email}</p></td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[ticket.status] || "bg-bg-soft"}`}>{formatLabel(ticket.status)}</span></td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PRIORITY_STYLES[ticket.priority] || "bg-bg-soft"}`}>{formatLabel(ticket.priority)}</span></td>
                    <td className="px-4 py-4">{ticket.assignedToMe ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><FiUserCheck /> Assigned to me</span> : ticket.supportAssignee ? <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600"><FiLock /> {ticket.supportAssignee.name}</span> : <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><FiUnlock /> Available</span>}</td>
                    <td className="px-4 py-4 text-xs text-muted">{formatDateTime(ticket.lastMessageAt)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-muted">No tickets match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <p className="text-muted">{result.total || 0} tickets</p>
          <div className="flex items-center gap-2"><button type="button" disabled={(result.page || 1) <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))} className="grid h-9 w-9 place-items-center rounded-lg border border-line disabled:opacity-40"><FiChevronLeft /></button><span className="text-xs font-bold text-ink">Page {result.page || 1} of {result.totalPages || 1}</span><button type="button" disabled={(result.page || 1) >= (result.totalPages || 1)} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))} className="grid h-9 w-9 place-items-center rounded-lg border border-line disabled:opacity-40"><FiChevronRight /></button></div>
        </div>
      </section>

      {(selected || detailLoading) && (
        <Modal onClose={closeTicketModal}>
          {detailLoading && !selected ? <div className="p-10 text-center text-muted">Loading ticket...</div> : selected ? (
            <div>
              <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-white p-4 sm:p-6">
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">{selected.ticketCode}</p><h2 className="mt-1 text-xl font-extrabold text-ink">{selected.subject}</h2><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[selected.status]}`}>{formatLabel(selected.status)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PRIORITY_STYLES[selected.priority]}`}>{formatLabel(selected.priority)}</span><span className="rounded-full bg-bg-soft px-2.5 py-1 text-xs font-bold text-ink">{formatLabel(selected.type)}</span></div></div>
                <button type="button" onClick={closeTicketModal} className="grid h-10 w-10 place-items-center rounded-lg border border-line"><FiX /></button>
              </header>

              <div className="grid gap-4 p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_330px]">
                <main>
                  <div className="rounded-2xl bg-bg-soft p-4"><h3 className="font-bold text-ink">Customer request</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{selected.description}</p></div>

                  <div className="mt-5 rounded-2xl border border-line p-4 sm:p-5">
                    <h3 className="flex items-center gap-2 font-bold text-ink"><FiMessageSquare /> Conversation</h3>
                    <div className="mt-4 grid gap-3">
                      {(selected.messages || []).map((message) => {
                        const customer = message.authorType === "CUSTOMER";
                        const internal = message.isInternal;
                        return (
                          <div key={message.id} className={`flex ${customer ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[88%] rounded-2xl border px-4 py-3 ${internal ? "border-amber-200 bg-amber-50 text-amber-950" : customer ? "border-line bg-white text-ink" : "border-ink bg-ink text-white"}`}>
                              <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span>{message.authorName}</span><span className={internal ? "text-amber-700" : customer ? "text-muted" : "text-white/60"}>{formatLabel(message.authorType)} · {formatDateTime(message.createdAt)}</span>{internal && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] uppercase text-amber-900">Internal note</span>}</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selected.status !== "CLOSED" && selected.canRespond && (
                    <form onSubmit={sendReply} className="mt-5 rounded-2xl border border-line p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-ink">Add response</h3><p className="mt-1 text-xs text-muted">The first reply atomically claims an unassigned ticket. Public replies notify the customer.</p></div><label className="flex cursor-pointer items-center gap-2 rounded-lg bg-bg-soft px-3 py-2 text-xs font-bold text-ink"><input type="checkbox" checked={internalNote} onChange={(event) => setInternalNote(event.target.checked)} /> Internal note</label></div>
                      <textarea required rows={5} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={internalNote ? "Record investigation details..." : "Write a clear response to the customer..."} className="mt-3 w-full rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-ink" />
                      <div className="mt-3 flex justify-end"><button disabled={saving || !reply.trim()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"><FiSend /> {saving ? "Saving..." : internalNote ? "Add note" : "Send reply"}</button></div>
                    </form>
                  )}

                  {!selected.canRespond && selected.supportAssigneeId && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><FiLock className="mr-2 inline" />This ticket is assigned to {selected.supportAssignee?.name || "another support agent"}. Your reply controls are locked.</div>
                  )}
                </main>

                <aside className="space-y-4">
                  <section className="rounded-2xl border border-line p-4">
                    <h3 className="font-bold text-ink">Ticket ownership</h3>
                    <p className="mt-2 text-sm text-muted">{selected.supportAssignee ? `Assigned to ${selected.supportAssignee.name}` : "This ticket is unassigned and available."}</p>
                    {selected.canClaim && <button type="button" onClick={() => void claim()} disabled={saving} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"><FiUserCheck /> Claim ticket</button>}
                    {selected.assignedToMe && ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"].includes(selected.status) && <button type="button" onClick={() => void release()} disabled={saving} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-bold text-ink disabled:opacity-50"><FiUnlock /> Release to queue</button>}
                  </section>

                  {selected.canRespond && (
                    <section className="rounded-2xl border border-line p-4">
                      <h3 className="font-bold text-ink">Case controls</h3>
                      <div className="mt-4 grid gap-3">
                        <label className="text-xs font-bold uppercase tracking-wide text-muted">Status<select value={edit.status} onChange={(event) => setEdit((current) => ({ ...current, status: event.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm normal-case text-ink outline-none"><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="WAITING_CUSTOMER">Waiting customer</option>{selected.type === "SUPPORT" && <option value="RESOLVED">Resolved</option>}</select></label>
                        <label className="text-xs font-bold uppercase tracking-wide text-muted">Priority<select value={edit.priority} onChange={(event) => setEdit((current) => ({ ...current, priority: event.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm normal-case text-ink outline-none">{PRIORITY_OPTIONS.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                        {selected.type === "SUPPORT" && <label className="text-xs font-bold uppercase tracking-wide text-muted">Resolution note<textarea rows={4} value={edit.resolutionNote} onChange={(event) => setEdit((current) => ({ ...current, resolutionNote: event.target.value }))} placeholder="Required before resolving" className="mt-2 w-full rounded-lg border border-line px-3 py-3 text-sm normal-case text-ink outline-none" /></label>}
                        {selected.type === "DISPUTE" && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800"><FiShield className="mr-1 inline" />Customer support can investigate and respond, but only an admin can record a dispute outcome or refund.</p>}
                        <button type="button" onClick={() => void saveTicket()} disabled={saving} className="h-10 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save case changes"}</button>
                      </div>
                    </section>
                  )}

                  <section className="rounded-2xl bg-bg-soft p-4 text-sm"><h3 className="font-bold text-ink">Customer</h3><p className="mt-3 font-semibold text-ink">{selected.user?.name}</p><p className="mt-1 break-all text-muted">{selected.user?.email}</p><p className="mt-1 text-muted">{selected.user?.phone || "No phone"}</p></section>

                  {selected.booking && <section className="rounded-2xl border border-line p-4 text-sm"><h3 className="font-bold text-ink">Booking context</h3><p className="mt-3 font-bold text-ink">{selected.booking.bookingCode}</p><p className="mt-1 text-muted">{selected.booking.vehicle?.brand} {selected.booking.vehicle?.model} · {selected.booking.vehicle?.registrationNumber || "No registration"}</p><p className="mt-1 text-muted">{selected.booking.garage?.name || "Garage unassigned"}</p><p className="mt-1 text-muted">Booking status: {formatLabel(selected.booking.status)}</p>{selected.booking.payment && <p className="mt-2 font-semibold text-ink">Payment: {formatMoney(selected.booking.payment.amount)} · {formatLabel(selected.booking.payment.status)}</p>}</section>}

                  {(selected.attachments || []).length > 0 && <section className="rounded-2xl border border-line p-4"><h3 className="font-bold text-ink">Customer evidence</h3><div className="mt-3 grid grid-cols-2 gap-2">{selected.attachments.map((item) => <a key={item.id} href={item.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line"><img src={item.imageUrl} alt="Support evidence" className="h-24 w-full object-cover" /></a>)}</div></section>}
                </aside>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
