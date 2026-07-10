import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiMoreVertical,
  FiShare,
  FiSmartphone,
} from "react-icons/fi";

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

export default function SupportPwaInstall({ compact = false }) {
  const [installPrompt, setInstallPrompt] = useState(
    () => window.__ROVAUTO_SUPPORT_INSTALL_PROMPT__ || null,
  );
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showHelp, setShowHelp] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handlePromptReady = () => {
      setInstallPrompt(window.__ROVAUTO_SUPPORT_INSTALL_PROMPT__ || null);
    };
    const handleInstalled = () => {
      window.__ROVAUTO_SUPPORT_INSTALL_PROMPT__ = null;
      setInstallPrompt(null);
      setInstalled(true);
    };
    const media = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayMode = () => setInstalled(isStandalone());

    window.addEventListener("rovauto-support-install-ready", handlePromptReady);
    window.addEventListener("appinstalled", handleInstalled);
    media?.addEventListener?.("change", handleDisplayMode);

    return () => {
      window.removeEventListener("rovauto-support-install-ready", handlePromptReady);
      window.removeEventListener("appinstalled", handleInstalled);
      media?.removeEventListener?.("change", handleDisplayMode);
    };
  }, []);

  const device = useMemo(() => {
    if (isIos()) return "ios";
    if (/Android/i.test(navigator.userAgent)) return "android";
    return "desktop";
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    try {
      setInstalling(true);
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice?.outcome === "accepted") {
        window.__ROVAUTO_SUPPORT_INSTALL_PROMPT__ = null;
        setInstallPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  };

  if (installed) {
    return (
      <section
        className={[
          "rounded-xl border border-emerald-200 bg-emerald-50",
          compact ? "mt-4 p-3" : "p-4 sm:p-5",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <FiCheckCircle />
          </span>
          <div>
            <p className="font-bold text-emerald-900">Rovauto Support is installed</p>
            <p className="mt-1 text-sm leading-5 text-emerald-800">
              Open it from its separate app icon to access the support workspace and alerts.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={[
        "rounded-xl border border-slate-200 bg-slate-950 text-white shadow-soft",
        compact ? "mt-4 p-4" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <img
            src="/support-icon-192.png"
            alt="Rovauto Support app"
            className="h-12 w-12 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <h3 className="font-bold">Install Rovauto Support</h3>
            <p className="mt-1 text-sm leading-5 text-slate-300">
              Install the dedicated support app with its own icon, start screen and PWA notifications.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void install()}
          disabled={installing}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiDownload /> {installing ? "Opening..." : "Install app"}
        </button>
      </div>

      {(showHelp || (!installPrompt && device === "ios")) && (
        <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-3 text-sm leading-6 text-slate-200">
          {device === "ios" ? (
            <p className="flex items-start gap-2">
              <FiShare className="mt-1 shrink-0" />
              In Safari, tap Share, choose <strong>Add to Home Screen</strong>, then open Rovauto Support from the new icon.
            </p>
          ) : device === "android" ? (
            <p className="flex items-start gap-2">
              <FiMoreVertical className="mt-1 shrink-0" />
              Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </p>
          ) : (
            <p className="flex items-start gap-2">
              <FiSmartphone className="mt-1 shrink-0" />
              Use the install icon in the browser address bar, or open the browser menu and choose <strong>Install Rovauto Support</strong>.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
