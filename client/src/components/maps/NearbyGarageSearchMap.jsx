import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiMapPin,
  FiRefreshCw,
  FiTool,
} from "react-icons/fi";
import { loadGoogleMaps } from "@/utils/googleMapsLoader";

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const toPosition = (value) => {
  const lat = Number(value?.latitude ?? value?.lat);
  const lng = Number(value?.longitude ?? value?.lng);

  return Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null;
};

const getDistanceKm = (from, to) => {
  if (!from || !to) return null;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return "Distance unavailable";
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m away`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
};

const createInfoWindowContent = ({ garage, distanceKm }) => {
  const wrapper = document.createElement("div");
  wrapper.style.minWidth = "180px";
  wrapper.style.padding = "2px 2px 4px";
  wrapper.style.fontFamily = "inherit";

  const title = document.createElement("div");
  title.textContent = garage.name || "Verified garage";
  title.style.fontSize = "14px";
  title.style.fontWeight = "700";
  title.style.color = "#111827";

  const meta = document.createElement("div");
  meta.textContent = [garage.area || garage.city, formatDistance(distanceKm)]
    .filter(Boolean)
    .join(" • ");
  meta.style.marginTop = "4px";
  meta.style.fontSize = "12px";
  meta.style.color = "#667085";

  const status = document.createElement("div");
  status.textContent = "Contacted in this round";
  status.style.marginTop = "8px";
  status.style.fontSize = "11px";
  status.style.fontWeight = "700";
  status.style.color = "#3f6212";

  wrapper.append(title, meta, status);
  return wrapper;
};

export default function NearbyGarageSearchMap({
  customerLocation,
  customerAddress,
  garages = [],
  retrying = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const listenersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const customerPosition = useMemo(
    () => toPosition(customerLocation),
    [customerLocation?.latitude, customerLocation?.longitude],
  );

  const garagePoints = useMemo(
    () =>
      garages
        .map((garage) => {
          const position = toPosition(garage);
          if (!position) return null;

          return {
            garage,
            position,
            distanceKm: getDistanceKm(customerPosition, position),
          };
        })
        .filter(Boolean)
        .sort((left, right) =>
          Number(left.distanceKm ?? Infinity) - Number(right.distanceKm ?? Infinity),
        ),
    [garages, customerPosition],
  );

  // Tracking refreshes every few seconds. A primitive signature prevents the
  // map from resetting its zoom when the same garages are returned again.
  const garageSignature = garagePoints
    .map(({ garage, position }) =>
      [
        garage.id,
        garage.name,
        garage.area,
        garage.city,
        position.lat,
        position.lng,
      ].join(":"),
    )
    .join("|");

  useEffect(() => {
    let active = true;

    const clearMapObjects = () => {
      listenersRef.current.forEach((listener) => listener?.remove?.());
      listenersRef.current = [];

      overlaysRef.current.forEach((overlay) => {
        if (overlay?.setMap) overlay.setMap(null);
        if (overlay) overlay.map = null;
      });
      overlaysRef.current = [];

      infoWindowRef.current?.close?.();
    };

    const renderMap = async () => {
      try {
        setLoading(true);
        setError("");

        const { maps, config } = await loadGoogleMaps();
        if (!active || !containerRef.current) return;

        clearMapObjects();

        const center = customerPosition || garagePoints[0]?.position || DEFAULT_CENTER;
        const map =
          mapRef.current ||
          new maps.Map(containerRef.current, {
            center,
            zoom: 13,
            mapId: config.mapId,
            mapTypeId: maps.MapTypeId.ROADMAP,
            disableDefaultUI: true,
            zoomControl: true,
            fullscreenControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            clickableIcons: false,
            gestureHandling: "cooperative",
          });

        mapRef.current = map;
        map.setMapTypeId(maps.MapTypeId.ROADMAP);
        map.setCenter(center);

        const bounds = new maps.LatLngBounds();
        let markerCount = 0;

        const addFallbackMarker = ({ position, title, customer = false, index }) => {
          const marker = new maps.Marker({
            map,
            position,
            title,
            zIndex: customer ? 1000 : 100 - index,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: customer ? "#111827" : "#b7f000",
              fillOpacity: 1,
              strokeColor: customer ? "#ffffff" : "#111827",
              strokeWeight: customer ? 4 : 2,
              scale: customer ? 10 : 9,
            },
            label: customer
              ? undefined
              : {
                  text: String(index + 1),
                  color: "#111827",
                  fontWeight: "700",
                  fontSize: "11px",
                },
          });
          overlaysRef.current.push(marker);
          return marker;
        };

        let AdvancedMarkerElement;
        let PinElement;

        try {
          const markerLibrary = await maps.importLibrary("marker");
          AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
          PinElement = markerLibrary.PinElement;
        } catch {
          AdvancedMarkerElement = null;
          PinElement = null;
        }

        const addMarker = ({ position, title, customer = false, index = 0 }) => {
          if (!position) return null;

          bounds.extend(position);
          markerCount += 1;

          if (!AdvancedMarkerElement || !PinElement) {
            return addFallbackMarker({ position, title, customer, index });
          }

          const pin = new PinElement({
            background: customer ? "#111827" : "#b7f000",
            borderColor: customer ? "#ffffff" : "#111827",
            glyphColor: customer ? "#ffffff" : "#111827",
            glyph: customer ? "•" : String(index + 1),
            scale: customer ? 1.25 : 1.05,
          });

          const marker = new AdvancedMarkerElement({
            map,
            position,
            title,
            content: pin.element,
            zIndex: customer ? 1000 : 100 - index,
          });
          overlaysRef.current.push(marker);
          return marker;
        };

        if (customerPosition) {
          addMarker({
            position: customerPosition,
            title: customerAddress || "Your service location",
            customer: true,
          });
        }

        const infoWindow = new maps.InfoWindow({
          disableAutoPan: false,
        });
        infoWindowRef.current = infoWindow;

        garagePoints.forEach(({ garage, position, distanceKm }, index) => {
          const marker = addMarker({
            position,
            title: garage.name || `Garage ${index + 1}`,
            index,
          });

          if (!marker) return;

          const listener = marker.addListener("click", () => {
            infoWindow.setContent(
              createInfoWindowContent({ garage, distanceKm }),
            );
            infoWindow.open({ map, anchor: marker });
          });
          listenersRef.current.push(listener);
        });

        if (markerCount > 1) {
          map.fitBounds(bounds, {
            top: 72,
            right: 56,
            bottom: 72,
            left: 56,
          });

          const boundsListener = maps.event.addListenerOnce(map, "idle", () => {
            if (map.getZoom() > 15) map.setZoom(15);
          });
          listenersRef.current.push(boundsListener);
        } else {
          map.setZoom(customerPosition ? 14 : 12);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Google Maps is unavailable right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void renderMap();

    return () => {
      active = false;
      clearMapObjects();
    };
  }, [
    customerPosition?.lat,
    customerPosition?.lng,
    customerAddress,
    garageSignature,
  ]);

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiMapPin className="text-ink" />
            <h2 className="font-bold text-ink">Nearby garage search</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            Your saved service location and garages contacted in this round.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ink ring-2 ring-gray-200" />
            Your location
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-ink bg-brand" />
            Contacted garage
          </span>
        </div>
      </div>

      {error ? (
        <div className="grid min-h-80 place-items-center bg-bg-soft px-6 text-center">
          <div className="max-w-sm">
            <FiAlertCircle className="mx-auto text-2xl text-muted" />
            <p className="mt-3 font-semibold text-ink">Map unavailable</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
        </div>
      ) : (
        <div className="relative h-80 sm:h-96">
          <div ref={containerRef} className="h-full w-full" />

          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FiMapPin className="animate-pulse" /> Loading nearby garages…
              </div>
            </div>
          )}

          {!loading && (
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
              <div className="rounded-full border border-line bg-white/95 px-3 py-2 text-xs font-semibold text-ink shadow-soft backdrop-blur">
                {garagePoints.length > 0
                  ? `${garagePoints.length} garage${garagePoints.length === 1 ? "" : "s"} in this round`
                  : "Searching for verified garages nearby"}
              </div>

              <div className="rounded-full border border-line bg-white/95 px-3 py-2 text-xs font-semibold text-muted shadow-soft backdrop-blur">
                {retrying ? (
                  <span className="inline-flex items-center gap-1.5">
                    <FiRefreshCw className="animate-spin" /> Updating round
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <FiTool /> Tap a garage pin for details
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
