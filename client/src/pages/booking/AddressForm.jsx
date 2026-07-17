import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiMapPin, FiShield } from "react-icons/fi";
import api from "@/api/axios";
import LocationPicker from "@/components/maps/LocationPicker";
import CitySelect from "@/components/common/CitySelect";
import { useApp } from "@/hooks/useApp";
import {
  buildFullAddress,
  getDefaultUserLocation,
  hasUsableIndiaCoordinates,
  parseAddressParts,
} from "@/utils/address";
import { queueGeocodeRequest, clearGeocodeCache } from "@/utils/geocodeService";
import { requireAvailableCityName } from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";
import { hasSavedUserLocation } from "@/utils/signupLocation";

const hasText = (value) => Boolean(String(value || "").trim());
const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);

const takeExplicitValue = (next, previous, field, fallback = "") =>
  hasOwn(next, field) ? (next[field] ?? "") : (previous[field] ?? fallback);

const takeAddressText = (next, previous, fallbackField) => {
  if (hasOwn(next, "formattedAddress")) return next.formattedAddress ?? "";
  if (hasOwn(next, "fullAddress")) return next.fullAddress ?? "";
  return previous[fallbackField] || "";
};

const getInitialLocation = ({ user, routeLocation }) => {
  const defaultLocation = getDefaultUserLocation(user);
  const existingAddress =
    routeLocation.state?.existingAddress ??
    defaultLocation?.formattedAddress ??
    defaultLocation?.address ??
    user?.customerProfile?.address ??
    user?.address ??
    "";
  const parts = parseAddressParts(existingAddress);

  return {
    address: parts.address || "",
    area: parts.area || "",
    city: parts.city || "",
    state: parts.state || "",
    pincode: parts.pincode || "",
    formattedAddress: existingAddress,
    fullAddress: existingAddress,
    latitude:
      routeLocation.state?.latitude ?? defaultLocation?.latitude ?? null,
    longitude:
      routeLocation.state?.longitude ?? defaultLocation?.longitude ?? null,
    placeId: defaultLocation?.placeId || null,
    addressComponents: defaultLocation?.addressComponents || null,
    source: defaultLocation?.source || "MANUAL",
  };
};

