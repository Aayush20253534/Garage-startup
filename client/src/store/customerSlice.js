import { createSlice } from "@reduxjs/toolkit";
import { getLocationAddress, hasUsableIndiaCoordinates } from "@/utils/address";

const readJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getDefaultVehicle = (vehicles = []) =>
  vehicles.find((item) => item.isDefault) || vehicles[0] || null;

const getPreservedVehicle = (vehicles = [], currentVehicle = null) => {
  const currentVehicleId = currentVehicle?.id;

  if (currentVehicleId) {
    const refreshedSelection = vehicles.find(
      (item) => item?.id === currentVehicleId,
    );

    if (refreshedSelection) return refreshedSelection;
  }

  return getDefaultVehicle(vehicles);
};

const initialState = {
  // Authentication is restored from the HttpOnly cookie through /auth/me.
  // Cached localStorage data must never be treated as proof of authentication.
  user: null,
  vehicles: [],
  vehicle: readJson("rov_vehicle", null),
  location: readJson("rov_location", null),
};

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    setCustomerUser(state, action) {
      state.user = action.payload;
    },
    setCustomerVehicle(state, action) {
      state.vehicle = action.payload;
    },
    setCustomerVehicles(state, action) {
      const vehicles = Array.isArray(action.payload) ? action.payload : [];
      const currentVehicle = state.vehicle;

      state.vehicles = vehicles;
      state.vehicle = getPreservedVehicle(vehicles, currentVehicle);
    },
    setCustomerLocation(state, action) {
      state.location = action.payload || null;
    },
    syncCustomerBundle(state, action) {
      const user = action.payload || null;
      const vehicles = Array.isArray(user?.vehicles) ? user.vehicles : [];
      const locations = Array.isArray(user?.locations) ? user.locations : [];

      const currentVehicle = state.vehicle;

      state.user = user;
      state.vehicles = vehicles;
      state.vehicle = getPreservedVehicle(vehicles, currentVehicle);

      const validLocations = locations.filter(
        (item) => hasUsableIndiaCoordinates(item) && Boolean(getLocationAddress(item)),
      );

      if (validLocations.length > 0) {
        state.location =
          validLocations.find((item) => item.isDefault) || validLocations[0];
      }
    },
    clearCustomerState(state) {
      state.user = null;
      state.vehicles = [];
      state.vehicle = null;
      state.location = null;
    },
  },
});

export const {
  clearCustomerState,
  setCustomerLocation,
  setCustomerUser,
  setCustomerVehicle,
  setCustomerVehicles,
  syncCustomerBundle,
} = customerSlice.actions;

export const selectCustomerState = (state) => state.customer;

export default customerSlice.reducer;
