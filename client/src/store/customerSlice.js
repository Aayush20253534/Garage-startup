import { createSlice } from "@reduxjs/toolkit";
import { hasUsableIndiaCoordinates } from "@/utils/address";

const readJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readArray = (key) => {
  const value = readJson(key, []);
  return Array.isArray(value) ? value : [];
};

const getDefaultVehicle = (vehicles = []) =>
  vehicles.find((item) => item.isDefault) || vehicles[0] || null;

const initialVehicles = readArray("rov_vehicles");

const initialState = {
  user: readJson("user", readJson("rov_user", null)),
  token: localStorage.getItem("token") || null,
  vehicles: initialVehicles,
  vehicle: readJson("rov_vehicle", getDefaultVehicle(initialVehicles)),
  location: readJson("rov_location", null),
};

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    setCustomerToken(state, action) {
      state.token = action.payload;
    },
    setCustomerUser(state, action) {
      state.user = action.payload;
    },
    setCustomerVehicle(state, action) {
      state.vehicle = action.payload;
    },
    setCustomerVehicles(state, action) {
      const vehicles = Array.isArray(action.payload) ? action.payload : [];
      state.vehicles = vehicles;
      state.vehicle = getDefaultVehicle(vehicles);
    },
    setCustomerLocation(state, action) {
      state.location = action.payload || null;
    },
    syncCustomerBundle(state, action) {
      const user = action.payload || null;
      const vehicles = Array.isArray(user?.vehicles) ? user.vehicles : [];
      const locations = Array.isArray(user?.locations) ? user.locations : [];

      state.user = user;
      state.vehicles = vehicles;
      state.vehicle = getDefaultVehicle(vehicles);

      const validLocations = locations.filter(
        (item) => hasUsableIndiaCoordinates(item) && Boolean(item.address)
      );

      if (validLocations.length > 0) {
        state.location = validLocations.find((item) => item.isDefault) || validLocations[0];
      }
    },
    clearCustomerState(state) {
      state.user = null;
      state.token = null;
      state.vehicles = [];
      state.vehicle = null;
      state.location = null;
    },
  },
});

export const {
  clearCustomerState,
  setCustomerLocation,
  setCustomerToken,
  setCustomerUser,
  setCustomerVehicle,
  setCustomerVehicles,
  syncCustomerBundle,
} = customerSlice.actions;

export const selectCustomerState = (state) => state.customer;

export default customerSlice.reducer;
