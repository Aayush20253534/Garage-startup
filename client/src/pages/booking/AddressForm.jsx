import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import api from "@/api/axios";
import { buildFullAddress, getDefaultUserLocation, parseAddressParts, reverseGeocodeCoordinates } from "@/utils/address";
import { queueGeocodeRequest, clearGeocodeCache } from "@/utils/geocodeService";
import { FiCheckCircle, FiMapPin } from "react-icons/fi";
import CitySelect from "@/components/common/CitySelect";
import { isCityAvailable, UNAVAILABLE_CITY_MESSAGE } from "@/utils/cityAvailability";
import { addRecentActivity } from "@/utils/activityLog";

export default function AddressForm() {
  const nav = useNavigate();
  const routeLocation = useLocation();
  const { user, setUser, setLocation, fetchProfile, clearProfileCache } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualLocationEdited, setManualLocationEdited] = useState(false);

  const defaultUserLocation = getDefaultUserLocation(user);
  const initialAddress =
    routeLocation.state?.existingAddress ||
    user?.customerProfile?.address ||
    defaultUserLocation?.address ||
    user?.address ||
    "";
  const initialParts = parseAddressParts(initialAddress);

  const [form, setForm] = useState({
    address: initialParts.address || "",
    area: initialParts.area || "",
    city: initialParts.city || "",
    pincode: initialParts.pincode || "",
    latitude: routeLocation.state?.latitude || defaultUserLocation?.latitude || null,
    longitude: routeLocation.state?.longitude || defaultUserLocation?.longitude || null,
  });

  const change = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
      latitude: null,
      longitude: null,
    }));
    setManualLocationEdited(true);
  };

  const getCurrentCoordinates = async () => {
    const position = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    return {
      latitude: Number(position.coords.latitude.toFixed(6)),
      longitude: Number(position.coords.longitude.toFixed(6)),
    };
  };

  const detectLocation = async () => {
    try {
      setError("");
      const { latitude, longitude } = await getCurrentCoordinates();
      try {
        const parsed = await reverseGeocodeCoordinates({ latitude, longitude });
        if (!(await isCityAvailable(parsed.city))) {
          setError(UNAVAILABLE_CITY_MESSAGE);
          setManualLocationEdited(false);
          return;
        }
        setForm({
          address: parsed.address,
          area: parsed.area,
          city: parsed.city,
          pincode: parsed.pincode,
          latitude,
          longitude,
        });
        setManualLocationEdited(false);
      } catch {
        setForm((prev) => ({ ...prev, latitude, longitude }));
        setManualLocationEdited(false);
        setError("Location detected, but address details could not be filled. Please complete the boxes.");
      }
    } catch (err) {
      setError("Could not detect location. Please enter manually.");
    }
  };

  const geocodeManualAddress = async () => {
    try {
      if (!(await isCityAvailable(form.city))) {
        setError(UNAVAILABLE_CITY_MESSAGE);
        setLoading(false);
        return;
      }

      const fullAddress = buildFullAddress(form);
      
      // Use queued request with rate limiting and fallback
      const geocodeResult = await queueGeocodeRequest(
        form.address,
        form.city,
        form.area,
        form.pincode
      );
      
      return {
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude,
        address: fullAddress,
      };
    } catch (err) {
      const errorMessage = 
        err.response?.data?.message || 
        err.message ||
        "Could not find coordinates for this address. Please check and try again.";
      throw new Error(errorMessage);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const fullAddress = buildFullAddress(form);
      let latitude = Number(form.latitude);
      let longitude = Number(form.longitude);

      // If address was manually edited, geocode it to get coordinates
      if (manualLocationEdited) {
        try {
          const geocodeResult = await geocodeManualAddress();
          latitude = geocodeResult.latitude;
          longitude = geocodeResult.longitude;
        } catch (geocodeErr) {
          setError(geocodeErr.message);
          setLoading(false);
          return;
        }
      } else if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        // If no coordinates and address wasn't manually edited, use browser geolocation
        try {
          const currentCoordinates = await getCurrentCoordinates();
          latitude = currentCoordinates.latitude;
          longitude = currentCoordinates.longitude;
        } catch (geoErr) {
          setError("Could not detect location. Please enter address manually.");
          setLoading(false);
          return;
        }
      }

      // Validate coordinates
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Could not determine coordinates. Please verify address.");
      }

      await api.post("/locations", {
        latitude,
        longitude,
        address: fullAddress,
        source: manualLocationEdited ? "MANUAL" : "GPS",
        isDefault: true,
      });

      setLocation({
        address: form.address,
        area: form.area,
        city: form.city,
        pincode: form.pincode,
        fullAddress,
        latitude,
        longitude,
      });
      addRecentActivity({
        type: "LOCATION",
        title: manualLocationEdited ? "Saved manual location" : "Saved current location",
        detail: `${form.city}${form.area ? `, ${form.area}` : ""}`,
        path: "/dashboard/profile",
      });

      clearProfileCache();
      clearGeocodeCache(); // Clear cache after successful save
      const refreshedUser = await fetchProfile({ force: true });

      setUser((prev) => ({
        ...(refreshedUser || prev),
        isOnboarded: true,
      }));

      const nextPath = routeLocation.state?.from?.pathname || "/booking/vehicle";
      nav(nextPath, { state: routeLocation.state?.from?.state });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not save address. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x py-12 max-w-lg mx-auto">
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
          className="flex items-center justify-center gap-2 rounded-xl border border-ink px-4 py-3 font-medium text-ink transition hover:bg-bg-soft"
        >
          <FiMapPin />
          Use Current Location
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
              className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
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
                className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">City</span>
              <CitySelect
                value={form.city}
                onChange={(city) => {
                  setForm((prev) => ({ ...prev, city, latitude: null, longitude: null }));
                  setManualLocationEdited(true);
                }}
                required
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
              className="rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
            />
          </label>
        </div>

        <button disabled={loading} type="submit" className="btn-primary mt-4">
          {loading ? "Saving..." : (
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
