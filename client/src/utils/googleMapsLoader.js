import { mapsApi } from "@/api/maps";

let mapsPromise = null;
let mapsConfig = null;
let authFailureError = null;
let authFailureHandlerInstalled = false;

export const GOOGLE_MAPS_AUTH_FAILURE_EVENT =
  "rovauto:google-maps-auth-failure";

const installAuthFailureHandler = () => {
  if (authFailureHandlerInstalled || typeof window === "undefined") return;

  authFailureHandlerInstalled = true;
  const previousHandler = window.gm_authFailure;

  window.gm_authFailure = () => {
    authFailureError = new Error(
      "Google Maps authentication failed. Check that the browser key allows this domain and that Maps JavaScript API and billing are enabled.",
    );

    window.dispatchEvent(new Event(GOOGLE_MAPS_AUTH_FAILURE_EVENT));

    if (typeof previousHandler === "function") {
      previousHandler();
    }
  };
};

const loadScript = (browserKey) =>
  new Promise((resolve, reject) => {
    installAuthFailureHandler();

    if (window.google?.maps) {
      if (authFailureError) {
        reject(authFailureError);
        return;
      }
      resolve(window.google.maps);
      return;
    }

    const existing = document.querySelector("script[data-rovauto-google-maps]");
    if (existing) {
      existing.addEventListener(
        "load",
        () => {
          if (authFailureError) reject(authFailureError);
          else resolve(window.google.maps);
        },
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps could not be loaded")),
        { once: true },
      );
      return;
    }

    const callbackName = `__rovautoMapsReady_${Date.now()}`;
    window[callbackName] = () => {
      delete window[callbackName];
      if (authFailureError) reject(authFailureError);
      else resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.dataset.rovautoGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}` +
      `&v=quarterly&loading=async&libraries=geometry&callback=${callbackName}`;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error("Google Maps could not be loaded"));
    };
    document.head.appendChild(script);
  });

export const loadGoogleMaps = async () => {
  if (!mapsPromise) {
    mapsPromise = (async () => {
      mapsConfig = await mapsApi.getConfig();
      const browserKey =
        import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || mapsConfig?.browserKey;

      if (!browserKey) {
        throw new Error("Google Maps browser key is not configured");
      }

      await loadScript(browserKey);

      if (authFailureError) throw authFailureError;

      return {
        maps: window.google.maps,
        config: {
          ...mapsConfig,
          browserKey,
          // A map ID is optional. Do not inject DEMO_MAP_ID in production because
          // it can force vector/WebGL rendering on devices where the basemap fails.
          mapId:
            import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || mapsConfig?.mapId || null,
        },
      };
    })().catch((error) => {
      mapsPromise = null;
      throw error;
    });
  }

  return mapsPromise;
};

export const getGoogleMapsConfig = () => mapsConfig;
export const getGoogleMapsAuthError = () => authFailureError;
