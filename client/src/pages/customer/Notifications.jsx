import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/axios";
import { FiBell, FiCheckCircle } from "react-icons/fi";
import PushNotificationControl from "@/components/PushNotificationControl";

const formatTime = (date) => {
  if (!date) return "";

  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days === 1) return "Yesterday";

  return `${days} days ago`;
};

const notifyUnreadChanged = (items) => {
  const unreadCount = items.filter((item) => !item.isRead).length;
  window.dispatchEvent(
    new CustomEvent("rov:notifications-updated", {
      detail: { unreadCount },
    }),
  );
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingIds, setMarkingIds] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/notifications");
      setNotifications(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (notification) => {
    if (notification.isRead || markingIds.includes(notification.id)) return;

    const previous = notifications;
    const optimistic = notifications.map((item) =>
      item.id === notification.id ? { ...item, isRead: true } : item,
    );
    setNotifications(optimistic);
    notifyUnreadChanged(optimistic);
    setMarkingIds((current) => [...current, notification.id]);
    setError("");

    try {
      await api.patch(`/notifications/${notification.id}/read`);
    } catch (err) {
      setNotifications(previous);
      notifyUnreadChanged(previous);
      setError(
        err.response?.data?.message || "Failed to mark notification read",
      );
    } finally {
      setMarkingIds((current) =>
        current.filter((id) => id !== notification.id),
      );
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;

    const previous = notifications;
    const optimistic = notifications.map((item) => ({ ...item, isRead: true }));
    setNotifications(optimistic);
    notifyUnreadChanged(optimistic);
    setMarkingAll(true);
    setError("");

    try {
      await api.patch("/notifications/read-all");
    } catch (err) {
      setNotifications(previous);
      notifyUnreadChanged(previous);
      setError(err.response?.data?.message || "Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Notifications</h2>
        <div className="card-soft p-6 text-muted">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Notifications</h2>

        {notifications.some((item) => !item.isRead) && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft"
          >
            <FiCheckCircle className={markingAll ? "animate-pulse" : ""} />
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      <PushNotificationControl />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {notifications.map((notification) => {
          const Card = notification.link ? Link : "button";

          return (
            <div
              key={notification.id}
              className={`card-soft flex items-center gap-3 p-4 text-left transition-all duration-200 sm:gap-4 ${
                !notification.isRead ? "border-l-4 border-l-brand bg-brand/[0.03]" : "border-l-4 border-l-transparent"
              }`}
            >
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand">
                <FiBell />
              </span>

              <Card
                to={notification.link || undefined}
                type={notification.link ? undefined : "button"}
                onClick={() => markRead(notification)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="font-medium">{notification.title}</div>
                <div className="text-xs text-muted">{notification.message}</div>
                <div className="text-xs text-muted mt-1">
                  {formatTime(notification.createdAt)}
                </div>
              </Card>

              {!notification.isRead ? (
                <button
                  type="button"
                  onClick={() => markRead(notification)}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft"
                >
                  <FiCheckCircle />
                  Mark as read
                </button>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-bg-soft px-2.5 py-1.5 text-xs font-semibold text-muted transition-all duration-200">
                  <FiCheckCircle /> Read
                </span>
              )}
            </div>
          );
        })}

        {notifications.length === 0 && (
          <div className="card-soft p-8 text-center text-muted">
            No notifications yet. Peaceful. Suspicious, but peaceful.
          </div>
        )}
      </div>
    </div>
  );
}
