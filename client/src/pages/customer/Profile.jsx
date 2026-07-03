import { useEffect, useState } from "react";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import CitySelect from "@/components/common/CitySelect";
import { buildFullAddress, getLocationStateFromUser, hasUsableIndiaCoordinates, parseAddressParts, reverseGeocodeCoordinates } from "@/utils/address";
import { queueGeocodeRequest } from "@/utils/geocodeService";
import { isCityAvailable, UNAVAILABLE_CITY_MESSAGE } from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";
import { FiMapPin, FiNavigation, FiX } from "react-icons/fi";

const hasCoordinateValue = (value) => value !== null && value !== undefined && value !== "";

export default function Profile() {
  const {
    user,
    setUser,
    setLocation,
    fetchProfile,
    clearProfileCache,
    clearDashboardCache,
  } = useApp();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    location: {
      latitude: null,
      longitude: null,
      source: "MANUAL",
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
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

  const fillForm = (data) => {
    const addressText = data.customerProfile?.address || data.address || "";
    const defaultLocation = data.locations?.find((item) => item.isDefault) || data.locations?.[0];

    setForm({
      name: data.name || "",
      email: data.email || "",
      phone: data.phone || "",
      address: addressText,
      location: {
        latitude: defaultLocation?.latitude ?? null,
        longitude: defaultLocation?.longitude ?? null,
        source: defaultLocation?.source || "MANUAL",
      },
    });

    setUser(data);

    const syncedLocation = getLocationStateFromUser(data);
    if (syncedLocation) {
      setLocation(syncedLocation);
    }
  };

  const loadProfile = async ({ force = false } = {}) => {
    try {
      setLoading(true);
      setError("");

      const data = await fetchProfile({ force });
      fillForm(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const change = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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
    setLocationOpen(true);
  };

  const updateLocationDraft = (field, value) => {
    setLocationDraft((prev) => ({
      ...prev,
      [field]: value,
      latitude: null,
      longitude: null,
      source: "MANUAL",
    }));
    setLocationError("");
  };

  const getCurrentCoordinates = async () => {
    const position = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
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
    setLocationSaving(true);
    setLocationError("");
    try {
      const { latitude, longitude } = await getCurrentCoordinates();
      const parsed = await reverseGeocodeCoordinates({ latitude, longitude });
      if (!(await isCityAvailable(parsed.city))) {
        setLocationError(UNAVAILABLE_CITY_MESSAGE);
        return;
      }
      setLocationDraft({
        address: parsed.address || "",
        area: parsed.area || "",
        city: parsed.city || "",
        pincode: parsed.pincode || "",
        latitude,
        longitude,
        source: "GPS",
      });
    } catch (err) {
      setLocationError(err.message || "Could not detect location.");
    } finally {
      setLocationSaving(false);
    }
  };

  const applyLocationDraft = async () => {
    setLocationSaving(true);
    setLocationError("");
    try {
      if (!(await isCityAvailable(locationDraft.city))) {
        setLocationError(UNAVAILABLE_CITY_MESSAGE);
        return;
      }

      const fullAddress = buildFullAddress(locationDraft);
      const hasDraftCoordinates =
        hasCoordinateValue(locationDraft.latitude) &&
        hasCoordinateValue(locationDraft.longitude);
      let latitude = hasDraftCoordinates ? Number(locationDraft.latitude) : null;
      let longitude = hasDraftCoordinates ? Number(locationDraft.longitude) : null;
      let source = locationDraft.source || "MANUAL";

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const result = await queueGeocodeRequest(
          locationDraft.address,
          locationDraft.city,
          locationDraft.area,
          locationDraft.pincode
        );
        latitude = result.latitude;
        longitude = result.longitude;
        source = "MANUAL";
      }

      if (!hasUsableIndiaCoordinates({ latitude, longitude })) {
        throw new Error("Could not find valid Indian coordinates for this address.");
      }

      await api.post("/locations", {
        latitude,
        longitude,
        address: fullAddress,
        source,
        isDefault: true,
      });

      const nextLocation = {
        ...locationDraft,
        fullAddress,
        latitude,
        longitude,
        source,
      };

      setLocation(nextLocation);
      setForm((prev) => ({
        ...prev,
        address: fullAddress,
        location: { latitude, longitude, source },
      }));

      clearProfileCache?.();
      clearDashboardCache?.();

      const refreshedProfile = await fetchProfile?.({ force: true });
      if (refreshedProfile) {
        fillForm(refreshedProfile);
      }

      addRecentActivity({
        type: "LOCATION",
        title: source === "GPS" ? "Updated location from GPS" : "Updated location manually",
        detail: `${locationDraft.city}${locationDraft.area ? `, ${locationDraft.area}` : ""}`,
        path: "/dashboard/profile",
      });
      setSuccess("Location updated successfully");
      setLocationOpen(false);
    } catch (err) {
      setLocationError(
        err.response?.data?.message ||
          err.message ||
          "Could not determine coordinates for this address."
      );
    } finally {
      setLocationSaving(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.patch("/customer/profile", {
        name: form.name,
        phone: form.phone,
        address: form.address,
      });

      clearProfileCache?.();
      clearDashboardCache?.();

      await loadProfile({ force: true });

      const changed = [];
      if ((user?.name || "") !== form.name) changed.push("name");
      if ((user?.phone || "") !== form.phone) changed.push("phone");
      if ((user?.customerProfile?.address || user?.address || "") !== form.address) changed.push("address");
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
      setError(err.response?.data?.message || "Failed to update profile");
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
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>

      <form onSubmit={saveProfile} className="card-soft p-6 grid gap-4">
        <div className="flex items-center gap-4">
          <span className="grid place-items-center h-16 w-16 rounded-2xl bg-ink text-white font-bold text-xl">
            {form.name?.[0]?.toUpperCase() || "U"}
          </span>

          <div>
            <div className="font-semibold text-lg">
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
            name="name"
            value={form.name}
            onChange={change}
            className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Email</span>

          <input
            type="email"
            value={form.email}
            disabled
            className="px-4 py-3 rounded-xl border border-line bg-bg-soft text-muted outline-none cursor-not-allowed"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Phone</span>

          <input
            name="phone"
            value={form.phone}
            onChange={change}
            inputMode="tel"
            placeholder="Enter mobile number"
            className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none"
          />
          <span className="text-xs text-muted">
            Use a 10-digit Indian mobile number. It will be saved as +91 format.
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

        <button disabled={saving} className="btn-primary justify-self-start">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {locationOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6">
          <div className="card-soft w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Address</h3>
                <p className="mt-1 text-sm text-muted">Set your service location details.</p>
              </div>
              <button type="button" onClick={() => setLocationOpen(false)} className="btn-ghost !px-3 !py-2">
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
                className="flex items-center justify-center gap-2 rounded-xl border border-ink px-4 py-3 font-medium text-ink transition hover:bg-bg-soft disabled:opacity-60"
              >
                <FiNavigation />
                {locationSaving ? "Detecting..." : "Use Current Location"}
              </button>

              <textarea
                required
                value={locationDraft.address}
                onChange={(e) => updateLocationDraft("address", e.target.value)}
                placeholder="House number, street, landmark"
                rows={3}
                className="resize-none rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  value={locationDraft.area}
                  onChange={(e) => updateLocationDraft("area", e.target.value)}
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
                onChange={(e) => updateLocationDraft("pincode", e.target.value)}
                placeholder="Pincode"
                inputMode="numeric"
                maxLength={6}
                className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              />

              <div className="text-xs text-muted">
                Lat: {locationDraft.latitude || "Not set"}, Lng: {locationDraft.longitude || "Not set"}
              </div>

              <button type="button" onClick={applyLocationDraft} disabled={locationSaving} className="btn-primary">
                {locationSaving ? "Saving..." : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
