import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiHeadphones,
  FiInbox,
  FiMail,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiZap,
} from "react-icons/fi";

import { customerSupportApi } from "@/api/customerSupport";
import PushNotificationControl from "@/components/PushNotificationControl";

const formatLabel = (value) =>
  String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export default function CustomerSupportDashboard() {
  const [data, setData] = useState({ stats: {}, recentTickets: [], recentNotifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await customerSupportApi.getDashboard();
      setData(result || { stats: {}, recentTickets: [], recentNotifications: [] });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = data.stats || {};
  const cards = useMemo(
    () => [
      [FiInbox, stats.unassigned || 0, "Unassigned queue", "Tickets ready to claim"],
      [FiUserCheck, stats.assignedToMe || 0, "Assigned to me", "My active workload"],
      [FiClock, stats.waitingCustomer || 0, "Waiting customer", "Replies sent, awaiting customer"],
      [FiZap, stats.urgent || 0, "Urgent", "Urgent available or assigned cases"],
      [FiShield, stats.openDisputes || 0, "Open disputes", "Disputes needing investigation"],
      [FiCheckCircle, stats.resolvedToday || 0, "Resolved today", "My resolved support cases"],
      [FiBell, stats.unreadNotifications || 0, "Unread alerts", "Queue and assignment updates"],
      [FiMail, stats.emailsSentToday || 0, "Emails today", "Customer emails sent by me"],
    ],
    [stats],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Customer support operations
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink">
              <FiHeadphones /> Support dashboard
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Claim customer cases, respond safely, send email, and monitor your queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-ink hover:bg-bg-soft disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      <PushNotificationControl compact scope="support" />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([Icon, value, title, detail]) => (
          <div key={title} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg-soft text-lg text-ink">
                <Icon />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-ink">{value}</p>
                <p className="text-sm font-bold text-ink">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Recent support cases</h2>
              <p className="text-sm text-muted">Unassigned cases and tickets assigned to you.</p>
            </div>
            <Link to="/support/tickets" className="text-sm font-bold text-ink underline underline-offset-4">
              Open queue
            </Link>
          </div>

          <div className="mt-4 grid gap-3">
            {(data.recentTickets || []).length ? (
              data.recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/support/tickets?ticket=${ticket.id}`}
                  className="rounded-xl border border-line p-4 transition hover:border-ink hover:bg-bg-soft"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-ink">{ticket.ticketCode} · {ticket.subject}</p>
                    <span className="rounded-full bg-bg-soft px-2.5 py-1 text-xs font-bold text-ink">
                      {formatLabel(ticket.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {ticket.user?.name} · {formatLabel(ticket.type)} · {formatLabel(ticket.priority)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {ticket.supportAssignee?.name
                      ? `Assigned to ${ticket.supportAssignee.name}`
                      : "Unassigned"} · Updated {formatDate(ticket.lastMessageAt)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-bg-soft p-4 text-sm text-muted">No support cases yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Latest alerts</h2>
              <p className="text-sm text-muted">Assignments and customer replies.</p>
            </div>
            <Link to="/support/notify" className="text-sm font-bold text-ink underline underline-offset-4">
              View all
            </Link>
          </div>

          <div className="mt-4 grid gap-3">
            {(data.recentNotifications || []).length ? (
              data.recentNotifications.map((item) => (
                <Link
                  key={item.id}
                  to={item.link || "/support/notify"}
                  className={`rounded-xl border p-3 ${item.isRead ? "border-line" : "border-amber-200 bg-amber-50"}`}
                >
                  <p className="text-sm font-bold text-ink">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{item.message}</p>
                  <p className="mt-1 text-[11px] text-muted">{formatDate(item.createdAt)}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-bg-soft p-4 text-sm text-muted">No received alerts yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
