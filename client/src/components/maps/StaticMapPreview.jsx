import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiExternalLink, FiMapPin } from "react-icons/fi";
import { mapsApi } from "@/api/maps";

const toCoordinate = (value) => {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

export default function StaticMapPreview({
  origin,
  destination,
  points = [],
  height = 240,
  dark = false,
  title = "Location preview",
}) {
  const [browserKey, setBrowserKey] = useState(
    import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || "",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (browserKey) return;
    mapsApi
      .getConfig()
      .then((config) => setBrowserKey(config?.browserKey || ""))
      .catch(() => setError("Static map is unavailable"));
  }, [browserKey]);

  const mapUrl = useMemo(() => {
    if (!browserKey) return "";
    const originPoint = toCoordinate(origin);
    const destinationPoint = toCoordinate(destination);
    const markerPoints = [
      ...(originPoint ? [{ ...originPoint, color: "yellow", label: "G" }] : []),
      ...(destinationPoint
        ? [{ ...destinationPoint, color: "red", label: "C" }]
        : []),
      ...points.map(toCoordinate).filter(Boolean).slice(0, 8).map((point) => ({
        ...point,
        color: "blue",
      })),
    ];
    if (!markerPoints.length) return "";

    const params = new URLSearchParams({
      size: "640x360",
      scale: "2",
      maptype: "roadmap",
      key: browserKey,
      region: "in",
      language: "en",
    });
    markerPoints.forEach((point) => {
      params.append(
        "markers",
        `color:${point.color}${point.label ? `|label:${point.label}` : ""}|${point.latitude},${point.longitude}`,
      );
    });
    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }, [browserKey, origin, destination, points]);

  const openPoint = toCoordinate(destination) || toCoordinate(origin);

  return (
    <section
      className={`overflow-hidden rounded-3xl border ${
        dark ? "border-gray-700 bg-gray-800" : "border-line bg-white shadow-soft"
      }`}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <FiMapPin className={dark ? "text-yellow-300" : "text-ink"} />
          <h3 className={`font-bold ${dark ? "text-white" : "text-ink"}`}>
            {title}
          </h3>
        </div>
        {openPoint && (
          <a
            href={`https://www.google.com/maps?q=${openPoint.latitude},${openPoint.longitude}`}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 text-xs font-bold ${
              dark ? "text-yellow-300" : "text-ink"
            }`}
          >
            Open <FiExternalLink />
          </a>
        )}
      </div>

      {mapUrl ? (
        <img
          src={mapUrl}
          alt={title}
          className="w-full object-cover"
          style={{ height }}
          onError={() => setError("Static map could not be loaded")}
        />
      ) : (
        <div
          className={`grid place-items-center p-6 text-center text-sm ${
            dark ? "bg-gray-900 text-gray-400" : "bg-bg-soft text-muted"
          }`}
          style={{ height }}
        >
          <div>
            <FiAlertCircle className="mx-auto text-xl" />
            <p className="mt-2">{error || "Loading map preview…"}</p>
          </div>
        </div>
      )}
    </section>
  );
}
