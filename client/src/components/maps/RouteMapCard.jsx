import { FiClock, FiMapPin, FiNavigation } from "react-icons/fi";
import MapPanel from "./MapPanel";

const formatDuration = (seconds) => {
  const value = Number(seconds || 0);
  if (!value) return "Calculating";
  const minutes = Math.max(1, Math.ceil(value / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};

export default function RouteMapCard({
  origin,
  destination,
  route,
  points = [],
  title = "Live route",
  subtitle = "Garage to customer",
  dark = false,
}) {
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
            {route?.distanceMeters
              ? `${(route.distanceMeters / 1000).toFixed(1)} km`
              : "Route distance"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              dark ? "bg-yellow-400/10 text-yellow-300" : "bg-brand/20 text-ink"
            }`}
          >
            <FiClock /> {formatDuration(route?.durationSeconds)}
          </span>
        </div>
      </div>

      <MapPanel
        origin={origin}
        destination={destination}
        points={points}
        encodedPolyline={route?.encodedPolyline}
        height={360}
        dark={dark}
        className="rounded-none border-x-0 border-b-0"
      />
    </section>
  );
}
