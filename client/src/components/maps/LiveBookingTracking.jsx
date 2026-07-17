import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiClock,
  FiMapPin,
  FiNavigation,
  FiRadio,
  FiRefreshCw,
  FiSquare,
} from "react-icons/fi";
import { mapsApi } from "@/api/maps";
import RouteMapCard from "./RouteMapCard";

const POLL_INTERVAL_MS = 8000;
const SHARE_INTERVAL_MS = 8000;
const GPS_WARMUP_MS = 20000;
const MAX_FRESH_POSITION_AGE_MS = 30000;
const TARGET_ACCURACY_METERS = 100;
const ACCURACY_IMPROVEMENT_METERS = 20;

const formatUpdatedAt = (value) => {
  if (!value) return "Waiting for first location";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export default function LiveBookingTracking({
  bookingId,
  canShare = false,
  autoStart = false,
  onTrackingUpdate,
  dark = false,
  title = "Live garage route",
}) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(Boolean(bookingId));
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const watchIdRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const lastSentAccuracyRef = useRef(Number.POSITIVE_INFINITY);
  const sharingStartedAtRef = useRef(0);
  const sendInFlightRef = useRef(false);
  const startInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const autoStartAttemptedRef = useRef(false);

  const loadTracking = useCallback(
    async ({ silent = false } = {}) => {
      if (!bookingId) return;
      if (!silent) setLoading(true);

      try {
        const result = await mapsApi.getBookingTracking(bookingId);
        if (mountedRef.current) {
          setTracking(result);
          onTrackingUpdate?.(result);
          setSharing(Boolean(result?.trackingActive && watchIdRef.current !== null));
          setError("");
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Live tracking is unavailable.",
          );
        }
      } finally {
        if (mountedRef.current && !silent) setLoading(false);
      }
    },
    [bookingId, onTrackingUpdate],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadTracking();

    const interval = window.setInterval(
      () => void loadTracking({ silent: true }),
      POLL_INTERVAL_MS,
    );

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [loadTracking]);

  const sendPosition = async (position) => {
    const latitude = Number(position?.coords?.latitude);
    const longitude = Number(position?.coords?.longitude);
    const accuracyM = Number(position?.coords?.accuracy);
    const now = Date.now();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setShareMessage("Waiting for a valid garage GPS position...");
      return;
    }

    const recordedAtMs = Number(position.timestamp || now);
    if (now - recordedAtMs > MAX_FRESH_POSITION_AGE_MS) {
      setShareMessage("Refreshing the garage GPS position...");
      return;
    }

    const warmingUp = now - sharingStartedAtRef.current < GPS_WARMUP_MS;
    if (
      Number.isFinite(accuracyM) &&
      accuracyM > TARGET_ACCURACY_METERS &&
      warmingUp
    ) {
      setShareMessage(
        `Improving garage GPS accuracy (+/- ${Math.round(accuracyM)} m)...`,
      );
      return;
    }

    const accuracyImproved =
      Number.isFinite(accuracyM) &&
      lastSentAccuracyRef.current - accuracyM >= ACCURACY_IMPROVEMENT_METERS;
    if (
      sendInFlightRef.current ||
      (now - lastSentAtRef.current < SHARE_INTERVAL_MS && !accuracyImproved)
    ) {
      return;
    }

    sendInFlightRef.current = true;
    lastSentAtRef.current = now;
    if (Number.isFinite(accuracyM)) {
      lastSentAccuracyRef.current = accuracyM;
    }

    const speedMps = Number(position.coords.speed);
    try {
      await mapsApi.updateBookingTracking(bookingId, {
        latitude: Number(latitude.toFixed(7)),
        longitude: Number(longitude.toFixed(7)),
        heading: Number.isFinite(Number(position.coords.heading))
          ? Number(position.coords.heading)
          : null,
        speedKph: Number.isFinite(speedMps) ? speedMps * 3.6 : null,
        accuracyM: Number.isFinite(accuracyM)
          ? accuracyM
          : null,
        recordedAt: new Date(recordedAtMs).toISOString(),
      });
      setError("");
      setShareMessage(
        Number.isFinite(accuracyM)
          ? `Garage location live (+/- ${Math.round(accuracyM)} m)`
          : "Garage location is live",
      );
      void loadTracking({ silent: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not share the latest location.",
      );
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const startSharing = async () => {
    if (!navigator.geolocation) {
      setError("Live location is not supported by this browser.");
      return;
    }

    if (startInFlightRef.current || watchIdRef.current !== null) return;

    startInFlightRef.current = true;
    try {
      setError("");
      setShareMessage("Acquiring accurate garage GPS...");
      await mapsApi.startBookingTracking(bookingId);
      lastSentAtRef.current = 0;
      lastSentAccuracyRef.current = Number.POSITIVE_INFINITY;
      sharingStartedAtRef.current = Date.now();

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => void sendPosition(position),
        (err) => {
          setError(err.message || "Unable to read live location.");
          if (err.code === err.PERMISSION_DENIED) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
            setSharing(false);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        },
      );
      setSharing(true);
      void loadTracking({ silent: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not start live tracking.",
      );
      setShareMessage("");
    } finally {
      startInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (
      !autoStart ||
      !canShare ||
      !bookingId ||
      sharing ||
      autoStartAttemptedRef.current
    ) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void startSharing();
  }, [autoStart, bookingId, canShare, sharing]);

  const stopSharing = async () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    try {
      await mapsApi.stopBookingTracking(bookingId);
      setShareMessage("Live location sharing stopped");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not stop live tracking.",
      );
    } finally {
      setSharing(false);
      void loadTracking({ silent: true });
    }
  };

  if (!bookingId) return null;

  if (loading) {
    return (
      <div
        className={`rounded-3xl border p-6 text-sm ${
          dark
            ? "border-gray-700 bg-gray-800 text-gray-300"
            : "border-line bg-white text-muted"
        }`}
      >
        <FiRefreshCw className="mr-2 inline animate-spin" /> Loading live route...
      </div>
    );
  }

  const origin =
    tracking?.latestLocation ||
    (tracking?.garage
      ? {
          latitude: tracking.garage.latitude,
          longitude: tracking.garage.longitude,
        }
      : null);
  const destination = tracking?.customerLocation || null;
  const points = tracking?.points || [];

  return (
    <div className="space-y-4">
      {error && (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            dark
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <FiAlertCircle className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <RouteMapCard
        origin={origin}
        destination={destination}
        route={tracking?.route}
        points={points}
        title={title}
        subtitle={
          tracking?.trackingActive
            ? "Garage GPS to the customer's booking address"
            : "Latest garage position to the customer's booking address"
        }
        dark={dark}
      />

      <div
        className={`grid gap-3 rounded-3xl border p-4 sm:grid-cols-3 ${
          dark ? "border-gray-700 bg-gray-800" : "border-line bg-white"
        }`}
      >
        <div className={`rounded-2xl p-4 ${dark ? "bg-gray-900" : "bg-bg-soft"}`}>
          <div
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${
              dark ? "text-gray-500" : "text-muted"
            }`}
          >
            <FiRadio /> Status
          </div>
          <p
            className={`mt-2 font-bold ${
              tracking?.trackingActive
                ? "text-green-500"
                : dark
                  ? "text-gray-200"
                  : "text-ink"
            }`}
          >
            {tracking?.trackingActive ? "Live" : "Not sharing"}
          </p>
        </div>

        <div className={`rounded-2xl p-4 ${dark ? "bg-gray-900" : "bg-bg-soft"}`}>
          <div
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${
              dark ? "text-gray-500" : "text-muted"
            }`}
          >
            <FiClock /> Last update
          </div>
          <p className={`mt-2 font-bold ${dark ? "text-white" : "text-ink"}`}>
            {formatUpdatedAt(tracking?.latestLocation?.recordedAt)}
          </p>
        </div>

        <div className={`rounded-2xl p-4 ${dark ? "bg-gray-900" : "bg-bg-soft"}`}>
          <div
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${
              dark ? "text-gray-500" : "text-muted"
            }`}
          >
            <FiMapPin /> Accuracy
          </div>
          <p className={`mt-2 font-bold ${dark ? "text-white" : "text-ink"}`}>
            {tracking?.latestLocation?.accuracyM
              ? `+/- ${Math.round(tracking.latestLocation.accuracyM)} m`
              : "Not reported"}
          </p>
        </div>
      </div>

      {canShare && (
        <div
          className={`rounded-3xl border p-5 ${
            dark
              ? "border-gray-700 bg-gray-800"
              : "border-line bg-white shadow-soft"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className={`font-bold ${dark ? "text-white" : "text-ink"}`}>
                Share garage live location
              </h3>
              <p className={`mt-1 text-sm ${dark ? "text-gray-400" : "text-muted"}`}>
                Keep this page open while travelling. Points are road-snapped and
                ETA is refreshed at controlled intervals.
              </p>
              {shareMessage && (
                <p className="mt-2 text-xs font-semibold text-green-500">
                  {shareMessage}
                </p>
              )}
            </div>

            {sharing ? (
              <button
                type="button"
                onClick={stopSharing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500"
              >
                <FiSquare /> Stop sharing
              </button>
            ) : (
              <button
                type="button"
                onClick={startSharing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-ink transition hover:bg-brand-dark"
              >
                <FiNavigation /> Start live sharing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
