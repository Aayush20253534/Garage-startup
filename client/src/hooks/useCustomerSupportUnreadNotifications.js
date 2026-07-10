import { useCallback, useEffect, useState } from "react";

import { customerSupportApi } from "@/api/customerSupport";
import { useApp } from "@/hooks/useApp";

export default function useCustomerSupportUnreadNotifications() {
  const { user, token } = useApp();
  const [unreadCount, setUnreadCount] = useState(0);
  const isCustomerSupport = Boolean(
    user?.role === "CUSTOMER_SUPPORT" &&
      user?.accountType === "CUSTOMER_SUPPORT",
  );

  const refreshUnreadNotifications = useCallback(async () => {
    if (!isCustomerSupport || !token) {
      setUnreadCount(0);
      return 0;
    }

    try {
      const result = await customerSupportApi.getNotifies();
      const nextCount = Number(result?.unreadCount || 0);
      setUnreadCount(nextCount);
      return nextCount;
    } catch {
      return unreadCount;
    }
  }, [isCustomerSupport, token, unreadCount]);

  useEffect(() => {
    if (!isCustomerSupport || !token) {
      setUnreadCount(0);
      return undefined;
    }

    void refreshUnreadNotifications();

    const intervalId = window.setInterval(refreshUnreadNotifications, 30000);
    const refresh = () => void refreshUnreadNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const handleUpdated = (event) => {
      if (typeof event.detail?.unreadCount === "number") {
        setUnreadCount(event.detail.unreadCount);
        return;
      }
      refresh();
    };

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === "ROVAUTO_PUSH_RECEIVED") refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("rov:support-notifications-updated", handleUpdated);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "rov:support-notifications-updated",
        handleUpdated,
      );
      navigator.serviceWorker?.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isCustomerSupport, token, refreshUnreadNotifications]);

  return { unreadCount, refreshUnreadNotifications };
}
