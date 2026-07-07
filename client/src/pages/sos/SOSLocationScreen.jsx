import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowRight, FiMapPin, FiShield } from "react-icons/fi";
import LocationPicker from "@/components/maps/LocationPicker";
import { hasUsableIndiaCoordinates } from "@/utils/address";

const STORAGE_KEY = "rovauto_sos_location";

const readStoredLocation = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null") || {};
  } catch {
    return {};
  }
};

export default function SOSLocationScreen() {
  const [searchParams] = useSearchParams();
  const problem = searchParams.get("problem") || "roadside-emergency";
  const nav = useNavigate();
  const [location, setLocation] = useState(readStoredLocation);
  const [error, setError] = useState("");

  const problemLabel = useMemo(
    () => problem.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase()),
    [problem],
  );

  const proceed = () => {
    if (!hasUsableIndiaCoordinates(location)) {
      setError("Confirm your exact emergency location before continuing.");
      return;
    }

    const next = {
      ...location,
      formattedAddress:
        location.formattedAddress || location.fullAddress || location.address,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    nav(`/sos/checkout?problem=${encodeURIComponent(problem)}`, {
      state: { location: next },
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 text-white sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main>
            <span className="inline-flex rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-300">
              SOS · {problemLabel}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Confirm where help should arrive
            </h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              GPS is fastest. Move the pin to the safest pickup point if your
              vehicle is stopped away from the detected road position.
            </p>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-7 rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-2xl sm:p-7">
              <LocationPicker
                value={location}
                onChange={(next) => {
                  setLocation(next);
                  setError("");
                }}
                label="Emergency pickup location"
                helper="Search an address or use live GPS, then confirm the exact roadside point."
                dark
                required
                showCurrentLocation
              />

              <button
                type="button"
                onClick={proceed}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 text-base font-bold text-white transition hover:bg-red-500"
              >
                Continue to SOS confirmation <FiArrowRight />
              </button>
            </div>
          </main>

          <aside className="h-fit rounded-3xl border border-gray-800 bg-gray-900 p-6 lg:sticky lg:top-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-xl text-red-300">
              <FiShield />
            </div>
            <h2 className="mt-4 text-xl font-bold">Location safety</h2>
            <div className="mt-4 grid gap-4 text-sm leading-6 text-gray-400">
              <p>Move to a safe place away from traffic whenever possible.</p>
              <p>The confirmed point is sent to eligible nearby garages.</p>
              <p>Live route and ETA appear after a garage accepts the request.</p>
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-gray-950 p-4 text-sm text-gray-300">
              <FiMapPin className="mt-0.5 shrink-0 text-yellow-300" />
              The browser shares location only while you are using this flow.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