export default function AddressForm() {
  const nav = useNavigate();
  const routeLocation = useLocation();
  const {
    user,
    location,
    setUser,
    setLocation,
    clearProfileCache,
    clearDashboardCache,
  } = useApp();

  const saveLockRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() =>
    getInitialLocation({ user, routeLocation }),
  );
  const forceLocationConfirmation =
    routeLocation.state?.forceLocationConfirmation === true;
  const shouldReuseSavedLocation =
    !forceLocationConfirmation && hasSavedUserLocation(user, location);

  useEffect(() => {
    if (!shouldReuseSavedLocation) return;

    const fromLocation = routeLocation.state?.from;
    const returnPath = fromLocation?.pathname
      ? `${fromLocation.pathname}${fromLocation.search || ""}${
          fromLocation.hash || ""
        }`
      : "/booking/vehicle";

    nav(returnPath, {
      replace: true,
      state: fromLocation?.state,
    });
  }, [
    nav,
    routeLocation.state?.from,
    shouldReuseSavedLocation,
  ]);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]:
        field === "pincode"
          ? String(value).replace(/\D/g, "").slice(0, 6)
          : value,
      ...(field !== "pincode" &&
        ["address", "area", "city"].includes(field) && {
          latitude: null,
          longitude: null,
          formattedAddress: "",
          fullAddress: "",
          placeId: null,
          addressComponents: null,
          source: "MANUAL",
        }),
    }));
    setError("");
  };

  const handleLocationChange = (next) => {
    setForm((previous) => ({
      ...previous,
      ...next,
      address: takeExplicitValue(next, previous, "address"),
      area: takeExplicitValue(next, previous, "area"),
      city: takeExplicitValue(next, previous, "city"),
      state: takeExplicitValue(next, previous, "state"),
      pincode: takeExplicitValue(next, previous, "pincode"),
      formattedAddress: takeAddressText(next, previous, "formattedAddress"),
      fullAddress: takeAddressText(next, previous, "fullAddress"),
      source: next.source || "MANUAL",
    }));
    setError("");
  };

  const getValidatedCity = async () => {
    const city = await requireAvailableCityName(form.city);

    setForm((previous) => ({
      ...previous,
      city,
    }));

    return city;
  };

  const validate = async () => {
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
    await getValidatedCity();
  };

  const ensureCoordinates = async (locationForm = form) => {
    if (hasUsableIndiaCoordinates(locationForm)) {
      return {
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
      };
    }

    const geocode = await queueGeocodeRequest(
      locationForm.address.trim(),
      locationForm.city.trim(),
      locationForm.area.trim(),
      locationForm.pincode.trim(),
    );

    const coordinates = {
      latitude: Number(geocode?.latitude),
      longitude: Number(geocode?.longitude),
    };

    if (!hasUsableIndiaCoordinates(coordinates)) {
      throw new Error(
        "Select a suggestion or place the map pin on a valid service-area address.",
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
      await validate();
      const city = await getValidatedCity();
      const canonicalForm = { ...form, city };
      const coordinates = await ensureCoordinates(canonicalForm);
      const fullAddress =
        canonicalForm.formattedAddress ||
        canonicalForm.fullAddress ||
        buildFullAddress(canonicalForm);
      const source = form.source === "GPS" ? "GPS" : "MANUAL";

      const locationResponse = await api.post("/locations", {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address: fullAddress,
        formattedAddress: fullAddress,
        city,
        placeId: form.placeId || null,
        addressComponents: form.addressComponents || undefined,
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
        ...canonicalForm,
        city,
        address: fullAddress,
        formattedAddress: fullAddress,
        fullAddress,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
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
        title: "Saved service location",
        detail: `${city}${canonicalForm.area ? `, ${canonicalForm.area}` : ""}`,
        path: "/dashboard/profile",
      });

      const fromLocation = routeLocation.state?.from;
      const returnPath = fromLocation?.pathname
        ? `${fromLocation.pathname}${fromLocation.search || ""}${
            fromLocation.hash || ""
          }`
        : "/booking/vehicle";

      nav(returnPath, {
        replace: true,
        state: fromLocation?.state,
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

  if (shouldReuseSavedLocation) {
    return (
      <div className="container-x mx-auto max-w-4xl py-10 sm:py-14">
        <div className="card-soft rounded-2xl p-5 text-sm text-muted">
          Using your saved service location…
        </div>
      </div>
    );
  }

  return (
    <div className="container-x mx-auto max-w-4xl py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main>
          <span className="chip-brand">Customer location</span>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Confirm the exact service address
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Search an address, use your current GPS location, and move the pin
            to the entrance where the garage should arrive.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={save} className="card-soft mt-7 space-y-6 p-5 sm:p-7">
            <LocationPicker
              value={form}
              onChange={handleLocationChange}
              label="Search and confirm address"
              showCurrentLocation
              required
            />

            <div className="grid gap-4 border-t border-line pt-6">
              <div className="flex items-center gap-2">
                <FiMapPin className="text-brand-dark" />
                <h2 className="font-bold">Address details</h2>
              </div>

              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">House, street or landmark</span>
                <input
                  required
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Area</span>
                  <input
                    required
                    value={form.area}
                    onChange={(event) => updateField("area", event.target.value)}
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">City</span>
                  <CitySelect
                    required
                    value={form.city}
                    onChange={(city) => updateField("city", city)}
                    className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm sm:max-w-xs">
                <span className="font-semibold">Pincode</span>
                <input
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(event) => updateField("pincode", event.target.value)}
                  className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiCheckCircle />
              {loading ? "Saving location…" : "Save and continue"}
            </button>
          </form>
        </main>

        <aside className="h-fit rounded-3xl bg-ink p-6 text-white lg:sticky lg:top-24">
          <FiShield className="text-3xl text-brand" />
          <h2 className="mt-4 text-xl font-bold">Why exact location matters</h2>
          <div className="mt-4 grid gap-4 text-sm text-white/70">
            <p>Nearby garages are ranked by real driving time, not only straight-line distance.</p>
            <p>The confirmed pin becomes the destination used for routing and live ETA.</p>
            <p>Your saved coordinates are reused, reducing repeated Google Maps requests.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
