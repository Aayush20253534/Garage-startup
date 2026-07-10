import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiInbox,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiShield,
  FiUser,
  FiUserCheck,
  FiUsers,
  FiX,
  FiZap,
} from "react-icons/fi";

import { adminApi } from "@/api/admin";

const STATUS_OPTIONS = [
  "OPEN",
  "IN_REVIEW",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];
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
const OUTCOME_OPTIONS = [
  "CUSTOMER_FAVORED",
  "GARAGE_FAVORED",
  "PARTIAL_REFUND",
  "NO_ACTION",
  "MUTUAL_AGREEMENT",
];

const STATUS_STYLES = {
  OPEN: "border-blue-200 bg-blue-50 text-blue-700",
  IN_REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  WAITING_CUSTOMER: "border-violet-200 bg-violet-50 text-violet-700",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-gray-200 bg-gray-100 text-gray-600",
};

const PRIORITY_STYLES = {
  LOW: "border-gray-200 bg-gray-100 text-gray-600",
  NORMAL: "border-blue-200 bg-blue-50 text-blue-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  URGENT: "border-red-200 bg-red-50 text-red-700",
};

const EMPTY_FILTERS = {
  search: "",
  type: "",
  status: "",
  priority: "",
  category: "",
  supportAssigneeId: "",
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

const badgeClass = (styles, value) =>
  `inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${styles[value] || "border-gray-200 bg-gray-100 text-gray-600"}`;

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-2 sm:p-5">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function AssignmentControl({
  ticket,
  supportAccounts,
  value,
  onChange,
  onSave,
  saving,
  compact = false,
}) {
  const currentValue = ticket.supportAssigneeId || "";
  const changed = value !== currentValue;

  return (
    <div className={compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink"
        aria-label={`Assign ${ticket.ticketCode} to customer support`}
      >
        <option value="">Unassigned / open queue</option>
        {supportAccounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {account.activeTicketCount || 0} active
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !changed}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FiUserCheck /> {saving ? "Saving..." : currentValue ? "Reassign" : "Assign"}
      </button>
    </div>
  );
}

export default function SupportTickets() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState({ ...EMPTY_FILTERS, page: 1, limit: 25 });
  const [result, setResult] = useState({
    items: [],
    stats: {},
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [supportAccounts, setSupportAccounts] = useState([]);
  const [supportAccountsLoading, setSupportAccountsLoading] = useState(true);
  const [supportAccountsError, setSupportAccountsError] = useState("");
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [assigningTicketId, setAssigningTicketId] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [edit, setEdit] = useState({
    status: "OPEN",
    priority: "NORMAL",
    supportAssigneeId: "",
    resolutionOutcome: "",
    resolutionNote: "",
    refundAmount: "",
  });

  const loadTickets = async (params = query) => {
    try {
      setLoading(true);
      setError("");
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(
          ([, value]) => value !== "" && value !== undefined,
        ),
      );
      const data = await adminApi.getSupportTickets(cleanParams);
      const nextResult = data || {
        items: [],
        stats: {},
        page: 1,
        totalPages: 1,
        total: 0,
      };
      setResult(nextResult);
      setAssignmentDrafts((current) => {
        const next = { ...current };
        (nextResult.items || []).forEach((ticket) => {
          if (!(ticket.id in next)) {
            next[ticket.id] = ticket.supportAssigneeId || "";
          }
        });
        return next;
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load support tickets.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSupportAccounts = async () => {
    try {
      setSupportAccountsLoading(true);
      setSupportAccountsError("");
      let data;
      try {
        data = await adminApi.getCustomerSupportAccounts();
      } catch {
        data = await adminApi.getSupportStaff();
      }
      const accounts = Array.isArray(data) ? data : [];
      setSupportAccounts(accounts.filter((account) => account.isActive !== false));
    } catch (err) {
      setSupportAccounts([]);
      setSupportAccountsError(
        err.response?.data?.message ||
          "Customer-support accounts could not be loaded. Refresh the page or create an active support account first.",
      );
    } finally {
      setSupportAccountsLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets(query);
  }, [query]);

  useEffect(() => {
    void loadSupportAccounts();
  }, []);

  const tickets = Array.isArray(result.items) ? result.items : [];
  const stats = result.stats || {};

  const syncEdit = (ticket) => {
    setEdit({
      status: ticket.status || "OPEN",
      priority: ticket.priority || "NORMAL",
      supportAssigneeId: ticket.supportAssigneeId || "",
      resolutionOutcome: ticket.resolutionOutcome || "",
      resolutionNote: ticket.resolutionNote || "",
      refundAmount: ticket.refundAmount ?? "",
    });
  };

  const openTicket = async (ticketId) => {
    try {
      setDetailLoading(true);
      setError("");
      setSuccess("");
      const data = await adminApi.getSupportTicket(ticketId);
      setSelected(data);
      syncEdit(data);
      setInternalNote("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to open the support ticket.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const updateTicketInList = (updated) => {
    setResult((current) => ({
      ...current,
      items: (current.items || []).map((ticket) =>
        ticket.id === updated.id
          ? {
              ...ticket,
              ...updated,
              messages: ticket.messages,
              _count: ticket._count,
            }
          : ticket,
      ),
    }));
    setAssignmentDrafts((current) => ({
      ...current,
      [updated.id]: updated.supportAssigneeId || "",
    }));
  };

  const quickAssign = async (ticket) => {
    const supportAssigneeId = assignmentDrafts[ticket.id] ?? ticket.supportAssigneeId ?? "";
    try {
      setAssigningTicketId(ticket.id);
      setError("");
      setSuccess("");
      const updated = await adminApi.updateSupportTicket(ticket.id, {
        supportAssigneeId: supportAssigneeId || null,
      });
      updateTicketInList(updated);
      if (selected?.id === updated.id) {
        setSelected(updated);
        syncEdit(updated);
      }
      setSuccess(
        updated.supportAssignee
          ? `${updated.ticketCode} assigned to ${updated.supportAssignee.name}.`
          : `${updated.ticketCode} returned to the open queue.`,
      );
      await loadTickets(query);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update the assignment.",
      );
    } finally {
      setAssigningTicketId("");
    }
  };

  const saveTicket = async () => {
    if (!selected) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const updated = await adminApi.updateSupportTicket(selected.id, {
        status: edit.status,
        priority: edit.priority,
        supportAssigneeId: edit.supportAssigneeId || null,
        resolutionOutcome: edit.resolutionOutcome || null,
        resolutionNote: edit.resolutionNote || null,
        refundAmount:
          edit.refundAmount === "" ? null : Number(edit.refundAmount),
      });
      setSelected(updated);
      syncEdit(updated);
      updateTicketInList(updated);
      setSuccess(`${updated.ticketCode} was updated successfully.`);
      await loadTickets(query);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update the ticket.",
      );
    } finally {
      setSaving(false);
    }
  };

  const addInternalNote = async (event) => {
    event.preventDefault();
    if (!selected || !internalNote.trim()) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const updated = await adminApi.replyToSupportTicket(selected.id, {
        body: internalNote.trim(),
        isInternal: true,
      });
      setSelected(updated);
      syncEdit(updated);
      setInternalNote("");
      setSuccess("Private admin note added.");
      await loadTickets(query);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to add the internal note.",
      );
    } finally {
      setSaving(false);
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setQuery({ ...filters, page: 1, limit: query.limit || 25 });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQuery({ ...EMPTY_FILTERS, page: 1, limit: query.limit || 25 });
  };

  const summaryCards = useMemo(
    () => [
      [FiInbox, stats.open || 0, "Open"],
      [FiClock, stats.inReview || 0, "In review"],
      [FiMessageSquare, stats.waitingCustomer || 0, "Waiting customer"],
      [FiZap, stats.urgent || 0, "Urgent"],
      [FiShield, stats.disputes || 0, "Open disputes"],
      [FiUserCheck, stats.unassigned || 0, "Unassigned"],
      [FiCheckCircle, stats.resolvedToday || 0, "Resolved today"],
    ],
    [stats],
  );

  const renderAssignment = (ticket, compact = false) => {
    const value = assignmentDrafts[ticket.id] ?? ticket.supportAssigneeId ?? "";
    return (
      <AssignmentControl
        ticket={ticket}
        supportAccounts={supportAccounts}
        value={value}
        onChange={(nextValue) =>
          setAssignmentDrafts((current) => ({
            ...current,
            [ticket.id]: nextValue,
          }))
        }
        onSave={() => void quickAssign(ticket)}
        saving={assigningTicketId === ticket.id}
        compact={compact}
      />
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Admin oversight
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">
              Support tickets & disputes
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Assign cases to customer-support accounts, add private admin notes,
              and make final dispute or refund decisions. Customer-facing replies
              remain in the dedicated Customer Support portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-bg-soft px-4 text-sm font-bold text-ink">
              <FiUsers /> {supportAccountsLoading ? "Loading agents..." : `${supportAccounts.length} active agents`}
            </span>
            <button
              type="button"
              onClick={() => {
                void loadTickets(query);
                void loadSupportAccounts();
              }}
              disabled={loading || supportAccountsLoading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-bg-soft disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <FiCheck className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {supportAccountsError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{supportAccountsError}</span>
        </div>
      )}

      {!supportAccountsLoading && !supportAccountsError && supportAccounts.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          No active customer-support account exists. Create or enable one from
          <strong> Admin → Support Accounts</strong> before assigning tickets.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(([Icon, value, label]) => (
          <div
            key={label}
            className="rounded-2xl border border-line bg-white p-4 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg-soft text-lg text-ink">
                <Icon />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold text-ink">{value}</p>
                <p className="truncate text-xs font-semibold text-muted">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative md:col-span-2 xl:col-span-2">
            <span className="sr-only">Search support tickets</span>
            <FiSearch className="pointer-events-none absolute left-3 top-3.5 text-muted" />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Ticket, customer, booking or garage"
              className="h-11 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none focus:border-ink"
            />
          </label>
          <select
            value={filters.type}
            onChange={(event) =>
              setFilters((current) => ({ ...current, type: event.target.value }))
            }
            className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
          >
            <option value="">All types</option>
            <option value="SUPPORT">Support</option>
            <option value="DISPUTE">Dispute</option>
          </select>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
            className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(event) =>
              setFilters((current) => ({ ...current, priority: event.target.value }))
            }
            className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters((current) => ({ ...current, category: event.target.value }))
            }
            className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
          <select
            value={filters.supportAssigneeId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, supportAssigneeId: event.target.value }))
            }
            className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
          >
            <option value="">All assignments</option>
            <option value="unassigned">Unassigned</option>
            {supportAccounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button type="submit" className="h-11 flex-1 rounded-lg bg-ink px-4 text-sm font-bold text-white">
              Filter
            </button>
            <button type="button" onClick={clearFilters} className="h-11 flex-1 rounded-lg border border-line px-4 text-sm font-bold text-ink">
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="hidden overflow-hidden rounded-2xl border border-line bg-white shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-bg-soft text-xs font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="min-w-[320px] px-4 py-3">Assign customer support</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-muted">Loading support cases...</td></tr>
              ) : tickets.length ? (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="align-top transition hover:bg-bg-soft/60">
                    <td className="px-4 py-4">
                      <p className="font-bold text-ink">{ticket.ticketCode}</p>
                      <p className="mt-1 max-w-[240px] truncate text-muted">{ticket.subject}</p>
                      <span className="mt-2 inline-flex rounded-full bg-bg-soft px-2 py-1 text-[10px] font-bold uppercase text-muted">
                        {formatLabel(ticket.type)} · {formatLabel(ticket.category)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-ink">{ticket.user?.name}</p>
                      <p className="mt-1 max-w-[190px] truncate text-xs text-muted">{ticket.user?.email}</p>
                    </td>
                    <td className="px-4 py-4"><span className={badgeClass(STATUS_STYLES, ticket.status)}>{formatLabel(ticket.status)}</span></td>
                    <td className="px-4 py-4"><span className={badgeClass(PRIORITY_STYLES, ticket.priority)}>{formatLabel(ticket.priority)}</span></td>
                    <td className="px-4 py-4">
                      {renderAssignment(ticket)}
                      <p className="mt-2 text-xs text-muted">
                        {ticket.supportAssignee ? `Currently: ${ticket.supportAssignee.name}` : "Currently unassigned"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDateTime(ticket.lastMessageAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <button type="button" onClick={() => void openTicket(ticket.id)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink transition hover:border-ink hover:bg-white">
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-muted">No support cases match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:hidden">
        {loading ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted">Loading support cases...</div>
        ) : tickets.length ? (
          tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">{ticket.ticketCode}</p>
                  <p className="mt-1 truncate text-sm text-muted">{ticket.subject}</p>
                </div>
                <button type="button" onClick={() => void openTicket(ticket.id)} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink">Review</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={badgeClass(STATUS_STYLES, ticket.status)}>{formatLabel(ticket.status)}</span>
                <span className={badgeClass(PRIORITY_STYLES, ticket.priority)}>{formatLabel(ticket.priority)}</span>
                <span className="inline-flex rounded-full border border-line bg-bg-soft px-2.5 py-1 text-[11px] font-bold text-muted">{formatLabel(ticket.type)}</span>
              </div>
              <div className="mt-4 rounded-xl bg-bg-soft p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Assign customer support</p>
                {renderAssignment(ticket, true)}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span className="truncate">{ticket.user?.name} · {ticket.user?.email}</span>
                <span className="shrink-0">{formatDateTime(ticket.lastMessageAt)}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No support cases match these filters.</div>
        )}
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-soft">
        <span className="text-muted">Page {result.page || 1} of {result.totalPages || 1} · {result.total || 0} cases</span>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous page" disabled={(result.page || 1) <= 1} onClick={() => setQuery((current) => ({ ...current, page: Math.max((current.page || 1) - 1, 1) }))} className="grid h-9 w-9 place-items-center rounded-lg border border-line disabled:opacity-40"><FiChevronLeft /></button>
          <button type="button" aria-label="Next page" disabled={(result.page || 1) >= (result.totalPages || 1)} onClick={() => setQuery((current) => ({ ...current, page: Math.min((current.page || 1) + 1, result.totalPages || 1) }))} className="grid h-9 w-9 place-items-center rounded-lg border border-line disabled:opacity-40"><FiChevronRight /></button>
        </div>
      </section>

      {(detailLoading || selected) && (
        <Modal onClose={() => setSelected(null)}>
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{selected?.ticketCode || "Support case"}</p>
              <h2 className="mt-1 truncate text-xl font-extrabold text-ink">{selected?.subject || "Loading..."}</h2>
            </div>
            <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line"><FiX /></button>
          </div>

          {(error || success) && (
            <div className="border-b border-line px-4 py-3 sm:px-6">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <FiAlertCircle className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && !error && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <FiCheck className="mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}
            </div>
          )}

          {detailLoading && !selected ? (
            <p className="p-8 text-center text-muted">Loading support case...</p>
          ) : selected ? (
            <div className="p-4 sm:p-6">
              <section className="rounded-2xl border border-line bg-bg-soft p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={badgeClass(STATUS_STYLES, selected.status)}>{formatLabel(selected.status)}</span>
                    <span className={badgeClass(PRIORITY_STYLES, selected.priority)}>{formatLabel(selected.priority)}</span>
                    <span className="inline-flex rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-muted">{formatLabel(selected.type)} · {formatLabel(selected.category)}</span>
                  </div>
                  <p className="text-xs text-muted">Created {formatDateTime(selected.createdAt)}</p>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink">{selected.description}</p>
              </section>

              <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-extrabold text-ink">Admin case controls</h3>
                    <p className="mt-1 text-xs leading-5 text-muted">Assignment is available here and directly in the ticket list. Saving notifies a newly assigned support agent.</p>
                  </div>
                  {selected.supportAssignee && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><FiUserCheck /> {selected.supportAssignee.name}</span>
                  )}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Status
                    <select value={edit.status} onChange={(event) => setEdit((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case text-ink outline-none focus:border-ink">
                      {STATUS_OPTIONS.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Priority
                    <select value={edit.priority} onChange={(event) => setEdit((current) => ({ ...current, priority: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case text-ink outline-none focus:border-ink">
                      {PRIORITY_OPTIONS.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-muted md:col-span-2 xl:col-span-1">
                    Assign customer support
                    <select value={edit.supportAssigneeId} onChange={(event) => setEdit((current) => ({ ...current, supportAssigneeId: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case text-ink outline-none focus:border-ink">
                      <option value="">Unassigned / open queue</option>
                      {supportAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.email}</option>)}
                    </select>
                  </label>
                </div>

                {selected.type === "DISPUTE" && (
                  <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                      Dispute outcome
                      <select value={edit.resolutionOutcome} onChange={(event) => setEdit((current) => ({ ...current, resolutionOutcome: event.target.value }))} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case text-ink outline-none focus:border-ink">
                        <option value="">Select outcome</option>
                        {OUTCOME_OPTIONS.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                      Refund amount recorded
                      <input type="number" min="0" step="1" value={edit.refundAmount} onChange={(event) => setEdit((current) => ({ ...current, refundAmount: event.target.value }))} placeholder="0" className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal normal-case text-ink outline-none focus:border-ink" />
                    </label>
                  </div>
                )}

                <label className="mt-4 grid gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Resolution note
                  <textarea rows={4} value={edit.resolutionNote} onChange={(event) => setEdit((current) => ({ ...current, resolutionNote: event.target.value }))} placeholder="Required before resolving or closing a case" className="rounded-xl border border-line bg-white px-3 py-3 text-sm font-normal normal-case text-ink outline-none focus:border-ink" />
                </label>
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={() => void saveTicket()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:opacity-50"><FiCheck /> {saving ? "Saving..." : "Save case changes"}</button>
                </div>
              </section>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
                <main className="min-w-0">
                  <section className="rounded-2xl border border-line p-4 sm:p-5">
                    <h3 className="font-bold text-ink">Conversation and audit trail</h3>
                    <div className="mt-4 grid gap-3">
                      {(selected.messages || []).length ? (
                        selected.messages.map((message) => {
                          const internal = Boolean(message.isInternal);
                          const customer = message.authorType === "CUSTOMER";
                          return (
                            <div key={message.id} className={`flex ${customer ? "justify-start" : "justify-end"}`}>
                              <div className={`max-w-[92%] rounded-2xl px-4 py-3 ${internal ? "border border-amber-200 bg-amber-50 text-amber-950" : customer ? "border border-line bg-white text-ink" : "bg-ink text-white"}`}>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                                  <span>{message.authorName}</span>
                                  <span className={internal ? "text-amber-700" : customer ? "text-muted" : "text-white/60"}>{formatLabel(message.authorType)} · {formatDateTime(message.createdAt)}</span>
                                  {internal && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] uppercase text-amber-900">Internal note</span>}
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="rounded-xl bg-bg-soft p-4 text-sm text-muted">No replies have been added yet.</p>
                      )}
                    </div>
                  </section>

                  {selected.status !== "CLOSED" && (
                    <form onSubmit={addInternalNote} className="mt-5 rounded-2xl border border-line p-4 sm:p-5">
                      <h3 className="font-bold text-ink">Add private admin note</h3>
                      <p className="mt-1 text-xs leading-5 text-muted">Visible to admins and customer-support agents, never to the customer.</p>
                      <textarea required rows={4} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Investigation details or instructions for the assigned support agent..." className="mt-3 w-full rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-ink" />
                      <div className="mt-3 flex justify-end">
                        <button disabled={saving || !internalNote.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:opacity-50"><FiSend /> {saving ? "Saving..." : "Add internal note"}</button>
                      </div>
                    </form>
                  )}
                </main>

                <aside className="space-y-4">
                  <section className="rounded-2xl bg-bg-soft p-4 text-sm">
                    <h3 className="flex items-center gap-2 font-bold text-ink"><FiUser /> Customer</h3>
                    <p className="mt-3 font-semibold text-ink">{selected.user?.name}</p>
                    <p className="mt-1 break-all text-muted">{selected.user?.email}</p>
                    <p className="mt-1 text-muted">{selected.user?.phone || "No phone"}</p>
                  </section>

                  {selected.booking && (
                    <section className="rounded-2xl border border-line p-4 text-sm">
                      <h3 className="font-bold text-ink">Booking context</h3>
                      <p className="mt-3 font-bold text-ink">{selected.booking.bookingCode}</p>
                      <p className="mt-1 text-muted">{selected.booking.vehicle?.brand} {selected.booking.vehicle?.model} · {selected.booking.vehicle?.registrationNumber || "No registration"}</p>
                      <p className="mt-1 text-muted">{selected.booking.garage?.name || "Garage unassigned"}</p>
                      <p className="mt-1 text-muted">Booking status: {formatLabel(selected.booking.status)}</p>
                      {selected.booking.payment && <p className="mt-2 font-semibold text-ink">Payment: {formatMoney(selected.booking.payment.amount)} · {formatLabel(selected.booking.payment.status)}</p>}
                    </section>
                  )}

                  {(selected.attachments || []).length > 0 && (
                    <section className="rounded-2xl border border-line p-4">
                      <h3 className="font-bold text-ink">Customer evidence</h3>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {selected.attachments.map((item) => (
                          <a key={item.id} href={item.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line">
                            <img src={item.imageUrl} alt="Support evidence" className="h-24 w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </section>
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
