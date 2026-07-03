import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/axios";
import { FiBell } from "react-icons/fi";

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

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    if (notification.isRead) return;

    try {
      await api.patch(`/notifications/${notification.id}/read`);

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to mark notification read",
      );
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");

      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark all as read");
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
            className="btn-ghost text-sm"
          >
            Mark all read
          </button>
        )}
      </div>

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
              className={`card-soft p-4 flex items-center gap-4 text-left ${
                !notification.isRead ? "border-l-4 border-l-brand" : ""
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
                  className="btn-ghost shrink-0 text-xs"
                >
                  Mark as read
                </button>
              ) : (
                <span className="chip-brand shrink-0 bg-bg-soft text-muted">
                  Read
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
