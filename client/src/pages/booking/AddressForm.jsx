import { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import {
  buildFullAddress,
  getDefaultUserLocation,
  hasUsableIndiaCoordinates,
  parseAddressParts,
  reverseGeocodeCoordinates,
} from "@/utils/address";
import { queueGeocodeRequest, clearGeocodeCache } from "@/utils/geocodeService";
import { FiCheckCircle, FiMapPin } from "react-icons/fi";
import CitySelect from "@/components/common/CitySelect";
import {
  isCityAvailable,
  UNAVAILABLE_CITY_MESSAGE,
} from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";

const toCoordinateOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const hasText = (value) => Boolean(String(value || "").trim());

export default function AddressForm() {
  const nav = useNavigate();
  const routeLocation = useLocation();
  const {
    user,
    setUser,
    setLocation,
    clearProfileCache,
    clearDashboardCache,
  } = useApp();

  const saveLockRef = useRef(false);
  const detectLockRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");
  const [manualLocationEdited, setManualLocationEdited] = useState(false);

  const defaultUserLocation = getDefaultUserLocation(user);
  const initialAddress =
    routeLocation.state?.existingAddress ??
    user?.customerProfile?.address ??
    defaultUserLocation?.address ??
    user?.address ??
    "";

  const initialParts = parseAddressParts(initialAddress);

  const [form, setForm] = useState({
    address: initialParts.address || "",
    area: initialParts.area || "",
    city: initialParts.city || "",
    pincode: initialParts.pincode || "",
    latitude:
      routeLocation.state?.latitude ?? defaultUserLocation?.latitude ?? null,
    longitude:
      routeLocation.state?.longitude ?? defaultUserLocation?.longitude ?? null,
  });

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        name === "pincode"
          ? String(value).replace(/\D/g, "").slice(0, 6)
          : value,
      latitude: null,
      longitude: null,
    }));

    setManualLocationEdited(true);
    setError("");
  };

  const getCurrentCoordinates = async () => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser.");
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });

    const coordinates = {
      latitude: Number(position.coords.latitude.toFixed(6)),
      longitude: Number(position.coords.longitude.toFixed(6)),
    };

    if (!hasUsableIndiaCoordinates(coordinates)) {
      throw new Error("Rovauto is available only in India right now.");
    }

    return coordinates;
  };

  const detectLocation = async () => {
    if (detectLockRef.current) return;

    detectLockRef.current = true;
    setDetecting(true);
    setError("");

    try {
      const { latitude, longitude } = await getCurrentCoordinates();
      const parsed = await reverseGeocodeCoordinates({ latitude, longitude });

      if (!(await isCityAvailable(parsed.city))) {
        throw new Error(UNAVAILABLE_CITY_MESSAGE);
      }

      setForm({
        address: parsed.address || "",
        area: parsed.area || "",
        city: parsed.city || "",
        pincode: parsed.pincode || "",
        latitude,
        longitude,
      });

      setManualLocationEdited(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not detect location. Please enter it manually.",
      );
    } finally {
      detectLockRef.current = false;
      setDetecting(false);
    }
  };

  const validateAddressFields = async () => {
    if (!hasText(form.address)) {
      throw new Error("Enter your house number, street, or landmark.");
    }

    if (!hasText(form.area)) {
      throw new Error("Enter your area or locality.");
    }

    if (!hasText(form.city)) {
      throw new Error("Select your city.");
    }

    if (!/^\d{6}$/.test(String(form.pincode || ""))) {
      throw new Error("Enter a valid 6-digit pincode.");
    }

    if (!(await isCityAvailable(form.city))) {
      throw new Error(UNAVAILABLE_CITY_MESSAGE);
    }
  };

  const geocodeManualAddress = async () => {
    const geocodeResult = await queueGeocodeRequest(
      form.address.trim(),
      form.city.trim(),
      form.area.trim(),
      form.pincode.trim(),
    );

    const coordinates = {
      latitude: Number(geocodeResult?.latitude),
      longitude: Number(geocodeResult?.longitude),
    };

    if (!hasUsableIndiaCoordinates(coordinates)) {
      throw new Error(
        "Could not find valid Indian coordinates for this address. Please check the address and pincode.",
      );
    }

    return coordinates;
  };

  const save = async (event) => {
    event.preventDefault();
    if (saveLockRef.current) return;

    saveLockRef.current = true;
    setLoading(true);
    setError("");

    try {
      await validateAddressFields();

      const fullAddress = buildFullAddress({
        address: form.address.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
      });

      let latitude = toCoordinateOrNull(form.latitude);
      let longitude = toCoordinateOrNull(form.longitude);
      let source = "GPS";

      const currentCoordinatesAreUsable = hasUsableIndiaCoordinates({
        latitude,
        longitude,
      });

      if (manualLocationEdited || !currentCoordinatesAreUsable) {
        const geocoded = await geocodeManualAddress();
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        source = "MANUAL";
      }

      if (!hasUsableIndiaCoordinates({ latitude, longitude })) {
        throw new Error(
          "Could not determine valid Indian coordinates. Please choose current location or verify the address.",
        );
      }

      const locationResponse = await api.post("/locations", {
        latitude,
        longitude,
        address: fullAddress,
        source,
        isDefault: true,
      });

      const profileResponse = await api.patch("/customer/profile", {
        address: fullAddress,
      });

      const locationData = locationResponse.data?.data;
      const savedLocation = locationData?.location || locationData || {};
      const profileData = profileResponse.data?.data;
      const savedUser = profileData?.user || profileData || {};

      const nextLocation = {
        ...savedLocation,
        address: fullAddress,
        fullAddress,
        area: form.area.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        latitude,
        longitude,
        source,
        isDefault: true,
      };

      setLocation(nextLocation);

      setUser((previous) => {
        const previousLocations = Array.isArray(previous?.locations)
          ? previous.locations.filter((item) => !item.isDefault)
          : [];

        return {
          ...(previous || {}),
          ...savedUser,
          isOnboarded: true,
          address: savedUser.address || previous?.address || fullAddress,
          customerProfile: {
            ...(previous?.customerProfile || {}),
            ...(savedUser.customerProfile || {}),
            address: fullAddress,
          },
          locations: [nextLocation, ...previousLocations],
        };
      });

      clearProfileCache?.();
      clearDashboardCache?.();
      clearGeocodeCache?.();

      addRecentActivity({
        type: "LOCATION",
        title:
          source === "GPS"
            ? "Saved current location"
            : "Saved manual location",
        detail: `${form.city}${form.area ? `, ${form.area}` : ""}`,
        path: "/dashboard/profile",
      });

      const nextPath =
        routeLocation.state?.from?.pathname || "/booking/vehicle";

      nav(nextPath, {
        replace: true,
        state: routeLocation.state?.from?.state,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not save address. Please try again.",
      );
    } finally {
      saveLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="container-x mx-auto max-w-lg py-12">
      <h1 className="text-3xl font-bold">Complete Your Profile</h1>
      <p className="mt-1 text-muted">
        Add your address to get started with booking services.
      </p>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={save} className="mt-8 grid gap-4">
        <button
          type="button"
          onClick={detectLocation}
          disabled={loading || detecting}
          className="flex items-center justify-center gap-2 rounded-xl border border-ink px-4 py-3 font-medium text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiMapPin />
          {detecting ? "Detecting location..." : "Use Current Location"}
        </button>

        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Full Address</span>
            <input
              required
              name="address"
              value={form.address}
              onChange={change}
              placeholder="House number, Street, Landmark"
              disabled={loading}
              className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink disabled:opacity-60"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Area</span>
              <input
                required
                name="area"
                value={form.area}
                onChange={change}
                placeholder="Locality"
                disabled={loading}
                className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink disabled:opacity-60"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">City</span>
              <CitySelect
                required
                value={form.city}
                onChange={(city) => {
                  setForm((previous) => ({
                    ...previous,
                    city,
                    latitude: null,
                    longitude: null,
                  }));
                  setManualLocationEdited(true);
                  setError("");
                }}
                disabled={loading}
                className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Pincode</span>
            <input
              required
              name="pincode"
              value={form.pincode}
              onChange={change}
              placeholder="6-digit pincode"
              inputMode="numeric"
              maxLength={6}
              disabled={loading}
              className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink disabled:opacity-60"
            />
          </label>
        </div>

        <button
          disabled={loading || detecting}
          type="submit"
          className="btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            "Saving..."
          ) : (
            <>
              <FiCheckCircle />
              Save & Continue
            </>
          )}
        </button>
      </form>
    </div>
  );
}
