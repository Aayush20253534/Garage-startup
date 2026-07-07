import { mapsApi } from "@/api/maps";

let mapsPromise = null;
let mapsConfig = null;

const loadScript = (browserKey) =>
  new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }

    const existing = document.querySelector("script[data-rovauto-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps), {
        once: true,
      });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const callbackName = `__rovautoMapsReady_${Date.now()}`;
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.dataset.rovautoGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}` +
      `&v=weekly&loading=async&libraries=marker,geometry&callback=${callbackName}`;
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
      return {
        maps: window.google.maps,
        config: {
          ...mapsConfig,
          browserKey,
          mapId:
            import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
            mapsConfig?.mapId ||
            "DEMO_MAP_ID",
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
