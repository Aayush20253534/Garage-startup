import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Authentication is restored from the HttpOnly cookie through the
  // garage profile endpoint. Do not hydrate garage auth from localStorage.
  garage: null,
  isOnboardingComplete: false,
  bookings: [],
  services: [],
  wallet: {
    balance: 0,
    transactions: [],
  },
  reviews: [],
  notifications: {
    whatsapp: true,
    sms: true,
  },
  loading: false,
};

export const selectGarageState = (state) => state.garage;

const garageSlice = createSlice({
  name: "garage",
  initialState,
  reducers: {
    setGarage(state, action) {
      state.garage = action.payload;
      state.isOnboardingComplete =
        action.payload?.isOnboardingComplete || false;
    },
    setBookings(state, action) {
      state.bookings = action.payload;
    },
    setServices(state, action) {
      state.services = action.payload;
    },
    setWallet(state, action) {
      state.wallet = action.payload;
    },
    setReviews(state, action) {
      state.reviews = action.payload;
    },
    setLoading(state, action) {
      state.loading = action.payload;
    },
    setNotifications(state, action) {
      state.notifications = action.payload;
    },
    acceptBooking(state, action) {
      const bookingId = action.payload;
      state.bookings = state.bookings.map((booking) =>
        booking.id === bookingId ? { ...booking, status: "ACCEPTED" } : booking,
      );
    },
    declineBooking(state, action) {
      const bookingId = action.payload;
      state.bookings = state.bookings.map((booking) =>
        booking.id === bookingId
          ? { ...booking, status: "CANCELLED" }
          : booking,
      );
    },
    clearGarageState(state) {
      state.garage = null;
      state.isOnboardingComplete = false;
      state.bookings = [];
      state.services = [];
      state.wallet = {
        balance: 0,
        transactions: [],
      };
      state.reviews = [];
      state.loading = false;
    },
  },
});

export const {
  setGarage,
  setBookings,
  setServices,
  setWallet,
  setReviews,
  setLoading,
  setNotifications,
  acceptBooking,
  declineBooking,
  clearGarageState,
} = garageSlice.actions;

export default garageSlice.reducer;
