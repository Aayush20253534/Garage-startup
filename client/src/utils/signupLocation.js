import api from "@/api/axios";
import {
  getLocationAddress,
  hasUsableIndiaCoordinates,
  reverseGeocodeCoordinates,
} from "@/utils/address";

const LOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 5 * 60 * 1000,
};

const getCurrentPosition = () => {
  if (!navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      LOCATION_OPTIONS,
    );
  });
};

export const requestSignupLocation = async () => {
  const position = await getCurrentPosition();

  if (!position?.coords) {
    return null;
  }

  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));

  if (!hasUsableIndiaCoordinates({ latitude, longitude })) {
    return null;
  }

  let address = `Lat ${latitude}, Lng ${longitude}`;

  try {
    const geocoded = await reverseGeocodeCoordinates({
      latitude,
      longitude,
    });

    address = geocoded.fullAddress || address;
  } catch (error) {
    console.warn("Signup reverse geocoding failed:", error.message);
  }

  return {
    latitude,
    longitude,
    address,
  };
};

export const hasSavedUserLocation = (user) => {
  const locations = Array.isArray(user?.locations) ? user.locations : [];

  return locations.some(
    (location) =>
      hasUsableIndiaCoordinates(location) && Boolean(getLocationAddress(location)),
  );
};

export const saveSignupLocationToProfile = async (signupLocation) => {
  if (!hasUsableIndiaCoordinates(signupLocation)) return false;

  try {
    let resolvedAddress = signupLocation.address || "";

    try {
      const geocoded = await reverseGeocodeCoordinates({
        latitude: signupLocation.latitude,
        longitude: signupLocation.longitude,
      });

      resolvedAddress = geocoded.fullAddress || resolvedAddress;
    } catch (error) {
      console.warn("Signup reverse geocoding failed:", error.message);
    }

    if (!resolvedAddress) {
      resolvedAddress = `Lat ${signupLocation.latitude}, Lng ${signupLocation.longitude}`;
    }

    await api.patch("/customer/profile", {
      address: resolvedAddress,
    });

    await api.post("/locations", {
      latitude: Number(signupLocation.latitude),
      longitude: Number(signupLocation.longitude),
      address: resolvedAddress,
      source: "GPS",
      isDefault: true,
    });

    localStorage.removeItem("rov_profile");
    localStorage.removeItem("rov_profile_time");
  } catch (error) {
    console.error("Could not save signup location:", error);
    return false;
  }

  return true;
};
