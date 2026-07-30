const CHUNK_RELOAD_KEY_PREFIX = "rovauto:stale-chunk-reload";
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;
const MISSING_LAZY_DEFAULT_CODE = "MISSING_LAZY_DEFAULT";

const LOCAL_FRONTEND_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_CACHE_PREFIX = "rovauto-";

export const isLocalFrontendHost = () =>
  typeof window !== "undefined" &&
  LOCAL_FRONTEND_HOSTS.has(window.location.hostname);

export const clearLocalFrontendState = async () => {
  if (!isLocalFrontendHost()) return;

  const cleanupTasks = [];

  if ("serviceWorker" in navigator) {
    cleanupTasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) => {
                try {
                  return new URL(registration.scope).origin === window.location.origin;
                } catch {
                  return false;
                }
              })
              .map((registration) => registration.unregister()),
          ),
        )
        .catch(() => null),
    );
  }

  if ("caches" in window) {
    cleanupTasks.push(
      window.caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.startsWith(LOCAL_CACHE_PREFIX))
              .map((cacheName) => window.caches.delete(cacheName)),
          ),
        )
        .catch(() => null),
    );
  }

  await Promise.all(cleanupTasks);
};

const getSessionValue = (key) => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const setSessionValue = (key, value) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in strict browser modes.
  }
};

const removeSessionValue = (key) => {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can be unavailable in strict browser modes.
  }
};

const getBuildId = () => {
  try {
    return typeof __APP_BUILD_ID__ !== "undefined"
      ? String(__APP_BUILD_ID__)
      : "unknown";
  } catch {
    return "unknown";
  }
};

const getChunkReloadKey = (error) => {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "unknown-route";
  const message = String(
    error?.message || error?.reason?.message || error?.reason || error || "",
  )
    .replace(/https?:\/\/[^\s)]+/g, "<url>")
    .replace(/[A-Za-z0-9_-]{8,}(?=\.js)/g, "<hash>")
    .slice(0, 160);

  return `${CHUNK_RELOAD_KEY_PREFIX}:${getBuildId()}:${pathname}:${message}`;
};

export const createMissingLazyDefaultError = (moduleName) => {
  const error = new Error(
    `Lazy route module ${moduleName || "unknown"} did not provide a default export.`,
  );

  error.code = MISSING_LAZY_DEFAULT_CODE;
  return error;
};

export const isChunkLoadError = (error) => {
  const code = String(error?.code || error?.reason?.code || "");
  const message = String(
    error?.message ||
      error?.reason?.message ||
      error?.reason ||
      error ||
      "",
  );

  return (
    code === MISSING_LAZY_DEFAULT_CODE ||
    /Cannot read properties of undefined \(reading ['"]default['"]\)|did not provide a default export|does not provide an export named ['"]default['"]|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|Expected a JavaScript module script|Loading chunk|ChunkLoadError/i.test(
      message,
    )
  );
};

export const clearChunkReloadGuard = () => {
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(CHUNK_RELOAD_KEY_PREFIX))
      .forEach((key) => removeSessionValue(key));
  } catch {
    // Session storage can be unavailable in strict browser modes.
  }
};

export const reloadForLatestBuild = (error) => {
  if (typeof window === "undefined") {
    return false;
  }

  if (!isChunkLoadError(error)) {
    return false;
  }

  const now = Date.now();
  const reloadKey = getChunkReloadKey(error);
  const previousReload = Number(getSessionValue(reloadKey) || 0);

  if (previousReload > 0) {
    console.error(
      "A stale frontend chunk is still unavailable after one refresh.",
      error,
    );
    return false;
  }

  setSessionValue(reloadKey, String(now));

  const url = new URL(window.location.href);
  url.searchParams.set("rov_build_refresh", String(now));

  void clearLocalFrontendState().finally(() => {
    window.location.replace(url.toString());
  });

  return true;
};

export const installChunkRecovery = () => {
  const handleVitePreloadError = (event) => {
    event.preventDefault?.();
    reloadForLatestBuild(event.payload || event);
  };

  const handleWindowError = (event) => {
    reloadForLatestBuild(event.error || event.message || event);
  };

  const handleUnhandledRejection = (event) => {
    reloadForLatestBuild(event.reason || event);
  };

  window.addEventListener("vite:preloadError", handleVitePreloadError);
  window.addEventListener("error", handleWindowError);
  window.addEventListener(
    "unhandledrejection",
    handleUnhandledRejection,
  );

  window.setTimeout(clearChunkReloadGuard, CHUNK_RELOAD_COOLDOWN_MS);

  return () => {
    window.removeEventListener(
      "vite:preloadError",
      handleVitePreloadError,
    );
    window.removeEventListener("error", handleWindowError);
    window.removeEventListener(
      "unhandledrejection",
      handleUnhandledRejection,
    );
  };
};
