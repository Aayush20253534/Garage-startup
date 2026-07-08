import api from "@/api/axios";
import { assertServiceHoursOpen } from "@/utils/serviceHours";

const PAYMENT_AUTH_REQUIRED = "PAYMENT_AUTH_REQUIRED";
const PAYMENT_INCOMPLETE = "PAYMENT_INCOMPLETE";

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

const getPaymentErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const isIncompletePaymentError = (error) =>
  error?.response?.status === 400 &&
  /not completed|cancelled|canceled|failed/i.test(
    getPaymentErrorMessage(error, ""),
  );

const createPaymentIncompleteError = (message) => {
  const error = new Error(
    message ||
      "Payment was not completed. You can retry payment from this checkout.",
  );
  error.code = PAYMENT_INCOMPLETE;
  return error;
};

const cancelLocalPaymentAttempt = async (bookingId) => {
  try {
    await api.post(
      "/payments/cancel",
      { bookingId },
      { skipErrorReporting: true },
    );
  } catch {
    // Do not hide the original checkout error if local cleanup fails.
  }
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
    await cancelLocalPaymentAttempt(booking.id);

    throw createPaymentIncompleteError(
      checkoutResult.error.message ||
        "Payment was not completed. A fresh payment session will be created when you retry.",
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
      error.code = PAYMENT_INCOMPLETE;
    }

    throw error;
  }
};
