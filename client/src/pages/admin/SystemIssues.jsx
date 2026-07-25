import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { notifySystemIssuesUpdated } from "@/hooks/useOpenSystemIssueCount";
import { useApp } from "@/hooks/useApp";
import {
  FiActivity,
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const STATUS_OPTIONS = ["", "OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"];
const SEVERITY_OPTIONS = ["", "INFO", "WARNING", "ERROR", "CRITICAL"];
const SOURCE_OPTIONS = ["", "FRONTEND", "BACKEND"];
const ACTOR_OPTIONS = ["", "CUSTOMER", "GARAGE", "ADMIN", "INTERN", "CUSTOMER_SUPPORT", "PUBLIC", "SYSTEM"];

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const severityClass = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-amber-100 text-amber-800",
  ERROR: "bg-red-100 text-red-700",
  CRITICAL: "bg-red-700 text-white",
};

const statusClass = {
  OPEN: "bg-red-50 text-red-700",
  INVESTIGATING: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-green-100 text-green-700",
  IGNORED: "bg-bg-soft text-muted",
};

const emptyStats = {
  open: 0,
  investigating: 0,
  active: 0,
  critical: 0,
  resolved: 0,
  total: 0,
  recent24h: 0,
};

export default function SystemIssues() {
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    severity: "",
    source: "",
    actorType: "",
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const query = useMemo(
    () => ({
      page,
      limit: 25,
      ...Object.fromEntries(
        Object.entries(filters).filter(([, value]) => String(value).trim()),
      ),
    }),
    [filters, page],
  );

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const [issueResult, statResult] = await Promise.all([
        adminApi.getSystemIssues(query),
        adminApi.getSystemIssueStats(),
      ]);
      setIssues(issueResult.items || []);
      setPagination(issueResult.pagination || { page: 1, pages: 1, total: 0 });
      setStats({ ...emptyStats, ...(statResult || {}) });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load system issues");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setInterval(() => load({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [query]);

  const updateStatus = async (issue, status) => {
    setUpdating(true);
    setError("");

    try {
      const updated = await adminApi.updateSystemIssueStatus(issue.id, {
        status,
        resolutionNote: resolutionNote.trim() || null,
      });
      setSelectedIssue(updated);
      setResolutionNote(updated.resolutionNote || "");
      notifySystemIssuesUpdated();
      await load({ silent: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update system issue");
    } finally {
      setUpdating(false);
    }
  };

  const deleteIssue = async (issue) => {
    const confirmed = window.confirm(
      `Delete the issue “${issue.title}”? This removes its recorded history.`,
    );
    if (!confirmed) return;

    try {
      await adminApi.deleteSystemIssue(issue.id);
      if (selectedIssue?.id === issue.id) setSelectedIssue(null);
      notifySystemIssuesUpdated();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete system issue");
    }
  };

  const clearResolved = async () => {
    const confirmed = window.confirm(
      "Delete all resolved and ignored system issues?",
    );
    if (!confirmed) return;

    try {
      await adminApi.clearResolvedSystemIssues();
      notifySystemIssuesUpdated();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to clear resolved issues");
    }
  };

  const openIssue = (issue) => {
    setSelectedIssue(issue);
    setResolutionNote(issue.resolutionNote || "");
  };

  const cards = [
    { label: "Active Issues", value: stats.active, icon: FiAlertTriangle, caption: `${stats.open} open` },
    { label: "Investigating", value: stats.investigating, icon: FiClock, caption: "Being reviewed" },
    { label: "Critical", value: stats.critical, icon: FiAlertCircle, caption: "Needs attention" },
    { label: "Last 24 Hours", value: stats.recent24h, icon: FiActivity, caption: "New occurrences" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">System Issues</h2>
          <p className="mt-1 text-sm text-muted">
            Customer, garage, browser, API, and background-worker disturbances grouped by cause.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isIntern && (
            <button
              type="button"
              onClick={clearResolved}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <FiTrash2 /> Clear resolved
            </button>
          )}
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" /> {error}
        </div>
      )}

      {isIntern && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          Intern access is read-only. Admins and Main Admins can change status, add notes, and delete issue records.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, caption }) => (
          <div key={label} className="card-soft rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-xl text-red-700">
                <Icon />
              </span>
              <span className="rounded-full bg-bg-soft px-2.5 py-1 text-xs font-semibold text-muted">
                {caption}
              </span>
            </div>
            <div className="mt-4 text-3xl font-bold text-ink">{value}</div>
            <div className="mt-1 text-sm text-muted">{label}</div>
          </div>
        ))}
      </div>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_repeat(4,170px)]">
          <label className="relative min-w-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, search: event.target.value }));
              }}
              placeholder="Search message, route, endpoint..."
              className="h-10 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none focus:border-ink"
            />
          </label>

          {[
            ["status", STATUS_OPTIONS, "All statuses"],
            ["severity", SEVERITY_OPTIONS, "All severities"],
            ["source", SOURCE_OPTIONS, "All sources"],
            ["actorType", ACTOR_OPTIONS, "All flows"],
          ].map(([key, options, placeholder]) => (
            <select
              key={key}
              value={filters[key]}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, [key]: event.target.value }));
              }}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink"
            >
              {options.map((option) => (
                <option key={option || placeholder} value={option}>
                  {option ? option.replaceAll("_", " ") : placeholder}
                </option>
              ))}
            </select>
          ))}
        </div>
      </section>

      <section className="card-soft overflow-hidden rounded-2xl shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-muted">Loading system issues...</div>
        ) : issues.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {[
                    "Issue",
                    "Flow",
                    "Source",
                    "Severity",
                    "Status",
                    "Occurrences",
                    "Last seen",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} className="border-t border-line align-top transition hover:bg-bg-soft/60">
                    <td className="max-w-[390px] px-4 py-4">
                      <div className="font-bold text-ink">{issue.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{issue.message}</div>
                      {(issue.route || issue.endpoint) && (
                        <code className="mt-2 block truncate rounded bg-bg-soft px-2 py-1 text-[11px] text-ink/75">
                          {issue.method ? `${issue.method} ` : ""}{issue.endpoint || issue.route}
                        </code>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-ink">{issue.actorType}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-2.5 py-1 text-xs font-bold text-muted">
                        {issue.source === "BACKEND" ? <FiServer /> : <FiActivity />}
                        {issue.source}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityClass[issue.severity] || "bg-bg-soft text-muted"}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[issue.status] || "bg-bg-soft text-muted"}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-ink">{issue.occurrenceCount}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{formatDateTime(issue.lastSeenAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openIssue(issue)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                          aria-label="View issue"
                        >
                          <FiEye />
                        </button>
                        {!isIntern && (
                          <button
                            type="button"
                            onClick={() => deleteIssue(issue)}
                            className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                            aria-label="Delete issue"
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green-100 text-2xl text-green-700">
              <FiCheckCircle />
            </span>
            <h3 className="mt-4 font-bold text-ink">No matching issues</h3>
            <p className="mt-1 text-sm text-muted">The selected filters have no recorded disturbances.</p>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>{pagination.total || 0} grouped issues</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            className="rounded-lg border border-line bg-white px-3 py-2 font-semibold text-ink disabled:opacity-40"
          >
            Previous
          </button>
          <span className="rounded-lg bg-white px-3 py-2">{page} / {pagination.pages || 1}</span>
          <button
            type="button"
            disabled={page >= (pagination.pages || 1)}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-line bg-white px-3 py-2 font-semibold text-ink disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {selectedIssue && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white p-5">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityClass[selectedIssue.severity]}`}>{selectedIssue.severity}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[selectedIssue.status]}`}>{selectedIssue.status}</span>
                  <span className="rounded-full bg-bg-soft px-2.5 py-1 text-xs font-bold text-muted">{selectedIssue.actorType}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-ink">{selectedIssue.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink hover:bg-bg-soft"
              >
                <FiX />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0 space-y-5">
                <section>
                  <h4 className="text-sm font-bold uppercase tracking-wide text-muted">Message</h4>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-bg-soft p-4 text-sm leading-6 text-ink">{selectedIssue.message}</p>
                </section>

                {selectedIssue.stack && (
                  <section>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-muted">Stack trace</h4>
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-200">{selectedIssue.stack}</pre>
                  </section>
                )}

                {selectedIssue.metadata && Object.keys(selectedIssue.metadata).length > 0 && (
                  <section>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-muted">Metadata</h4>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-bg-soft p-4 text-xs leading-5 text-ink">{JSON.stringify(selectedIssue.metadata, null, 2)}</pre>
                  </section>
                )}
              </div>

              <aside className="space-y-4">
                <div className="rounded-xl border border-line p-4 text-sm">
                  {[
                    ["Occurrences", selectedIssue.occurrenceCount],
                    ["First seen", formatDateTime(selectedIssue.firstSeenAt)],
                    ["Last seen", formatDateTime(selectedIssue.lastSeenAt)],
                    ["Source", selectedIssue.source],
                    ["HTTP status", selectedIssue.httpStatus || "-"],
                    ["Component", selectedIssue.component || "-"],
                    ["Route", selectedIssue.route || "-"],
                    ["Endpoint", selectedIssue.endpoint || "-"],
                    ["Environment", selectedIssue.environment || "-"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-line py-2 last:border-0">
                      <span className="text-muted">{label}</span>
                      <span className="break-words font-semibold text-ink">{value}</span>
                    </div>
                  ))}
                </div>

                {isIntern ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                    Read-only access. Resolution notes and status changes require an admin account.
                  </div>
                ) : (
                  <>
                    <label className="grid gap-2 text-sm">
                      <span className="font-bold text-ink">Admin note</span>
                      <textarea
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        rows={4}
                        placeholder="Investigation or resolution details"
                        className="resize-none rounded-xl border border-line px-3 py-2 outline-none focus:border-ink"
                      />
                    </label>

                    <div className="grid gap-2">
                      <button type="button" disabled={updating} onClick={() => updateStatus(selectedIssue, "INVESTIGATING")} className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900 disabled:opacity-50">Mark investigating</button>
                      <button type="button" disabled={updating} onClick={() => updateStatus(selectedIssue, "RESOLVED")} className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Mark resolved</button>
                      <button type="button" disabled={updating} onClick={() => updateStatus(selectedIssue, "OPEN")} className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">Reopen</button>
                      <button type="button" disabled={updating} onClick={() => updateStatus(selectedIssue, "IGNORED")} className="rounded-xl bg-bg-soft px-4 py-3 text-sm font-bold text-muted disabled:opacity-50">Ignore issue</button>
                    </div>
                  </>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
