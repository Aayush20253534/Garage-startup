const CHUNK_RELOAD_KEY = "rovauto:stale-chunk-reload";
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;
const MISSING_LAZY_DEFAULT_CODE = "MISSING_LAZY_DEFAULT";

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
  removeSessionValue(CHUNK_RELOAD_KEY);
};

export const reloadForLatestBuild = (error) => {
  if (typeof window === "undefined") {
    return false;
  }

  if (!isChunkLoadError(error)) {
    return false;
  }

  const now = Date.now();
  const previousReload = Number(getSessionValue(CHUNK_RELOAD_KEY) || 0);

  if (now - previousReload < CHUNK_RELOAD_COOLDOWN_MS) {
    console.error(
      "A stale frontend chunk is still unavailable after one refresh.",
      error,
    );
    return false;
  }

  setSessionValue(CHUNK_RELOAD_KEY, String(now));

  const url = new URL(window.location.href);
  url.searchParams.set("rov_build_refresh", String(now));

  window.location.replace(url.toString());
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
