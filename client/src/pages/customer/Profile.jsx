import { useEffect, useRef, useState } from "react";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import CitySelect from "@/components/common/CitySelect";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import {
  buildFullAddress,
  getLocationStateFromUser,
  hasUsableIndiaCoordinates,
  parseAddressParts,
  reverseGeocodeCoordinates,
} from "@/utils/address";
import { queueGeocodeRequest } from "@/utils/geocodeService";
import {
  getAvailableCityName,
  requireAvailableCityName,
} from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";
import {
  FiCheckCircle,
  FiMapPin,
  FiNavigation,
  FiSave,
  FiX,
} from "react-icons/fi";

const INDIA_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

const hasCoordinateValue = (value) =>
  value !== null && value !== undefined && value !== "";

const normalizeIndianPhone = (value = "") => {
  let digits = String(value).replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 10);
  return digits ? `+91${digits}` : "";
};

const getDefaultLocation = (data = {}) => {
  const locations = Array.isArray(data.locations) ? data.locations : [];
  const validLocations = locations.filter((item) =>
    hasUsableIndiaCoordinates(item),
  );

  return (
    validLocations.find((item) => item.isDefault) ||
    validLocations[0] ||
    null
  );
};

const createFormFromUser = (data = {}) => {
  const defaultLocation = getDefaultLocation(data);

  return {
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    address: data.customerProfile?.address || data.address || "",
    location: {
      latitude: defaultLocation?.latitude ?? null,
      longitude: defaultLocation?.longitude ?? null,
      source: defaultLocation?.source || "MANUAL",
    },
  };
};

