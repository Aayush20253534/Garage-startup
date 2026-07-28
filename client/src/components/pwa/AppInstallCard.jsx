import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiInfo,
  FiRefreshCw,
  FiShare,
  FiSmartphone,
} from "react-icons/fi";

const safeStorageGet = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

const safeStorageRemove = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

const hasMatchingStartMarker = (pwaId) =>
  Boolean(pwaId) &&
  new URLSearchParams(window.location.search).get("pwa") === pwaId;

const getInstallEnvironment = () => {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIos =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isSamsung = /SamsungBrowser/i.test(userAgent);
  const isFirefox = /Firefox|FxiOS/i.test(userAgent);
  const isInAppBrowser =
    /FBAN|FBAV|Instagram|WhatsApp|Line\/|LinkedInApp|Snapchat|Pinterest|; wv\)/i.test(
      userAgent,
    );

  return {
    isAndroid,
    isFirefox,
    isInAppBrowser,
    isIos,
    isSamsung,
    isSecure: window.isSecureContext,
    supportsServiceWorker: "serviceWorker" in navigator,
  };
};

const getManualInstallSteps = (environment, appName) => {
  if (!environment.isSecure) {
    return [
      "Open the secure HTTPS version of this page.",
      "Reload the page and try the install button again.",
    ];
  }

  if (environment.isInAppBrowser) {
    return [
      "Open the browser menu in this in-app browser.",
      "Choose Open in Chrome, Open in Safari, or Open in browser.",
      `In that browser, choose Install ${appName} or Add to Home screen.`,
    ];
  }

  if (environment.isIos) {
    return [
      "Open this page in Safari.",
      "Tap the Share button in Safari.",
      "Choose Add to Home Screen, then tap Add.",
    ];
  }

  if (environment.isSamsung) {
    return [
      "Open the Samsung Internet menu.",
      "Choose Add page to, then Home screen, or choose Install app when shown.",
      `Confirm the installation of ${appName}.`,
    ];
  }

  if (environment.isAndroid) {
    return [
      "Open this page in Chrome, Edge, or Samsung Internet.",
      "Open the browser menu.",
      "Choose Install app or Add to Home screen.",
    ];
  }

  if (environment.isFirefox) {
    return [
      "Open this page in a browser that supports web-app installation, such as Chrome, Edge, or Safari.",
      `Use that browser's menu to install ${appName}.`,
    ];
  }

  return [
    "Look for the install icon in the browser address bar.",
    `Alternatively, open the browser menu and choose Install ${appName}.`,
    "Reload the page after updating the browser if the install option is missing.",
  ];
};

