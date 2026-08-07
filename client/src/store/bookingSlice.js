import { createSlice } from "@reduxjs/toolkit";

const readSessionJson = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readSessionValue = (key, fallback = "") => {
  if (typeof window === "undefined") return fallback;
  try {
    return window.sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const initialCart = readSessionJson("rov_booking_cart", []);

const initialState = {
  cart: Array.isArray(initialCart) ? initialCart : [],
  cartContextKey: readSessionValue("rov_booking_cart_context", ""),
};

const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    setBookingCart(state, action) {
      state.cart = Array.isArray(action.payload) ? action.payload : [];
    },
    setBookingCartContext(state, action) {
      state.cartContextKey = String(action.payload || "");
    },
    clearBookingState(state) {
      state.cart = [];
      state.cartContextKey = "";
    },
  },
});

export const {
  clearBookingState,
  setBookingCart,
  setBookingCartContext,
} = bookingSlice.actions;

export const selectBookingState = (state) => state.booking;

export default bookingSlice.reducer;
