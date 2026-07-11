import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle,
  FiBell,
  FiCheck,
  FiRefreshCw,
  FiSend,
} from "react-icons/fi";

import { customerSupportApi } from "@/api/customerSupport";
import PushNotificationControl from "@/components/PushNotificationControl";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const readableType = (value) =>
  String(value || "SYSTEM").replaceAll("_", " ").toLowerCase();

export default function CustomerSupportNotify() {
  const [data, setData] = useState({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const announceUnreadCount = (unreadCount) => {
    window.dispatchEvent(
      new CustomEvent("rov:support-notifications-updated", {
        detail: { unreadCount },
      }),
    );
  };

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      setError("");
      const result = await customerSupportApi.getNotifies();
      const next = result || { items: [], unreadCount: 0 };
      setData(next);
      announceUnreadCount(next.unreadCount || 0);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load received support alerts",
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const intervalId = window.setInterval(() => void load({ quiet: true }), 30000);
    const refreshOnFocus = () => void load({ quiet: true });
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") refreshOnFocus();
    };

    const refreshOnPush = (event) => {
      if (["ROVAUTO_SUPPORT_PUSH_RECEIVED", "ROVAUTO_PUSH_RECEIVED"].includes(event.data?.type)) refreshOnFocus();
    };

    window.addEventListener("focus", refreshOnFocus);
    navigator.serviceWorker?.addEventListener("message", refreshOnPush);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      navigator.serviceWorker?.removeEventListener("message", refreshOnPush);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [load]);

  const markRead = async (item) => {
    if (item.isRead) return;

    await customerSupportApi.markNotifyRead(item.id);
    setData((current) => {
      const unreadCount = Math.max((current.unreadCount || 0) - 1, 0);
      announceUnreadCount(unreadCount);
      return {
        items: current.items.map((entry) =>
          entry.id === item.id ? { ...entry, isRead: true } : entry,
        ),
        unreadCount,
      };
    });
  };

  const markAll = async () => {
    await customerSupportApi.markAllNotifiesRead();
    setData((current) => ({
      items: current.items.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
    }));
    announceUnreadCount(0);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Received support alerts
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink">
              <FiBell /> Received alerts
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              New tickets, customer replies, disputes, and admin assignments are
              stored here separately from notifications you send to customers.
            </p>
          </div>
          <Link
            to="/support/notifications"
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-ink hover:bg-bg-soft sm:w-auto"
          >
            <FiSend /> Send customer notification
          </Link>
        </div>
      </section>

      <PushNotificationControl scope="support" />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-ink">Received alert history</h2>
            <p className="mt-1 text-sm text-muted">
              These records come from the dedicated Notify database table.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-ink disabled:opacity-50 sm:px-4"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={!data.unreadCount}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-bold text-white disabled:opacity-40 sm:px-4"
            >
              <FiCheck /> Mark all read
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Inbox</h3>
          <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-ink">
            {data.unreadCount || 0} unread
          </span>
        </div>

        <div className="mt-3 grid gap-3">
          {loading ? (
            <p className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
              Loading alerts...
            </p>
          ) : (data.items || []).length ? (
            data.items.map((item) => (
              <Link
                key={item.id}
                to={item.link || "/support/notify"}
                onClick={() => void markRead(item)}
                className={`rounded-xl border p-4 transition hover:border-ink ${
                  item.isRead
                    ? "border-line bg-white"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{item.title}</p>
                      <span className="rounded-full bg-bg-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                        {readableType(item.type)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {item.message}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  {!item.isRead && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                  )}
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
              No received support alerts yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
