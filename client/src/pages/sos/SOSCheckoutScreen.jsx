import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FiAlertTriangle, FiTruck, FiMapPin, FiRadio } from "react-icons/fi";
import api from "@/api/axios";
import RouteMapCard from "@/components/maps/RouteMapCard";
import { useApp } from "@/hooks/useApp";
import { addRecentActivity } from "@/utils/activityLog";
import { hasUsableIndiaCoordinates } from "@/utils/address";
import { formatRupees } from "@/utils/priceRange";

const STORAGE_KEY = "rovauto_sos_location";

const readStoredLocation = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null") || null;
  } catch {
    return null;
  }
};

export default function SOSCheckoutScreen() {
  const [searchParams] = useSearchParams();
  const problem = searchParams.get("problem") || "roadside-emergency";
  const routeLocation = useLocation();
  const nav = useNavigate();
  const { user, vehicle, vehicles } = useApp();
  const availableVehicles = Array.isArray(vehicles) ? vehicles : [];
  const [vehicleId, setVehicleId] = useState(
    vehicle?.id || availableVehicles.find((item) => item.isDefault)?.id || availableVehicles[0]?.id || "",
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const location = routeLocation.state?.location || readStoredLocation();

  const problemLabel = useMemo(
    () => problem.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase()),
    [problem],
  );

  const sendSos = async () => {
    if (!user) {
      nav(`/login?redirect=${encodeURIComponent(`/sos/checkout?problem=${problem}`)}`);
      return;
    }
    if (!vehicleId) {
      setError("Select the vehicle requiring assistance.");
      return;
    }
    if (!hasUsableIndiaCoordinates(location || {})) {
      nav(`/sos/location?problem=${encodeURIComponent(problem)}`);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await api.post("/sos", {
        vehicleId,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        address:
          location.formattedAddress || location.fullAddress || location.address,
        note: [problemLabel, note.trim()].filter(Boolean).join(" · "),
      });
      const result = response.data?.data || {};
      const booking = result.booking || result;

      sessionStorage.removeItem(STORAGE_KEY);
      addRecentActivity({
        type: "SOS",
        title: "Sent SOS request",
        detail: problemLabel,
        path: "/tracking",
      });

      nav("/sos/success", {
        replace: true,
        state: {
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          message: result.message,
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send the SOS request.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 text-white sm:py-12">
      <div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main>
          <span className="inline-flex rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-300">
            Emergency confirmation
          </span>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            Send roadside assistance request
          </h1>
          <p className="mt-2 text-gray-400">
            RovAuto will broadcast this location to eligible nearby garages.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <FiAlertTriangle className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {location && (
            <div className="mt-7">
              <RouteMapCard
                origin={location}
                destination={location}
                title="Confirmed emergency point"
                subtitle={location.formattedAddress || location.fullAddress || location.address}
                dark
              />
            </div>
          )}
        </main>

        <aside className="h-fit rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl lg:sticky lg:top-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-500/15 text-red-300">
              <FiRadio />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Request type</p>
              <h2 className="font-bold">{problemLabel}</h2>
            </div>
          </div>

          <label className="mt-6 grid gap-2 text-sm font-semibold">
            Vehicle
            <div className="relative">
              <FiTruck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <select
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-gray-700 bg-gray-950 py-3.5 pl-11 pr-4 text-white outline-none focus:border-red-400"
              >
                <option value="">Select vehicle</option>
                {availableVehicles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.brand} {item.model} {item.registrationNumber ? `· ${item.registrationNumber}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="mt-4 grid gap-2 text-sm font-semibold">
            Extra note
            <textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Hazards, landmark, vehicle condition, or towing requirement"
              className="resize-none rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-red-400"
            />
          </label>

          <div className="mt-5 rounded-2xl bg-gray-950 p-4 text-sm">
            <div className="flex justify-between gap-4 border-b border-gray-800 pb-3">
              <span className="text-gray-400">SOS wallet charge</span>
              <span className="font-bold text-yellow-300">{formatRupees(50)}</span>
            </div>
            <div className="flex items-start gap-2 pt-3 text-xs leading-5 text-gray-500">
              <FiMapPin className="mt-0.5 shrink-0" />
              The charge is applied according to the existing SOS acceptance flow.
            </div>
          </div>

          <button
            type="button"
            onClick={sendSos}
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRadio /> {loading ? "Broadcasting SOS…" : "Send SOS now"}
          </button>
        </aside>
      </div>
    </div>
  );
}
