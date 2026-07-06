import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";

const UPDATE_EVENT = "rovauto:system-issues-updated";

export const notifySystemIssuesUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UPDATE_EVENT));
  }
};

export default function useOpenSystemIssueCount({ enabled = true } = {}) {
  const [openIssueCount, setOpenIssueCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setOpenIssueCount(0);
      return undefined;
    }

    let active = true;

    const load = async () => {
      try {
        const stats = await adminApi.getSystemIssueStats({
          skipErrorReporting: true,
        });
        if (active) setOpenIssueCount(Number(stats.active || 0));
      } catch {
        if (active) setOpenIssueCount(0);
      }
    };

    load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener(UPDATE_EVENT, load);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(UPDATE_EVENT, load);
    };
  }, [enabled]);

  return { openIssueCount };
}
