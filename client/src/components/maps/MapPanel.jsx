import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiExternalLink, FiMapPin } from "react-icons/fi";
import {
  getGoogleMapsAuthError,
  GOOGLE_MAPS_AUTH_FAILURE_EVENT,
  loadGoogleMaps,
} from "@/utils/googleMapsLoader";

const MAP_TILE_TIMEOUT_MS = 20000;
const EMPTY_POINTS = [];

const toPosition = (value) => {
  const lat = Number(value?.latitude ?? value?.lat);
  const lng = Number(value?.longitude ?? value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const samePosition = (left, right) =>
  left && right && left.lat === right.lat && left.lng === right.lng;

const createPinIcon = (maps, fillColor) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52">
      <path d="M21 1.5C10.5 1.5 2 10 2 20.5c0 13.2 15.1 28.2 17.6 30.6a2 2 0 0 0 2.8 0C24.9 48.7 40 33.7 40 20.5 40 10 31.5 1.5 21 1.5Z" fill="${fillColor}" stroke="#111827" stroke-width="2"/>
      <circle cx="21" cy="20" r="6.5" fill="#111827"/>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(42, 52),
    anchor: new maps.Point(21, 50),
  };
};

const getGoogleMapsUrl = (origin, destination) => {
  if (origin && destination && !samePosition(origin, destination)) {
    const params = new URLSearchParams({
      api: "1",
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      travelmode: "driving",
    });

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const position = destination || origin;
  return position
    ? `https://www.google.com/maps?q=${position.lat},${position.lng}`
    : "https://www.google.com/maps";
};

export default function MapPanel({
  center,
  origin,
  destination,
  points = EMPTY_POINTS,
  encodedPolyline = null,
  onRouteResolved,
  draggable = false,
  onLocationChange,
  height = 320,
  className = "",
  dark = false,
  zoom = 15,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const listenersRef = useRef([]);
  const tileTimerRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const hasLoadedTilesRef = useRef(false);
  const onLocationChangeRef = useRef(onLocationChange);
  const onRouteResolvedRef = useRef(onRouteResolved);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onRouteResolvedRef.current = onRouteResolved;
  }, [onRouteResolved]);

  const clearMapArtifacts = () => {
    listenersRef.current.forEach((listener) => listener?.remove?.());
    listenersRef.current = [];

    overlaysRef.current.forEach((overlay) => {
      if (overlay?.setMap) overlay.setMap(null);
      if (overlay) overlay.map = null;
    });
    overlaysRef.current = [];

    if (tileTimerRef.current) {
      window.clearTimeout(tileTimerRef.current);
      tileTimerRef.current = null;
    }

    if (resizeFrameRef.current) {
      window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
  };

  useEffect(() => {
    const handleAuthFailure = () => {
      const authError = getGoogleMapsAuthError();
      setLoading(false);
      setError(authError?.message || "Google Maps authentication failed.");
    };

    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, handleAuthFailure);
    return () =>
      window.removeEventListener(
        GOOGLE_MAPS_AUTH_FAILURE_EVENT,
        handleAuthFailure,
      );
  }, []);

  useEffect(() => {
    let active = true;

    const renderMap = async () => {
      try {
        if (!hasLoadedTilesRef.current) setLoading(true);
        setError("");
        const { maps, config } = await loadGoogleMaps();
        if (!active || !containerRef.current) return;

        clearMapArtifacts();

        const originPosition = toPosition(origin);
        const destinationPosition = toPosition(destination);
        const centerPosition =
          toPosition(center) ||
          originPosition ||
          destinationPosition ||
          toPosition(config.defaultCenter) ||
          { lat: 20.5937, lng: 78.9629 };

        // Use Google's normal ROADMAP raster renderer. The previous fallback
        // DEMO_MAP_ID could force a vector/WebGL map, leaving only markers and
        // the route visible on devices where the vector basemap did not render.
        const mutableMapOptions = {
          center: centerPosition,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: "greedy",
          mapTypeId: maps.MapTypeId.ROADMAP,
          backgroundColor: dark ? "#111827" : "#e5e7eb",
        };

        let map = mapRef.current;
        if (!map) {
          const initialMapOptions = { ...mutableMapOptions };

          // renderingType is constructor-only. Passing it to setOptions after a
          // map click/coordinate update makes Google collapse the map and show
          // "setRenderingType after instantiation is not supported".
          if (maps.RenderingType?.RASTER) {
            initialMapOptions.renderingType = maps.RenderingType.RASTER;
          }

          map = new maps.Map(containerRef.current, initialMapOptions);
          mapRef.current = map;
        } else {
          map.setOptions(mutableMapOptions);
        }

        map.setCenter(centerPosition);

        if (!hasLoadedTilesRef.current) {
          maps.event.addListenerOnce(map, "tilesloaded", () => {
            if (!active) return;
            hasLoadedTilesRef.current = true;
            if (tileTimerRef.current) {
              window.clearTimeout(tileTimerRef.current);
              tileTimerRef.current = null;
            }
            setLoading(false);
          });

          tileTimerRef.current = window.setTimeout(() => {
            if (!active || hasLoadedTilesRef.current) return;
            setLoading(false);
            setError(
              "Google map tiles did not load. Check the browser-key domain restriction and ensure Maps JavaScript API and billing are enabled.",
            );
          }, MAP_TILE_TIMEOUT_MS);
        } else {
          setLoading(false);
        }

        const bounds = new maps.LatLngBounds();
        let boundsPointCount = 0;

        const addMarker = (position, title, isDraggable = false) => {
          if (!position) return null;
          bounds.extend(position);
          boundsPointCount += 1;

          const marker = new maps.Marker({
            map,
            position,
            title,
            draggable: isDraggable,
            icon: createPinIcon(
              maps,
              title === "Customer" ? "#ef4444" : "#facc15",
            ),
            // Only a handful of pins are rendered at once. Keeping each pin as
            // its own DOM image avoids the oversized dark touch/canvas artifact
            // seen with optimized legacy markers on some mobile Chromium builds.
            optimized: false,
            crossOnDrag: false,
          });

          if (isDraggable && onLocationChangeRef.current) {
            const listener = marker.addListener("dragend", (event) => {
              onLocationChangeRef.current?.({
                latitude: event.latLng.lat(),
                longitude: event.latLng.lng(),
              });
            });
            listenersRef.current.push(listener);
          }

          overlaysRef.current.push(marker);
          return marker;
        };

        if (originPosition && destinationPosition) {
          addMarker(originPosition, "Garage");
          addMarker(destinationPosition, "Customer");
        } else {
          addMarker(centerPosition, "Selected location", draggable);
        }

        for (const point of points) {
          const position = toPosition(point);
          if (position) {
            bounds.extend(position);
            boundsPointCount += 1;
          }
        }

        if (encodedPolyline) {
          const geometry = await maps.importLibrary("geometry");
          if (!active) return;
          const path = geometry.encoding.decodePath(encodedPolyline);
          path.forEach((position) => {
            bounds.extend(position);
            boundsPointCount += 1;
          });
          const polyline = new maps.Polyline({
            map,
            path,
            strokeColor: dark ? "#facc15" : "#111827",
            strokeOpacity: 0.9,
            strokeWeight: 5,
          });
          overlaysRef.current.push(polyline);
        } else if (originPosition && destinationPosition) {
          // Route geometry is computed by the backend Routes API. Do not fall
          // back to the legacy browser DirectionsService/Renderer: those APIs
          // are deprecated and also require an additional browser-key service
          // permission. When the server route is temporarily unavailable, keep
          // the map useful with the observed GPS trail (or a direct guide line)
          // and let the existing "Directions" link open Google Maps.
          const observedPath = points.map(toPosition).filter(Boolean);
          const path = observedPath.length > 1
            ? observedPath
            : [originPosition, destinationPosition];
          const polyline = new maps.Polyline({
            map,
            path,
            strokeColor: dark ? "#facc15" : "#111827",
            strokeOpacity: observedPath.length > 1 ? 0.85 : 0.55,
            strokeWeight: 4,
          });
          overlaysRef.current.push(polyline);
        } else if (points.length > 1) {
          const path = points.map(toPosition).filter(Boolean);
          const polyline = new maps.Polyline({
            map,
            path,
            strokeColor: dark ? "#facc15" : "#111827",
            strokeOpacity: 0.85,
            strokeWeight: 4,
          });
          overlaysRef.current.push(polyline);
        }

        const shouldFitBounds =
          boundsPointCount > 1 &&
          !samePosition(originPosition, destinationPosition);

        if (shouldFitBounds) {
          map.fitBounds(bounds, 56);
        } else {
          map.setZoom(zoom);
        }

        if (draggable && onLocationChangeRef.current) {
          const listener = map.addListener("click", (event) => {
            onLocationChangeRef.current?.({
              latitude: event.latLng.lat(),
              longitude: event.latLng.lng(),
            });
          });
          listenersRef.current.push(listener);
        }

        // Google Maps can retain the old internal canvas size while the parent
        // rerenders after a pin click. Re-measure once layout has settled and
        // then restore the intended viewport.
        resizeFrameRef.current = window.requestAnimationFrame(() => {
          if (!active || !containerRef.current || !mapRef.current) return;

          maps.event.trigger(map, "resize");
          if (shouldFitBounds) {
            map.fitBounds(bounds, 56);
          } else {
            map.setCenter(centerPosition);
            map.setZoom(zoom);
          }
          resizeFrameRef.current = null;
        });
      } catch (err) {
        if (active) {
          setLoading(false);
          setError(err.message || "Map unavailable");
        }
      }
    };

    void renderMap();

    return () => {
      active = false;
      clearMapArtifacts();
    };
  }, [
    center?.latitude,
    center?.longitude,
    center?.lat,
    center?.lng,
    origin?.latitude,
    origin?.longitude,
    destination?.latitude,
    destination?.longitude,
    encodedPolyline,
    draggable,
    points,
    dark,
    zoom,
  ]);

  const fallbackOrigin = toPosition(origin) || toPosition(center);
  const fallbackDestination = toPosition(destination);

  if (error) {
    return (
      <div
        className={`grid place-items-center rounded-2xl border p-6 text-center ${
          dark
            ? "border-gray-700 bg-gray-900 text-gray-300"
            : "border-line bg-bg-soft text-muted"
        } ${className}`}
        style={{ minHeight: height }}
      >
        <div className="max-w-md">
          <FiAlertCircle className="mx-auto text-2xl" />
          <p className="mt-2 text-sm font-semibold">Map unavailable</p>
          <p className="mt-1 text-xs leading-5 opacity-75">{error}</p>
          <a
            href={getGoogleMapsUrl(fallbackOrigin, fallbackDestination)}
            target="_blank"
            rel="noreferrer"
            className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition ${
              dark
                ? "border-gray-600 text-white hover:border-yellow-300"
                : "border-line bg-white text-ink hover:border-ink"
            }`}
          >
            Open in Google Maps <FiExternalLink />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rovauto-google-map relative overflow-hidden rounded-2xl border ${
        dark ? "border-gray-700 bg-gray-900" : "border-line bg-bg-soft"
      } ${className}`}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="rovauto-google-map-canvas h-full w-full"
      />
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FiMapPin className="animate-pulse" /> Loading map…
          </div>
        </div>
      )}
      {draggable && !loading && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[calc(100%_-_1.5rem)] -translate-x-1/2 rounded-lg bg-gray-950/85 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-lg">
          Drag the pin or tap the exact entrance
        </div>
      )}
    </div>
  );
}
