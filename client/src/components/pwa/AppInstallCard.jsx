import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiMoreVertical,
  FiRefreshCw,
  FiShare,
  FiSmartphone,
} from "react-icons/fi";

const isIosDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

export default function AppInstallCard({
  appName,
  description,
  icon,
  promptKey,
  promptEvent,
  installedStorageKey,
  pwaId = "",
  compact = false,
  dark = true,
}) {
  const [installPrompt, setInstallPrompt] = useState(
    () => window[promptKey] || null,
  );
  const hasMatchingStartMarker = () =>
    Boolean(pwaId) &&
    new URLSearchParams(window.location.search).get("pwa") === pwaId;

  const [installed, setInstalled] = useState(() =>
    (Boolean(localStorage.getItem(installedStorageKey)) &&
      !window[promptKey]) ||
    (isStandalone() && (!pwaId || hasMatchingStartMarker())),
  );
  const [showHelp, setShowHelp] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (hasMatchingStartMarker()) {
      localStorage.setItem(installedStorageKey, "1");
      setInstalled(true);
    }

    const syncInstallPrompt = () => {
      const prompt = window[promptKey] || null;
      setInstallPrompt(prompt);

      if (prompt && !isStandalone()) {
        localStorage.removeItem(installedStorageKey);
        setInstalled(false);
      }
    };
    const handleInstalled = () => {
      window[promptKey] = null;
      localStorage.setItem(installedStorageKey, "1");
      setInstallPrompt(null);
      setInstalled(true);
    };
    const media = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayMode = () => {
      if (
        isStandalone() &&
        (!pwaId ||
          hasMatchingStartMarker() ||
          Boolean(localStorage.getItem(installedStorageKey)))
      ) {
        setInstalled(true);
      }
    };

    window.addEventListener(promptEvent, syncInstallPrompt);
    window.addEventListener("focus", syncInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    document.addEventListener("visibilitychange", syncInstallPrompt);
    media?.addEventListener?.("change", handleDisplayMode);

    syncInstallPrompt();

    return () => {
      window.removeEventListener(promptEvent, syncInstallPrompt);
      window.removeEventListener("focus", syncInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      document.removeEventListener("visibilitychange", syncInstallPrompt);
      media?.removeEventListener?.("change", handleDisplayMode);
    };
  }, [installedStorageKey, promptEvent, promptKey, pwaId]);

  const device = useMemo(() => {
    if (isIosDevice()) return "ios";
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
        window[promptKey] = null;
        localStorage.setItem(installedStorageKey, "1");
        setInstallPrompt(null);
        setInstalled(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  const reinstall = async () => {
    localStorage.removeItem(installedStorageKey);
    setInstalled(false);

    if (installPrompt) {
      await install();
      return;
    }

    setShowHelp(true);
  };

  if (installed) {
    return (
      <section
        className={[
          "rounded-2xl border border-emerald-200 bg-emerald-50",
          compact ? "p-3.5" : "p-4 sm:p-5",
        ].join(" ")}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <FiCheckCircle />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-emerald-900">
                {appName} is installed
              </p>
              <p className="mt-1 text-sm leading-5 text-emerald-800">
                Open it from its app icon for the best full-screen experience.
              </p>
            </div>
          </div>

          {!isStandalone() && (
            <button
              type="button"
              onClick={() => void reinstall()}
              disabled={installing}
              className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {installPrompt ? <FiDownload /> : <FiRefreshCw />}
              {installing ? "Opening..." : "Install again"}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className={[
        "rounded-2xl border shadow-soft",
        dark
          ? "border-slate-800 bg-slate-950 text-white"
          : "border-line bg-white text-ink",
        compact ? "p-4" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <img
            src={icon}
            alt={`${appName} app`}
            width="512"
            height="512"
            decoding="async"
            className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-black/10"
          />
          <div className="min-w-0">
            <h3 className="font-bold">Install {appName}</h3>
            <p
              className={[
                "mt-1 text-sm leading-5",
                dark ? "text-slate-300" : "text-muted",
              ].join(" ")}
            >
              {description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void install()}
          disabled={installing}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <FiDownload /> {installing ? "Opening..." : "Install app"}
        </button>
      </div>

      {(showHelp || (!installPrompt && device === "ios")) && (
        <div
          className={[
            "mt-4 rounded-xl border p-3 text-sm leading-6",
            dark
              ? "border-white/15 bg-white/5 text-slate-200"
              : "border-line bg-bg-soft text-muted",
          ].join(" ")}
        >
          {device === "ios" ? (
            <p className="flex items-start gap-2">
              <FiShare className="mt-1 shrink-0" />
              In Safari, tap Share and choose <strong>Add to Home Screen</strong>.
            </p>
          ) : device === "android" ? (
            <p className="flex items-start gap-2">
              <FiMoreVertical className="mt-1 shrink-0" />
              Open the browser menu and choose <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong>.
            </p>
          ) : (
            <p className="flex items-start gap-2">
              <FiSmartphone className="mt-1 shrink-0" />
              Use the install icon in the address bar, or choose{" "}
              <strong>Install {appName}</strong> from the browser menu.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
