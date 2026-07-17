import { useCallback, useEffect, useState } from "react";
import {
  FiClock,
  FiExternalLink,
  FiMapPin,
  FiNavigation,
} from "react-icons/fi";
import { mapsApi } from "@/api/maps";
import MapPanel from "./MapPanel";

const EMPTY_POINTS = [];

const toCoordinate = (value) => {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

const getDirectionsUrl = (origin, destination) => {
  const start = toCoordinate(origin);
  const end = toCoordinate(destination);

  if (!start || !end) return "https://www.google.com/maps";

  const params = new URLSearchParams({
    api: "1",
    origin: `${start.latitude},${start.longitude}`,
    destination: `${end.latitude},${end.longitude}`,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const formatDuration = (seconds) => {
  const value = Number(seconds || 0);
  if (!value) return "Calculating";
  const minutes = Math.max(1, Math.ceil(value / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};

const formatDistance = (meters) => {
  const value = Number(meters);
  if (!Number.isFinite(value) || value <= 0) return "Route distance";
  if (value < 1000) return `${Math.max(1, Math.round(value))} m`;
  return `${(value / 1000).toFixed(1)} km`;
};

export default function RouteMapCard({
  origin,
  destination,
  route,
  points = EMPTY_POINTS,
  title = "Live route",
  subtitle = "Garage to customer",
  dark = false,
}) {
  const originCoordinate = toCoordinate(origin);
  const destinationCoordinate = toCoordinate(destination);
  const [resolvedRoute, setResolvedRoute] = useState(route || null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  const handleBrowserRouteResolved = useCallback((computedRoute) => {
    setResolvedRoute((current) => ({
      ...(current || {}),
      ...computedRoute,
    }));
    setRouteError("");
    setRouteLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    setResolvedRoute(route || null);
    setRouteError("");

    if (
      !originCoordinate ||
      !destinationCoordinate ||
      route?.encodedPolyline
    ) {
      setRouteLoading(false);
      return () => {
        active = false;
      };
    }

    setRouteLoading(true);

    mapsApi
      .computeRoute(originCoordinate, destinationCoordinate, {
        trafficAware: true,
      })
      .then((computedRoute) => {
        if (active) {
          setResolvedRoute({ ...(route || {}), ...computedRoute });
        }
      })
      .catch((error) => {
        if (active) {
          setRouteError(
            error.response?.data?.message ||
              "The in-app route is unavailable. Open Google Maps for directions.",
          );
        }
      })
      .finally(() => {
        if (active) setRouteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    originCoordinate?.latitude,
    originCoordinate?.longitude,
    destinationCoordinate?.latitude,
    destinationCoordinate?.longitude,
    route?.encodedPolyline,
    route?.distanceMeters,
    route?.durationSeconds,
  ]);

  return (
    <section
      className={`overflow-hidden rounded-3xl border ${
        dark ? "border-gray-700 bg-gray-800" : "border-line bg-white shadow-soft"
      }`}
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiNavigation className={dark ? "text-yellow-300" : "text-ink"} />
            <h3 className={`font-bold ${dark ? "text-white" : "text-ink"}`}>
              {title}
            </h3>
          </div>
          <p className={`mt-1 text-sm ${dark ? "text-gray-400" : "text-muted"}`}>
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              dark ? "bg-gray-900 text-gray-200" : "bg-bg-soft text-ink"
            }`}
          >
            <FiMapPin />
            {formatDistance(resolvedRoute?.distanceMeters)}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              dark ? "bg-yellow-400/10 text-yellow-300" : "bg-brand/20 text-ink"
            }`}
          >
            <FiClock /> {formatDuration(resolvedRoute?.durationSeconds)}
          </span>
          <a
            href={getDirectionsUrl(origin, destination)}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              dark
                ? "border-gray-600 text-white hover:border-yellow-300"
                : "border-line text-ink hover:border-ink"
            }`}
          >
            Directions <FiExternalLink />
          </a>
        </div>
      </div>

      {(routeLoading || routeError) && (
        <div
          className={`border-t px-5 py-2 text-xs font-semibold ${
            dark
              ? "border-gray-700 bg-gray-900 text-gray-300"
              : routeError
                ? "border-amber-100 bg-amber-50 text-amber-800"
                : "border-gray-100 bg-gray-50 text-muted"
          }`}
        >
          {routeLoading ? "Calculating the best driving route…" : routeError}
        </div>
      )}

      <MapPanel
        origin={origin}
        destination={destination}
        points={points}
        encodedPolyline={resolvedRoute?.encodedPolyline}
        onRouteResolved={handleBrowserRouteResolved}
        height={360}
        dark={dark}
        className="rounded-none border-x-0 border-b-0"
      />
    </section>
  );
}
