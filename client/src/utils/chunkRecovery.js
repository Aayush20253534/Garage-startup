const CHUNK_RELOAD_KEY = "rovauto:stale-chunk-reload";
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export const isChunkLoadError = (error) => {
  const message = String(
    error?.message ||
      error?.reason?.message ||
      error?.reason ||
      error ||
      "",
  );

  return /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|Loading chunk|ChunkLoadError/i.test(
    message,
  );
};

export const clearChunkReloadGuard = () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
};

export const reloadForLatestBuild = (error) => {
  if (!isChunkLoadError(error)) {
    return false;
  }

  const now = Date.now();
  const previousReload = Number(
    sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0,
  );

  if (now - previousReload < CHUNK_RELOAD_COOLDOWN_MS) {
    console.error(
      "A stale frontend chunk is still unavailable after one refresh.",
      error,
    );
    return false;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));

  const url = new URL(window.location.href);
  url.searchParams.set("rov_build_refresh", String(now));

  window.location.replace(url.toString());
  return true;
};

export const installChunkRecovery = () => {
  const handleVitePreloadError = (event) => {
    event.preventDefault();
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