export default function AppInstallCard({
  appName,
  description,
  icon,
  promptKey,
  promptEvent,
  installedStorageKey,
  pwaId = "",
  compact = false,
}) {
  const environment = useMemo(() => getInstallEnvironment(), []);
  const manualSteps = useMemo(
    () => getManualInstallSteps(environment, appName),
    [appName, environment],
  );
  const [installPrompt, setInstallPrompt] = useState(
    () => window[promptKey] || null,
  );
  const [installed, setInstalled] = useState(() => {
    const launchedAsThisPwa = hasMatchingStartMarker(pwaId);
    return (
      isStandalone() ||
      launchedAsThisPwa ||
      Boolean(safeStorageGet(installedStorageKey))
    );
  });
  const [showHelp, setShowHelp] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hasMatchingStartMarker(pwaId)) {
      safeStorageSet(installedStorageKey, "1");
      setInstalled(true);
    }

    const syncInstallPrompt = () => {
      const prompt = window[promptKey] || null;
      setInstallPrompt(prompt);

      if (prompt && !isStandalone()) {
        safeStorageRemove(installedStorageKey);
        setInstalled(false);
        setMessage("");
      }
    };

    const handleInstalled = () => {
      window[promptKey] = null;
      safeStorageSet(installedStorageKey, "1");
      setInstallPrompt(null);
      setInstalled(true);
      setShowHelp(false);
      setMessage("");
    };

    const handleDisplayMode = () => {
      if (isStandalone()) {
        safeStorageSet(installedStorageKey, "1");
        setInstalled(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncInstallPrompt();
    };

    const media = window.matchMedia?.("(display-mode: standalone)");

    window.addEventListener(promptEvent, syncInstallPrompt);
    window.addEventListener("focus", syncInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    document.addEventListener("visibilitychange", handleVisibility);
    media?.addEventListener?.("change", handleDisplayMode);

    syncInstallPrompt();

    return () => {
      window.removeEventListener(promptEvent, syncInstallPrompt);
      window.removeEventListener("focus", syncInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      document.removeEventListener("visibilitychange", handleVisibility);
      media?.removeEventListener?.("change", handleDisplayMode);
    };
  }, [installedStorageKey, promptEvent, promptKey, pwaId]);

  const install = async () => {
    setMessage("");

    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    const promptToUse = installPrompt;

    // A BeforeInstallPromptEvent can be used only once. Clear it before
    // prompting so a dismissed or failed prompt cannot be reused accidentally.
    window[promptKey] = null;
    setInstallPrompt(null);

    try {
      setInstalling(true);
      await promptToUse.prompt();
      const choice = await promptToUse.userChoice;

      if (choice?.outcome === "accepted") {
        safeStorageSet(installedStorageKey, "1");
        setInstalled(true);
        setShowHelp(false);
      } else {
        setMessage(
          "Installation was cancelled. You can try again from the browser menu.",
        );
        setShowHelp(true);
      }
    } catch (error) {
      console.warn("PWA install prompt failed:", error);
      setMessage(
        "The browser could not open its install prompt. Use the steps below instead.",
      );
      setShowHelp(true);
    } finally {
      setInstalling(false);
    }
  };

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Copy the address from the browser bar and open it in Chrome or Safari.");
    }
  };

  const resetInstallCheck = () => {
    safeStorageRemove(installedStorageKey);
    setInstalled(false);
    setMessage("");
    window.location.reload();
  };

  if (installed) {
    return (
      <section
        className={[
          "min-w-0 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50",
          compact ? "p-3.5" : "p-4 sm:p-5",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <FiCheckCircle />
            </span>
            <div className="min-w-0">
              <p className="break-words font-bold text-emerald-900">
                {appName} is installed
              </p>
              <p className="mt-1 break-words text-sm leading-5 text-emerald-800">
                Open it from the app icon on your home screen for the full-screen experience.
              </p>
            </div>
          </div>

          {!isStandalone() && (
            <button
              type="button"
              onClick={resetInstallCheck}
              className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100 sm:w-auto"
            >
              <FiRefreshCw />
              Recheck
            </button>
          )}
        </div>
      </section>
    );
  }

  const directInstallAvailable = Boolean(installPrompt);
  const actionLabel = directInstallAvailable
    ? "Install app"
    : showHelp
      ? "Hide install help"
      : "Show install help";

  return (
    <section
      className={[
        "min-w-0 overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-soft",
        compact ? "p-4" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-3">
        <img
          src={icon}
          alt={`${appName} app`}
          width="512"
          height="512"
          decoding="async"
          className="h-12 w-12 rounded-xl object-cover shadow-sm ring-1 ring-black/10"
        />

        <div className="min-w-0">
          <h3 className="break-words text-base font-bold sm:text-lg">
            Install {appName}
          </h3>
          <p className="mt-1 break-words text-sm leading-5 text-muted sm:leading-6">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!directInstallAvailable && showHelp) {
            setShowHelp(false);
            return;
          }
          void install();
        }}
        disabled={installing}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-extrabold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {directInstallAvailable ? <FiDownload /> : <FiInfo />}
        <span>{installing ? "Opening install prompt..." : actionLabel}</span>
      </button>

      {!directInstallAvailable && !showHelp && (
        <p className="mt-3 text-center text-xs leading-5 text-muted">
          Direct installation is not available in every browser. The help button shows the correct manual steps for this device.
        </p>
      )}

      {message && (
        <div className="mt-4 flex min-w-0 items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{message}</span>
        </div>
      )}

      {showHelp && (
        <div className="mt-4 min-w-0 rounded-xl border border-line bg-bg-soft p-3 sm:p-4">
          <div className="flex min-w-0 items-start gap-2">
            {environment.isIos ? (
              <FiShare className="mt-0.5 shrink-0" />
            ) : (
              <FiSmartphone className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-ink">Install on this device</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Follow these steps in order. Menu wording can vary slightly by browser version.
              </p>
            </div>
          </div>

          <ol className="mt-3 space-y-2">
            {manualSteps.map((step, index) => (
              <li
                key={step}
                className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-lg border border-line bg-white p-2.5"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 break-words text-sm leading-5 text-muted">
                  {step}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-3 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
            <button
              type="button"
              onClick={() => void copyCurrentUrl()}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-ink transition hover:bg-gray-50"
            >
              <FiCopy className="shrink-0" />
              <span className="truncate">{copied ? "Link copied" : "Copy page link"}</span>
            </button>
            <button
              type="button"
              onClick={resetInstallCheck}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-ink transition hover:bg-gray-50"
            >
              <FiExternalLink className="shrink-0" />
              <span className="truncate">Reload and recheck</span>
            </button>
          </div>

          {(!environment.supportsServiceWorker || !environment.isSecure) && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
              {!environment.isSecure
                ? "PWA installation requires a secure HTTPS page."
                : "This browser does not support service workers, so it cannot install the full Rovauto web app."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
