import { useEffect, useMemo, useState } from "react";
import { mapsApi } from "@/api/maps";

export default function EmbedMap({
  latitude,
  longitude,
  placeId,
  height = 240,
  title = "Google Maps location",
  className = "",
}) {
  const [browserKey, setBrowserKey] = useState(
    import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || "",
  );

  useEffect(() => {
    if (browserKey) return;
    mapsApi
      .getConfig()
      .then((config) => setBrowserKey(config?.browserKey || ""))
      .catch(() => setBrowserKey(""));
  }, [browserKey]);

  const src = useMemo(() => {
    if (!browserKey) return "";
    const query = placeId
      ? `place_id:${placeId}`
      : `${Number(latitude)},${Number(longitude)}`;
    if (!placeId && (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)))) {
      return "";
    }
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(browserKey)}&q=${encodeURIComponent(query)}&zoom=16`;
  }, [browserKey, latitude, longitude, placeId]);

  if (!src) return null;

  return (
    <iframe
      title={title}
      src={src}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
      className={`w-full rounded-2xl border-0 ${className}`}
      style={{ height }}
    />
  );
}
