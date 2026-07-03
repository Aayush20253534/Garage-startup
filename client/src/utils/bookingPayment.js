import api from "@/api/axios";

const PAYMENT_AUTH_REQUIRED = "PAYMENT_AUTH_REQUIRED";

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
    throw new Error(
      checkoutResult.error.message || "Payment cancelled or failed",
    );
  }

  const verifyRes = await api.post("/payments/verify", {
    bookingId: booking.id,
    cashfreeOrderId: cashfreeOrder.id,
  });

  return verifyRes.data.data.booking;
};
