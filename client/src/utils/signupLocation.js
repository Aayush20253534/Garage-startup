import api from "@/api/axios";
import { hasUsableIndiaCoordinates } from "@/utils/address";

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
      LOCATION_OPTIONS
    );
  });
};

const reverseGeocode = async ({ latitude, longitude }) => {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return "";

    const data = await response.json();
    return data.display_name || "";
  } catch {
    return "";
  }
};

export const requestSignupLocation = async () => {
  const position = await getCurrentPosition();

  if (!position?.coords) {
    return null;
  }

  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));
  const address =
    (await reverseGeocode({ latitude, longitude })) ||
    `Lat ${latitude}, Lng ${longitude}`;

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
      hasUsableIndiaCoordinates(location) &&
      Boolean(location.address)
  );
};

export const saveSignupLocationToProfile = async (signupLocation) => {
  if (!signupLocation?.address) return false;

  try {
    await api.patch("/customer/profile", {
      address: signupLocation.address,
    });

    if (
      hasUsableIndiaCoordinates(signupLocation)
    ) {
      await api.post("/locations", {
        latitude: Number(signupLocation.latitude),
        longitude: Number(signupLocation.longitude),
        address: signupLocation.address,
        source: "GPS",
        isDefault: true,
      });
    }

    localStorage.removeItem("rov_profile");
    localStorage.removeItem("rov_profile_time");
  } catch {
    return false;
  }

  return true;
};
