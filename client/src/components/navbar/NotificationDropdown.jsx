import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiBell,
  FiCheck,
  FiCreditCard,
  FiGift,
  FiRefreshCw,
  FiShield,
  FiTool,
  FiX,
} from "react-icons/fi";

const TYPE_STYLES = {
  BOOKING: {
    label: "Booking",
    Icon: FiTool,
    iconClass: "bg-sky-50 text-sky-700",
  },
  PAYMENT: {
    label: "Payment",
    Icon: FiCreditCard,
    iconClass: "bg-emerald-50 text-emerald-700",
  },
  WARRANTY: {
    label: "Warranty",
    Icon: FiShield,
    iconClass: "bg-violet-50 text-violet-700",
  },
  PROMOTION: {
    label: "Offer",
    Icon: FiGift,
    iconClass: "bg-amber-50 text-amber-700",
  },
  SOS: {
    label: "Urgent",
    Icon: FiAlertTriangle,
    iconClass: "bg-red-50 text-red-700",
  },
  SYSTEM: {
    label: "Update",
    Icon: FiBell,
    iconClass: "bg-bg-soft text-ink",
  },
};

const formatNotificationTime = (date) => {
  if (!date) return "";

  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
};

const getPreviewMessage = (notification) => {
  const fallback = notification.message || "You have a new update.";
  const containsOtp =
    notification.metadata?.purpose === "VEHICLE_HANDOVER" ||
    /\botp\b/i.test(notification.title || "") ||
    /\botp\b/i.test(fallback);

  if (!containsOtp) return fallback;

  return fallback.replace(/\b\d{6}\b/g, "••••••");
};

function NotificationSkeleton() {
  return (
    <div className="grid gap-1 p-2" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex gap-3 rounded-2xl px-3 py-3.5">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-bg-soft" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="mb-2 h-3 w-24 animate-pulse rounded-full bg-bg-soft" />
            <div className="mb-2 h-3.5 w-4/5 animate-pulse rounded-full bg-bg-soft" />
            <div className="h-3 w-full animate-pulse rounded-full bg-bg-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationItem({ notification, onSelect }) {
  const typeStyle = TYPE_STYLES[notification.type] || TYPE_STYLES.SYSTEM;
  const { Icon } = typeStyle;
  const isUnread = !notification.isRead;

  const content = (
    <>
      {isUnread && (
        <span
          className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand"
          aria-label="Unread"
        />
      )}

      <span
        className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base ${typeStyle.iconClass}`}
      >
        <Icon aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          <span>{typeStyle.label}</span>
          <span className="h-1 w-1 rounded-full bg-line" />
          <span className="normal-case tracking-normal">
            {formatNotificationTime(notification.createdAt)}
          </span>
        </span>

        <span className="mt-1 block line-clamp-1 text-sm font-bold leading-5 text-ink">
          {notification.title || "Notification"}
        </span>

        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted">
          {getPreviewMessage(notification)}
        </span>

        {notification.link && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-ink">
            View details
            <FiArrowUpRight
              className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        )}
      </span>
    </>
  );

  const className = [
    "group relative flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left outline-none transition",
    "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    isUnread
      ? "border-brand/30 bg-brand/10 hover:border-brand/50 hover:bg-brand/15"
      : "border-transparent hover:border-line hover:bg-bg-soft/70",
  ].join(" ");

  if (notification.link) {
    return (
      <Link
        to={notification.link}
        onClick={(event) => onSelect(event, notification)}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => onSelect(event, notification)}
      className={className}
    >
      {content}
    </button>
  );
}

export default function NotificationDropdown({
  notifications,
  loading,
  error,
  unreadCount,
  markingAllRead,
  onClose,
  onRetry,
  onMarkAllRead,
  onNotificationSelect,
  onViewAll,
  showCloseButton = false,
}) {
  const visibleUnreadCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <div className="overflow-hidden rounded-[inherit] bg-white">
      <div className="h-1 bg-brand" />

      <div className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink text-brand">
          <FiBell aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-ink">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold text-black">
                {visibleUnreadCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {unreadCount > 0
              ? `${visibleUnreadCount} unread update${unreadCount === 1 ? "" : "s"}`
              : "You are all caught up"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={markingAllRead}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-[11px] font-bold text-ink transition hover:border-ink/20 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {markingAllRead ? (
                <FiRefreshCw className="animate-spin" aria-hidden="true" />
              ) : (
                <FiCheck aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Read all</span>
            </button>
          )}

          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-bg-soft hover:text-ink"
              aria-label="Close notifications"
            >
              <FiX aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[390px] overflow-y-auto overscroll-contain">
        {loading ? (
          <NotificationSkeleton />
        ) : error ? (
          <div className="p-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                Notifications could not be loaded
              </p>
              <p className="mt-1 text-xs leading-5 text-red-600">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-red-700 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100"
              >
                <FiRefreshCw aria-hidden="true" />
                Try again
              </button>
            </div>
          </div>
        ) : notifications.length > 0 ? (
          <div className="grid gap-1 p-2">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onSelect={onNotificationSelect}
              />
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-bg-soft text-xl text-muted">
              <FiBell aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-bold text-ink">No notifications yet</p>
            <p className="mx-auto mt-1 max-w-[250px] text-xs leading-5 text-muted">
              Booking, payment, warranty and service updates will appear here.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-line bg-bg-soft/60 p-3">
        <Link
          to="/dashboard/notifications"
          onClick={onViewAll}
          className="group flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          View all notifications
          <FiArrowUpRight
            className="text-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </div>
  );
}