export default function Profile() {
  const {
    user,
    setUser,
    setLocation,
    fetchProfile,
    clearProfileCache,
    clearDashboardCache,
  } = useApp();

  const initialLoadRef = useRef(false);
  const profileRequestRef = useRef(null);
  const mountedRef = useRef(true);

  const [form, setForm] = useState(() => createFormFromUser(user));
  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [locationDraft, setLocationDraft] = useState({
    address: "",
    area: "",
    city: "",
    pincode: "",
    latitude: null,
    longitude: null,
    source: "MANUAL",
  });

  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [success, setSuccess] = useState("");

  const applyProfileData = (data, { updateContext = false } = {}) => {
    if (!data) return;

    setForm(createFormFromUser(data));

    if (updateContext) {
      setUser(data);
    }

    const syncedLocation = getLocationStateFromUser(data);
    if (syncedLocation) {
      setLocation(syncedLocation);
    }
  };

  const loadProfile = async ({ force = false, showLoader = true } = {}) => {
    if (profileRequestRef.current) {
      return profileRequestRef.current;
    }

    if (showLoader) setLoading(true);
    setError("");

    let request;
    request = (async () => {
      try {
        const data = await fetchProfile({ force });

        if (mountedRef.current) {
          applyProfileData(data);
        }

        return data;
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load profile",
          );
        }
        return null;
      } finally {
        if (mountedRef.current && showLoader) {
          setLoading(false);
        }
      }
    })().finally(() => {
      if (profileRequestRef.current === request) {
        profileRequestRef.current = null;
      }
    });

    profileRequestRef.current = request;
    return request;
  };

  useEffect(() => {
    mountedRef.current = true;

    if (!initialLoadRef.current) {
      initialLoadRef.current = true;

      if (user) {
        applyProfileData(user);
        setLoading(false);
        void loadProfile({ force: false, showLoader: false });
      } else {
        void loadProfile();
      }
    }

    return () => {
      mountedRef.current = false;
    };
    // The provider methods are intentionally read once for the page mount.
    // useApp currently recreates its function references on context updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: name === "phone" ? value.replace(/[^\d+]/g, "") : value,
    }));

    setError("");
    setSuccess("");
  };

  const openLocationEditor = () => {
    const parsed = parseAddressParts(form.address);

    setLocationDraft({
      address: parsed.address || "",
      area: parsed.area || "",
      city: parsed.city || "",
      pincode: parsed.pincode || "",
      latitude: form.location?.latitude ?? null,
      longitude: form.location?.longitude ?? null,
      source: form.location?.source || "MANUAL",
    });

    setLocationError("");
    setSuccess("");
    setLocationOpen(true);
  };

  const updateLocationDraft = (field, value) => {
    setLocationDraft((previous) => ({
      ...previous,
      [field]: field === "pincode" ? String(value).replace(/\D/g, "").slice(0, 6) : value,
      latitude: null,
      longitude: null,
      source: "MANUAL",
    }));
    setLocationError("");
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

    return {
      latitude: Number(position.coords.latitude.toFixed(6)),
      longitude: Number(position.coords.longitude.toFixed(6)),
    };
  };

  const detectLocation = async () => {
    if (locationSaving) return;

    setLocationSaving(true);
    setLocationDetecting(true);
    setLocationError("");

    try {
      const { latitude, longitude } = await getCurrentCoordinates();
      const parsed = await reverseGeocodeCoordinates({ latitude, longitude });

      const city = await getAvailableCityName(parsed);

      if (!city) {
        throw new Error("Sorry, the service isn't available in your region.");
      }

      setLocationDraft({
        address: parsed.address || "",
        area: parsed.area || "",
        city,
        pincode: parsed.pincode || "",
        latitude,
        longitude,
        source: "GPS",
      });
    } catch (err) {
      setLocationError(
        err.response?.data?.message ||
          err.message ||
          "Could not detect location.",
      );
    } finally {
      setLocationDetecting(false);
      setLocationSaving(false);
    }
  };

  const validateLocationDraft = () => {
    if (!locationDraft.address.trim()) {
      throw new Error("Enter your house, street, or landmark.");
    }

    if (!locationDraft.area.trim()) {
      throw new Error("Enter your area.");
    }

    if (!locationDraft.city.trim()) {
      throw new Error("Select your city.");
    }

    if (!/^\d{6}$/.test(locationDraft.pincode)) {
      throw new Error("Enter a valid 6-digit pincode.");
    }
  };

  const applyLocationDraft = async () => {
    if (locationSaving) return;

    setLocationSaving(true);
    setLocationError("");
    setSuccess("");

    try {
      validateLocationDraft();

      const city = await requireAvailableCityName(locationDraft.city);
      const canonicalDraft = { ...locationDraft, city };
      const fullAddress = buildFullAddress(canonicalDraft);
      const hasDraftCoordinates =
        hasCoordinateValue(locationDraft.latitude) &&
        hasCoordinateValue(locationDraft.longitude);

      let latitude = hasDraftCoordinates
        ? Number(locationDraft.latitude)
        : null;
      let longitude = hasDraftCoordinates
        ? Number(locationDraft.longitude)
        : null;
      let source = locationDraft.source || "MANUAL";

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const result = await queueGeocodeRequest(
          canonicalDraft.address,
          canonicalDraft.city,
          canonicalDraft.area,
          canonicalDraft.pincode,
        );

        latitude = Number(result.latitude);
        longitude = Number(result.longitude);
        source = "MANUAL";
      }

      if (!hasUsableIndiaCoordinates({ latitude, longitude })) {
        throw new Error(
          "Could not find valid service-area coordinates for this address.",
        );
      }

      const locationResponse = await api.post("/locations", {
        latitude,
        longitude,
        address: fullAddress,
        formattedAddress: fullAddress,
        city,
        source,
        isDefault: true,
      });

      // Keep the profile address and saved default location consistent without
      // forcing an immediate GET /customer/profile after a successful write.
      const profileResponse = await api.patch("/customer/profile", {
        address: fullAddress,
      });

      const savedLocationData = locationResponse.data?.data;
      const savedLocation = savedLocationData?.location || savedLocationData || {};
      const profileData = profileResponse.data?.data;
      const profileUser = profileData?.user || profileData || {};

      const nextLocation = {
        ...canonicalDraft,
        ...savedLocation,
        city,
        fullAddress,
        address: fullAddress,
        latitude,
        longitude,
        source,
        isDefault: true,
      };

      const existingLocations = Array.isArray(user?.locations)
        ? user.locations.filter((item) => !item.isDefault)
        : [];

      const nextUser = {
        ...(user || {}),
        ...profileUser,
        customerProfile: {
          ...(user?.customerProfile || {}),
          ...(profileUser.customerProfile || {}),
          address: fullAddress,
        },
        address: profileUser.address || user?.address || fullAddress,
        locations: [nextLocation, ...existingLocations],
      };

      setUser(nextUser);
      setLocation(nextLocation);
      setForm(createFormFromUser(nextUser));

      clearProfileCache?.();
      clearDashboardCache?.();

      addRecentActivity({
        type: "LOCATION",
        title:
          source === "GPS"
            ? "Updated location from GPS"
            : "Updated location manually",
        detail: `${city}${
          canonicalDraft.area ? `, ${canonicalDraft.area}` : ""
        }`,
        path: "/dashboard/profile",
      });

      setSuccess("Location updated successfully");
      setLocationOpen(false);
    } catch (err) {
      setLocationError(
        err.response?.data?.message ||
          err.message ||
          "Could not determine coordinates for this address.",
      );
    } finally {
      setLocationSaving(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const name = form.name.trim();
      const phone = normalizeIndianPhone(form.phone);
      const address = form.address.trim();

      if (name.length < 2) {
        throw new Error("Enter your full name.");
      }

      if (!INDIA_PHONE_REGEX.test(phone)) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }

      const before = {
        name: user?.name || "",
        phone: user?.phone || "",
        address: user?.customerProfile?.address || user?.address || "",
      };

      const response = await api.patch("/customer/profile", {
        name,
        phone,
        address,
      });

      const responseData = response.data?.data;
      const responseUser = responseData?.user || responseData || {};

      const nextUser = {
        ...(user || {}),
        ...responseUser,
        name: responseUser.name || name,
        phone: responseUser.phone || phone,
        customerProfile: {
          ...(user?.customerProfile || {}),
          ...(responseUser.customerProfile || {}),
          address:
            responseUser.customerProfile?.address ||
            responseUser.address ||
            address,
        },
      };

      setUser(nextUser);
      setForm(createFormFromUser(nextUser));

      const syncedLocation = getLocationStateFromUser(nextUser);
      if (syncedLocation) setLocation(syncedLocation);

      clearProfileCache?.();
      clearDashboardCache?.();

      const changed = [];
      if (before.name !== name) changed.push("name");
      if (before.phone !== phone) changed.push("phone");
      if (before.address !== address) changed.push("address");

      if (changed.length) {
        addRecentActivity({
          type: "PROFILE",
          title: "Updated profile",
          detail: `Changed ${changed.join(", ")}`,
          path: "/dashboard/profile",
        });
      }

      setSuccess("Profile updated successfully");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="card-soft p-6 text-muted">Loading profile...</div>
      </div>
    );
  }

  return (
    <>
      <CustomerLoginLoader
        visible={locationDetecting}
        eyebrow="ROVAUTO LOCATION"
        title="Finding your location"
        message="Using GPS to update your service address."
      />
      <div className="max-w-2xl">
      <h2 className="mb-6 text-2xl font-bold">Profile Settings</h2>

      <form onSubmit={saveProfile} className="card-soft grid gap-4 p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink text-xl font-bold text-white">
            {form.name?.[0]?.toUpperCase() || "U"}
          </span>

          <div>
            <div className="text-lg font-semibold">
              {form.name || user?.name || "User"}
            </div>
            <div className="text-sm text-muted">
              {form.phone || "Phone not available"}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Full Name</span>
          <input
            required
            name="name"
            value={form.name}
            onChange={change}
            autoComplete="name"
            className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            value={form.email}
            disabled
            className="cursor-not-allowed rounded-xl border border-line bg-bg-soft px-4 py-3 text-muted outline-none"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Phone</span>
          <input
            required
            name="phone"
            value={form.phone}
            onChange={change}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter mobile number"
            className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
          />
          <span className="text-xs text-muted">
            Enter a 10-digit Indian number. It is saved in +91 format.
          </span>
        </label>

        <div className="grid gap-1.5 text-sm">
          <span className="font-medium">Address</span>
          <button
            type="button"
            onClick={openLocationEditor}
            className="flex min-h-[76px] items-start gap-3 rounded-xl border border-line px-4 py-3 text-left outline-none transition hover:border-ink"
          >
            <FiMapPin className="mt-1 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-ink">
                {form.address || "Add your address"}
              </span>
              <span className="mt-1 block text-xs text-muted">
                Click to choose current location or edit address details.
              </span>
            </span>
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FiSave />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {locationOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6">
          <div className="card-soft w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Address</h3>
                <p className="mt-1 text-sm text-muted">
                  Set your service location details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => !locationSaving && setLocationOpen(false)}
                disabled={locationSaving}
                aria-label="Close address editor"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:opacity-60"
              >
                <FiX />
              </button>
            </div>

            {locationError && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {locationError}
              </div>
            )}

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={detectLocation}
                disabled={locationSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiNavigation />
                {locationSaving ? "Detecting..." : "Use Current Location"}
              </button>

              <textarea
                required
                value={locationDraft.address}
                onChange={(event) =>
                  updateLocationDraft("address", event.target.value)
                }
                placeholder="House number, street, landmark"
                rows={3}
                className="resize-none rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  value={locationDraft.area}
                  onChange={(event) =>
                    updateLocationDraft("area", event.target.value)
                  }
                  placeholder="Area"
                  className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />

                <CitySelect
                  required
                  value={locationDraft.city}
                  onChange={(city) => updateLocationDraft("city", city)}
                  className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                />
              </div>

              <input
                required
                value={locationDraft.pincode}
                onChange={(event) =>
                  updateLocationDraft("pincode", event.target.value)
                }
                placeholder="Pincode"
                inputMode="numeric"
                maxLength={6}
                className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              />

              <div className="text-xs text-muted">
                Lat: {locationDraft.latitude ?? "Not set"}, Lng:{" "}
                {locationDraft.longitude ?? "Not set"}
              </div>

              <button
                type="button"
                onClick={applyLocationDraft}
                disabled={locationSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
              >
                <FiCheckCircle />
                {locationSaving ? "Saving..." : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
