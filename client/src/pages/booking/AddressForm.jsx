import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCheckCircle, FiCompass, FiMapPin, FiNavigation, FiShield } from "react-icons/fi";
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


const formatUnsupportedAddress = (details = {}) => {
  const formatted = String(
    details.formattedAddress || details.fullAddress || details.address || "",
  ).trim();
  if (formatted) return formatted;

  const parts = [details.area, details.city, details.state]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.join(", ");
};

function ServiceAreaUnavailableIllustration() {
  return (
    <svg viewBox="0 0 360 280" className="mx-auto h-auto w-full max-w-[18rem]" role="img" aria-label="Location unavailable illustration">
      <defs>
        <linearGradient id="rovauto-unavailable-bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#fff7cc" />
          <stop offset="100%" stopColor="#f5f7fb" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="328" height="248" rx="28" fill="url(#rovauto-unavailable-bg)" />
      <path d="M56 226h248" stroke="#d8dee8" strokeWidth="4" strokeLinecap="round" />
      <g opacity="0.7">
        <circle cx="78" cy="72" r="10" fill="#fde047" />
        <circle cx="292" cy="58" r="8" fill="#d9f99d" />
        <circle cx="302" cy="202" r="10" fill="#fee2e2" />
      </g>
      <g transform="translate(96 44)">
        <ellipse cx="84" cy="190" rx="70" ry="16" fill="#d9dee7" />
        <rect x="92" y="66" width="70" height="84" rx="26" fill="#f4b38f" />
        <path d="M89 82c6-28 20-42 44-42 22 0 37 14 42 40l-2 10H90z" fill="#121826" />
        <path d="M78 58c18-24 39-34 64-34 27 0 48 11 66 34-10 14-22 21-39 21H117c-17 0-29-7-39-21z" fill="#f472b6" />
        <rect x="66" y="150" width="118" height="68" rx="30" fill="#4c9a53" />
        <rect x="105" y="150" width="42" height="16" rx="8" fill="#f472b6" />
        <circle cx="114" cy="98" r="18" fill="#f9fafb" stroke="#f472b6" strokeWidth="5" />
        <circle cx="150" cy="98" r="18" fill="#f9fafb" stroke="#f472b6" strokeWidth="5" />
        <path d="M132 97h0.1" stroke="#1f2937" strokeWidth="7" strokeLinecap="round" />
        <path d="M150 97h0.1" stroke="#1f2937" strokeWidth="7" strokeLinecap="round" />
        <path d="M132 98h-8" stroke="#f472b6" strokeWidth="4" strokeLinecap="round" />
        <path d="M158 98h8" stroke="#f472b6" strokeWidth="4" strokeLinecap="round" />
        <path d="M133 122c9 6 18 6 27 0" stroke="#7c2d12" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M139 124v10" stroke="#7c2d12" strokeWidth="4" strokeLinecap="round" />
        <path d="M131 137c8 6 16 6 24 0" stroke="#111827" strokeWidth="4" strokeLinecap="round" fill="none" />
        <g transform="rotate(-20 56 176)">
          <rect x="22" y="168" width="56" height="14" rx="7" fill="#121826" />
          <ellipse cx="20" cy="173" rx="26" ry="18" fill="#565f6b" />
          <circle cx="72" cy="175" r="12" fill="#f4b38f" />
        </g>
        <g transform="rotate(20 208 176)">
          <rect x="186" y="168" width="56" height="14" rx="7" fill="#121826" />
          <ellipse cx="242" cy="173" rx="26" ry="18" fill="#565f6b" />
          <circle cx="182" cy="175" r="12" fill="#f4b38f" />
        </g>
      </g>
    </svg>
  );
}

function UnsupportedCurrentLocationState({ details, onReset }) {
  const locationLabel = formatUnsupportedAddress(details);

  return (
    <div className="mx-auto max-w-3xl py-6 sm:py-8">
      <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-soft">
        <div className="border-b border-line bg-[linear-gradient(135deg,#fffdf2_0%,#ffffff_65%,#f7fafc_100%)] px-5 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-700">
              <FiCompass className="text-sm" />
              Expanding service areas
            </span>
            <div className="mt-6">
              <ServiceAreaUnavailableIllustration />
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              We&apos;re not live at this location yet
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted sm:text-base">
              It looks like your current GPS location is outside our active service area. We&apos;re expanding quickly and should be back here soon.
            </p>
            {locationLabel && (
              <div className="mx-auto mt-5 flex max-w-xl items-start gap-3 rounded-2xl border border-line bg-bg-soft px-4 py-3 text-left">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-dark">
                  <FiMapPin />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                    Current location detected
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink sm:text-base">
                    {locationLabel}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-8 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="rounded-2xl border border-line bg-bg-soft px-4 py-4 text-left">
            <h2 className="text-sm font-bold text-ink sm:text-base">Want to continue with a supported area?</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Tap below to change the address manually, search a supported area, or move the map pin to the location where you need service.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-ink/90"
            >
              <FiNavigation />
              Change location
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition hover:border-ink"
            >
              <FiArrowLeft />
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [unsupportedCurrentLocation, setUnsupportedCurrentLocation] = useState(null);
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
    setUnsupportedCurrentLocation(null);
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


  const handleUnsupportedCurrentLocation = (details = {}) => {
    if (!user?.id) {
      setError(details.message || "Sorry, the service isn't available in your region.");
      return;
    }

    setUnsupportedCurrentLocation({
      ...details,
      area: form.area,
      city: form.city,
      state: form.state,
    });
    setError("");
  };

  const resetUnsupportedCurrentLocation = () => {
    setUnsupportedCurrentLocation(null);
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
      <div className="container-x mx-auto max-w-4xl py-10 sm:py-14 2xl:max-w-[80rem]">
        <div className="card-soft rounded-2xl p-5 text-sm text-muted">
          Using your saved service location…
        </div>
      </div>
    );
  }

  return (
    <div className="container-x mx-auto max-w-4xl py-10 sm:py-14 2xl:max-w-[80rem]">
      {unsupportedCurrentLocation ? (
        <UnsupportedCurrentLocationState
          details={unsupportedCurrentLocation}
          onReset={resetUnsupportedCurrentLocation}
        />
      ) : (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:gap-10">
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
              onUnsupportedCurrentLocation={handleUnsupportedCurrentLocation}
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
      )}
    </div>
  );
}
