import { useCallback, useEffect, useState } from "react";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";

export default function useUnreadNotifications() {
  const { user, token } = useApp();
  const [unreadCount, setUnreadCount] = useState(0);
  const isCustomer = Boolean(user && user.role === "CUSTOMER");

  const refreshUnreadNotifications = useCallback(async () => {
    if (!isCustomer || !token) {
      setUnreadCount(0);
      return 0;
    }

    try {
      const response = await api.get("/notifications");
      const notifications = Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      const nextCount = notifications.filter((item) => !item.isRead).length;
      setUnreadCount(nextCount);
      return nextCount;
    } catch {
      return unreadCount;
    }
  }, [isCustomer, token, unreadCount]);

  useEffect(() => {
    if (!isCustomer || !token) {
      setUnreadCount(0);
      return undefined;
    }

    refreshUnreadNotifications();

    const interval = window.setInterval(refreshUnreadNotifications, 30000);
    const handleFocus = () => refreshUnreadNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshUnreadNotifications();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isCustomer, token, refreshUnreadNotifications]);

  return { unreadCount, refreshUnreadNotifications };
}
