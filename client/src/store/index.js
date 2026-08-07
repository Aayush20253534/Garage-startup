import { configureStore } from "@reduxjs/toolkit";
import customerReducer from "./customerSlice";
import garageReducer from "./garageSlice";
import bookingReducer from "./bookingSlice";

export const store = configureStore({
  reducer: {
    customer: customerReducer,
    garage: garageReducer,
    booking: bookingReducer,
  },
});
