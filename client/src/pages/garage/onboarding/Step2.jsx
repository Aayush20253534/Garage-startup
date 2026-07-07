import { useState } from "react";
import { motion } from "framer-motion";
import { FiArrowRight, FiMapPin, FiTarget } from "react-icons/fi";
import LocationPicker from "@/components/maps/LocationPicker";
import { mapsApi } from "@/api/maps";
import CitySelect from "@/components/common/CitySelect";
import {
  isCityAvailable,
  UNAVAILABLE_CITY_MESSAGE,
} from "@/utils/cityAvailability";

const hasCoordinates = (location) =>
  Number.isFinite(Number(location?.lat)) &&
  Number.isFinite(Number(location?.lng));

export default function OnboardingStep2({ data, onChange, onNext }) {
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [validationResult, setValidationResult] = useState(null);

  const pickerValue = {
    address: data.address,
    area: data.area,
    city: data.city,
    formattedAddress: data.formattedAddress || data.address,
    fullAddress: data.formattedAddress || data.address,
    latitude: data.location?.lat,
    longitude: data.location?.lng,
    placeId: data.placeId,
    addressComponents: data.addressComponents,
    source: data.locationSource,
  };

  const applyLocation = (next) => {
    onChange({
      ...data,
      address: next.formattedAddress || next.fullAddress || next.address || data.address,
      formattedAddress:
        next.formattedAddress || next.fullAddress || next.address || "",
      area: next.area || data.area,
      city: next.city || data.city,
      placeId: next.placeId || null,
      addressComponents: next.addressComponents || null,
      location: {
        lat: next.latitude ?? null,
        lng: next.longitude ?? null,
      },
      locationSource: next.source === "GPS" ? "GPS" : "MANUAL",
    });
    setLocationError("");
    setValidationResult(null);
  };

  const updateAddressField = (field, value) => {
    onChange({
      ...data,
      [field]: value,
      formattedAddress: field === "address" ? value : data.formattedAddress,
      placeId: null,
      addressComponents: null,
      location: { lat: null, lng: null },
      locationSource: "MANUAL",
    });
    setLocationError("");
    setValidationResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocationError("");

    try {
      if (!(await isCityAvailable(data.city))) {
        throw new Error(UNAVAILABLE_CITY_MESSAGE);
      }

      if (!hasCoordinates(data.location)) {
        throw new Error(
          "Search the garage address and confirm the exact entrance on the map.",
        );
      }

      if (!data.address || !data.area || !data.city) {
        throw new Error("Complete the garage address, area, and city.");
      }

      const validated = await mapsApi.validateAddress({
        addressLines: [data.address, data.area].filter(Boolean),
        locality: data.city,
      });
      setValidationResult(validated);

      if (!validated?.accepted) {
        throw new Error(
          "Google could not fully validate this business address. Confirm the suggestion or improve the address details.",
        );
      }

      if (validated.formattedAddress) {
        onChange({
          ...data,
          address: validated.formattedAddress,
          formattedAddress: validated.formattedAddress,
          placeId: validated.placeId || data.placeId,
          location: validated.location
            ? {
                lat: validated.location.latitude,
                lng: validated.location.longitude,
              }
            : data.location,
        });
      }

      onNext();
    } catch (err) {
      setLocationError(
        err.response?.data?.message ||
          err.message ||
          "Could not confirm this garage location.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-soft px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-5xl"
      >
        <div className="mb-7">
          <span className="chip-brand">Step 2 · Garage location</span>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Pin the exact garage entrance
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Customers, routing, and service-radius checks will use this point.
            Search the address and move the marker if the entrance is elsewhere.
          </p>
        </div>

        {locationError && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {locationError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <section className="card-soft space-y-6 p-5 sm:p-7">
            <LocationPicker
              value={pickerValue}
              onChange={applyLocation}
              label="Search garage address"
              helper="Select a Google result, then drag the pin to the customer entrance."
              showCurrentLocation
              required
            />

            <div className="grid gap-4 border-t border-line pt-6">
              <div className="flex items-center gap-2">
                <FiMapPin className="text-brand-dark" />
                <h2 className="font-bold">Business address</h2>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Full address
                <textarea
                  required
                  rows={3}
                  value={data.address}
                  onChange={(event) =>
                    updateAddressField("address", event.target.value)
                  }
                  className="resize-none rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  City
                  <CitySelect
                    required
                    value={data.city}
                    onChange={(city) => updateAddressField("city", city)}
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Area
                  <input
                    required
                    value={data.area}
                    onChange={(event) =>
                      updateAddressField("area", event.target.value)
                    }
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Short description
                <textarea
                  rows={3}
                  value={data.description}
                  onChange={(event) =>
                    onChange({ ...data, description: event.target.value })
                  }
                  placeholder="Specializations, landmark, parking access, or operating notes"
                  className="resize-none rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />
              </label>
            </div>
          </section>

          <aside className="card-soft h-fit p-6 lg:sticky lg:top-20">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl">
              <FiTarget />
            </div>
            <h2 className="mt-4 text-xl font-bold">Working radius</h2>
            <p className="mt-2 text-sm text-muted">
              This is the maximum initial distance used when RovAuto shortlists
              your garage. Driving-time ranking is applied afterward.
            </p>

            <div className="mt-6 rounded-2xl bg-bg-soft p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Coverage</span>
                <span className="text-2xl font-bold">{data.workingRadius} km</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={data.workingRadius}
                onChange={(event) =>
                  onChange({
                    ...data,
                    workingRadius: Number(event.target.value),
                  })
                }
                className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand"
              />
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>5 km</span>
                <span>30 km</span>
              </div>
            </div>

            {validationResult && (
              <div className={`mt-6 rounded-2xl border p-4 text-sm ${
                validationResult.accepted
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}>
                <p className="font-bold">
                  {validationResult.accepted
                    ? "Business address validated"
                    : "Address needs confirmation"}
                </p>
                <p className="mt-1">
                  {validationResult.formattedAddress || data.address}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-6 w-full py-4 text-base disabled:opacity-60"
            >
              {loading ? "Checking location…" : "Save and continue"}
              <FiArrowRight />
            </button>
          </aside>
        </form>
      </motion.div>
    </div>
  );
}
