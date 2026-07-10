import { useEffect, useState } from "react";
import {
  FiBell,
  FiBellOff,
  FiCheckCircle,
  FiSmartphone,
} from "react-icons/fi";

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationStatus,
} from "@/utils/pushNotifications";

const STATUS_CONTENT = {
  checking: {
    icon: FiBell,
    title: "App notifications",
    message: "Checking this device...",
  },
  enabled: {
    icon: FiCheckCircle,
    title: "App notifications enabled",
    message: "Booking and account alerts can appear like normal app notifications.",
  },
  prompt: {
    icon: FiBell,
    title: "Enable app notifications",
    message: "Receive important alerts even when Rovauto is closed.",
  },
  disabled: {
    icon: FiBellOff,
    title: "App notifications are off",
    message: "Enable them again on this device whenever you need them.",
  },
  denied: {
    icon: FiBellOff,
    title: "Notifications are blocked",
    message: "Allow Rovauto notifications in your browser or device settings.",
  },
  "install-required": {
    icon: FiSmartphone,
    title: "Install Rovauto first",
    message:
      "On iPhone or iPad, add Rovauto to the Home Screen, open the installed app, then enable notifications.",
  },
  unsupported: {
    icon: FiBellOff,
    title: "App notifications unavailable",
    message: "This browser or device does not support Web Push notifications.",
  },
};

const SUPPORT_STATUS_CONTENT = {
  enabled: {
    title: "Support app notifications enabled",
    message: "New tickets, disputes, customer replies, and assignments can appear like normal app notifications.",
  },
  prompt: {
    title: "Enable support app notifications",
    message: "Receive new-ticket alerts even when the Rovauto support portal is closed.",
  },
  disabled: {
    title: "Support app notifications are off",
    message: "Enable them on this device to receive new-ticket alerts.",
  },
};

export default function PushNotificationControl({ compact = false, scope = "user" }) {
  const [status, setStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshStatus = async () => {
    try {
      setStatus(await getPushNotificationStatus());
    } catch {
      setStatus("unsupported");
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleEnable = async () => {
    try {
      setLoading(true);
      setError("");
      await enablePushNotifications({ scope });
      setStatus("enabled");
    } catch (err) {
      setError(err.message || "Unable to enable app notifications.");
      await refreshStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    try {
      setLoading(true);
      setError("");
      await disablePushNotifications({ scope });
      setStatus("disabled");
    } catch (err) {
      setError(err.message || "Unable to disable app notifications.");
      await refreshStatus();
    } finally {
      setLoading(false);
    }
  };

  const baseContent = STATUS_CONTENT[status] || STATUS_CONTENT.unsupported;
  const content =
    scope === "support" && SUPPORT_STATUS_CONTENT[status]
      ? { ...baseContent, ...SUPPORT_STATUS_CONTENT[status] }
      : baseContent;
  const Icon = content.icon;
  const canEnable = status === "prompt" || status === "disabled";
  const canDisable = status === "enabled";

  return (
    <section
      className={[
        "rounded-xl border border-line bg-white",
        compact ? "p-4" : "card-soft mb-5 p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg-soft text-ink">
            <Icon />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-ink">{content.title}</h3>
            <p className="mt-1 text-sm leading-5 text-muted">{content.message}</p>
          </div>
        </div>

        {(canEnable || canDisable) && (
          <button
            type="button"
            onClick={canDisable ? handleDisable : handleEnable}
            disabled={loading}
            className={[
              "inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
              canDisable
                ? "border border-line bg-white text-ink hover:bg-bg-soft"
                : "bg-brand text-black hover:bg-brand-dark",
            ].join(" ")}
          >
            {loading
              ? "Updating..."
              : canDisable
                ? "Disable"
                : "Enable"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
