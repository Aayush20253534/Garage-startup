import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiMapPin } from "react-icons/fi";
import { loadGoogleMaps } from "@/utils/googleMapsLoader";

const toPosition = (value) => {
  const lat = Number(value?.latitude ?? value?.lat);
  const lng = Number(value?.longitude ?? value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const samePosition = (left, right) =>
  left && right && left.lat === right.lat && left.lng === right.lng;

export default function MapPanel({
  center,
  origin,
  destination,
  points = [],
  encodedPolyline = null,
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const renderMap = async () => {
      try {
        setLoading(true);
        setError("");
        const { maps, config } = await loadGoogleMaps();
        if (!active || !containerRef.current) return;

        listenersRef.current.forEach((listener) => listener?.remove?.());
        listenersRef.current = [];

        overlaysRef.current.forEach((overlay) => {
          if (overlay?.setMap) overlay.setMap(null);
          if (overlay) overlay.map = null;
        });
        overlaysRef.current = [];

        const originPosition = toPosition(origin);
        const destinationPosition = toPosition(destination);
        const centerPosition =
          toPosition(center) ||
          originPosition ||
          destinationPosition ||
          toPosition(config.defaultCenter) ||
          { lat: 20.5937, lng: 78.9629 };

        const map =
          mapRef.current ||
          new maps.Map(containerRef.current, {
            center: centerPosition,
            zoom,
            mapId: config.mapId,
            disableDefaultUI: true,
            zoomControl: true,
            fullscreenControl: true,
            gestureHandling: "greedy",
          });

        mapRef.current = map;
        map.setCenter(centerPosition);

        const bounds = new maps.LatLngBounds();
        let bounded = false;

        const addMarker = async (position, title, isDraggable = false) => {
          if (!position) return null;
          bounds.extend(position);
          bounded = true;

          try {
            const { AdvancedMarkerElement, PinElement } =
              await maps.importLibrary("marker");
            const pin = new PinElement({
              background: title === "Customer" ? "#ef4444" : "#facc15",
              borderColor: "#111827",
              glyphColor: "#111827",
              scale: 1.1,
            });
            const marker = new AdvancedMarkerElement({
              map,
              position,
              title,
              content: pin.element,
              gmpDraggable: isDraggable,
            });
            if (isDraggable && onLocationChange) {
              const listener = marker.addListener("dragend", () => {
                const next = marker.position;
                onLocationChange({
                  latitude: Number(next.lat),
                  longitude: Number(next.lng),
                });
              });
              listenersRef.current.push(listener);
            }
            overlaysRef.current.push(marker);
            return marker;
          } catch {
            const marker = new maps.Marker({
              map,
              position,
              title,
              draggable: isDraggable,
            });
            if (isDraggable && onLocationChange) {
              const listener = marker.addListener("dragend", (event) => {
                onLocationChange({
                  latitude: event.latLng.lat(),
                  longitude: event.latLng.lng(),
                });
              });
              listenersRef.current.push(listener);
            }
            overlaysRef.current.push(marker);
            return marker;
          }
        };

        if (originPosition && destinationPosition) {
          await addMarker(originPosition, "Garage");
          await addMarker(destinationPosition, "Customer");
        } else {
          await addMarker(centerPosition, "Selected location", draggable);
        }

        for (const point of points) {
          const position = toPosition(point);
          if (position) {
            bounds.extend(position);
            bounded = true;
          }
        }

        if (encodedPolyline) {
          const geometry = await maps.importLibrary("geometry");
          const path = geometry.encoding.decodePath(encodedPolyline);
          path.forEach((position) => bounds.extend(position));
          bounded = true;
          const polyline = new maps.Polyline({
            map,
            path,
            strokeColor: dark ? "#facc15" : "#111827",
            strokeOpacity: 0.9,
            strokeWeight: 5,
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

        if (bounded && !samePosition(originPosition, destinationPosition)) {
          map.fitBounds(bounds, 56);
        } else {
          map.setZoom(zoom);
        }

        if (draggable && onLocationChange) {
          const listener = map.addListener("click", (event) => {
            onLocationChange({
              latitude: event.latLng.lat(),
              longitude: event.latLng.lng(),
            });
          });
          listenersRef.current.push(listener);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Map unavailable");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void renderMap();

    return () => {
      active = false;
      listenersRef.current.forEach((listener) => listener?.remove?.());
      listenersRef.current = [];
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
        <div>
          <FiAlertCircle className="mx-auto text-2xl" />
          <p className="mt-2 text-sm font-semibold">Map unavailable</p>
          <p className="mt-1 text-xs opacity-75">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        dark ? "border-gray-700 bg-gray-900" : "border-line bg-bg-soft"
      } ${className}`}
      style={{ height }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FiMapPin className="animate-pulse" /> Loading map…
          </div>
        </div>
      )}
      {draggable && !loading && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-950/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
          Drag the pin or tap the exact entrance
        </div>
      )}
    </div>
  );
}
