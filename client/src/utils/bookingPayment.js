import api from "@/api/axios";
import { assertServiceHoursOpen } from "@/utils/serviceHours";

const PAYMENT_AUTH_REQUIRED = "PAYMENT_AUTH_REQUIRED";
const PAYMENT_CANCELLED = "PAYMENT_CANCELLED";

export const isPaymentAuthError = (error) => {
  const message = error?.response?.data?.message || "";

  return (
    error?.code === PAYMENT_AUTH_REQUIRED ||
    (error?.response?.status === 401 &&
      /authentication token|invalid or expired token|user no longer exists/i.test(
        message,
      ))
  );
};

const markPaymentCancelled = async (bookingId) => {
  if (!bookingId) return;

  try {
    await api.post("/payments/cancel", { bookingId });
  } catch (error) {
    // Do not hide the original Cashfree cancellation/failure from the user.
    console.warn("Unable to mark payment as cancelled", error);
  }
};

const getPaymentErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const isIncompletePaymentError = (error) =>
  error?.response?.status === 400 &&
  /not completed|cancelled|canceled|failed/i.test(
    getPaymentErrorMessage(error, ""),
  );

const createPaymentCancelledError = (message) => {
  const error = new Error(message || "Payment cancelled");
  error.code = PAYMENT_CANCELLED;
  return error;
};

export const loadCashfreeCheckout = () =>
  new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () =>
      reject(new Error("Unable to load Cashfree checkout"));
    document.body.appendChild(script);
  });

export const payForBooking = async ({ booking }) => {
  if (!booking?.id) {
    throw new Error("Booking not found");
  }

  /*
   * Check operating hours before creating a Cashfree order or loading the
   * Cashfree SDK. Payments are accepted from 10:00 AM until 10:00 PM IST.
   */
  assertServiceHoursOpen();

  const orderRes = await api.post("/payments/create-order", {
    bookingId: booking.id,
  });

  const { cashfreeOrder, mode } = orderRes.data.data;

  await loadCashfreeCheckout();

  if (!cashfreeOrder?.paymentSessionId) {
    throw new Error("Cashfree payment session was not created");
  }

  const cashfree = window.Cashfree({
    mode: mode || "sandbox",
  });

  const checkoutResult = await cashfree.checkout({
    paymentSessionId: cashfreeOrder.paymentSessionId,
    redirectTarget: "_modal",
  });

  if (checkoutResult?.error) {
    await markPaymentCancelled(booking.id);
    throw createPaymentCancelledError(
      checkoutResult.error.message || "Payment cancelled or failed",
    );
  }

  try {
    const verifyRes = await api.post("/payments/verify", {
      bookingId: booking.id,
      cashfreeOrderId: cashfreeOrder.id,
    });

    return verifyRes.data.data.booking;
  } catch (error) {
    if (isIncompletePaymentError(error)) {
      await markPaymentCancelled(booking.id);
      error.code = PAYMENT_CANCELLED;
    }

    throw error;
  }
};
