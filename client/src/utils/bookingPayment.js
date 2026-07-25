import api from "@/api/axios";
import { assertServiceHoursOpen } from "@/utils/serviceHours";

const PAYMENT_AUTH_REQUIRED = "PAYMENT_AUTH_REQUIRED";
const PAYMENT_INCOMPLETE = "PAYMENT_INCOMPLETE";
const PAYMENT_ORDER_PREPARING = "PAYMENT_ORDER_PREPARING";
const PAYMENT_ORDER_RECONCILING = "PAYMENT_ORDER_RECONCILING";
const PAYMENT_SESSION_UNAVAILABLE = "PAYMENT_SESSION_UNAVAILABLE";
const CASHFREE_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
const CASHFREE_SCRIPT_ID = "cashfree-checkout-sdk";
const CASHFREE_LOAD_TIMEOUT_MS = 15_000;
const VERIFY_RETRY_DELAYS_MS = [0, 500, 1_000, 1_800];
// Cashfree may need several seconds to close an old order after the customer
// changes the wallet split. Keep the original click alive while the idempotent
// booking order endpoint settles instead of making the customer tap Pay again.
const PAYMENT_ORDER_RETRY_DELAYS_MS = [0, 600, 1_200, 2_000, 3_200, 4_500];
const RETRYABLE_PAYMENT_ORDER_STATUSES = new Set([
  408,
  425,
  429,
  502,
  503,
  504,
]);
const RETRYABLE_PAYMENT_NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ERR_NETWORK",
  "ETIMEDOUT",
]);
const MAX_PAYMENT_ORDER_NETWORK_FAILURES = 2;

let cashfreeSdkPromise = null;
const cashfreeClients = new Map();

export const BOOKING_PAYMENT_PROGRESS = Object.freeze({
  CREATING_BOOKING: "CREATING_BOOKING",
  PREPARING_PAYMENT: "PREPARING_PAYMENT",
  RECONCILING_PAYMENT: "RECONCILING_PAYMENT",
  VERIFYING_PAYMENT: "VERIFYING_PAYMENT",
  ACTIVATING_SEARCH: "ACTIVATING_SEARCH",
});

const reportPaymentProgress = (callback, phase) => {
  if (typeof callback !== "function") return;

  try {
    callback(phase);
  } catch {
    // Progress UI must never interrupt a payment operation.
  }
};

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const getPaymentErrorCode = (error) =>
  error?.response?.data?.code || error?.code || "";

export const isPaymentAuthError = (error) => {
  const message = error?.response?.data?.message || "";

  return (
    getPaymentErrorCode(error) === PAYMENT_AUTH_REQUIRED ||
    (error?.response?.status === 401 &&
      /authentication token|invalid or expired token|user no longer exists/i.test(
        message,
      ))
  );
};

const getPaymentErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

export const isPaymentSessionPreparingError = (error) =>
  [
    PAYMENT_ORDER_PREPARING,
    PAYMENT_ORDER_RECONCILING,
    PAYMENT_SESSION_UNAVAILABLE,
  ].includes(
    getPaymentErrorCode(error),
  );

export const isPaymentIncompleteError = (error) =>
  getPaymentErrorCode(error) === PAYMENT_INCOMPLETE ||
  (error?.response?.status === 400 &&
    /not completed|cancelled|canceled|failed/i.test(
      getPaymentErrorMessage(error, ""),
    ));

const createPaymentIncompleteError = (message) => {
  const error = new Error(
    message ||
      "Payment was not completed. You can retry payment from this checkout.",
  );
  error.code = PAYMENT_INCOMPLETE;
  return error;
};

const createPaymentSessionPreparingError = (message) => {
  const error = new Error(
    message ||
      "Cashfree could not prepare a usable payment session. No money was deducted.",
  );
  error.code = PAYMENT_ORDER_PREPARING;
  return error;
};

const isRetryablePaymentNetworkError = (error) => {
  if (error?.response) return false;

  const code = String(error?.code || "");
  const message = String(error?.message || "");

  return (
    RETRYABLE_PAYMENT_NETWORK_CODES.has(code) ||
    /timeout|network error|failed to fetch|load failed/i.test(message)
  );
};

const isRetryablePaymentOrderError = (error) => {
  if (isPaymentSessionPreparingError(error)) return true;

  const status = Number(error?.response?.status || 0);
  if (RETRYABLE_PAYMENT_ORDER_STATUSES.has(status)) return true;

  return isRetryablePaymentNetworkError(error);
};

const requestBookingPaymentOrder = async ({ bookingId, useWallet }) => {
  let lastError = null;
  let networkFailureCount = 0;

  for (const delay of PAYMENT_ORDER_RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);

    try {
      const orderRes = await api.post("/payments/create-order", {
        bookingId,
        useWallet: Boolean(useWallet),
      });
      const result = orderRes.data?.data || {};

      if (result.booking && result.payment?.status === "PAID") {
        return result;
      }

      if (result.cashfreeOrder?.paymentSessionId) {
        return result;
      }

      lastError = createPaymentSessionPreparingError();
    } catch (error) {
      // Creating/reusing a payment order is idempotent for the booking. It is
      // safe to recover transient gateway and network failures here.
      if (!isRetryablePaymentOrderError(error)) {
        throw error;
      }

      if (isRetryablePaymentNetworkError(error)) {
        networkFailureCount += 1;
        if (networkFailureCount >= MAX_PAYMENT_ORDER_NETWORK_FAILURES) {
          throw error;
        }
      }

      lastError = error;
    }
  }

  throw (
    lastError ||
    createPaymentSessionPreparingError(
      "Cashfree could not prepare a payment session right now. No money was deducted; please try again.",
    )
  );
};

const getCashfreeScript = () =>
  document.getElementById(CASHFREE_SCRIPT_ID) ||
  document.querySelector(`script[src="${CASHFREE_SDK_URL}"]`);

export const loadCashfreeCheckout = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error("Cashfree checkout is available only in the browser"),
    );
  }

  if (window.Cashfree) {
    return Promise.resolve(true);
  }

  if (cashfreeSdkPromise) {
    return cashfreeSdkPromise;
  }

  cashfreeSdkPromise = new Promise((resolve, reject) => {
    let script = getCashfreeScript();
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };

    const fail = (message) => {
      cleanup();
      if (!window.Cashfree) script?.remove();
      cashfreeSdkPromise = null;
      reject(new Error(message));
    };

    const handleLoad = () => {
      if (!window.Cashfree) {
        fail("Cashfree checkout loaded without becoming available");
        return;
      }

      cleanup();
      resolve(true);
    };

    const handleError = () => {
      fail("Unable to load Cashfree checkout. Check your connection and retry.");
    };

    const shouldAppendScript = !script;

    if (!script) {
      script = document.createElement("script");
      script.id = CASHFREE_SCRIPT_ID;
      script.src = CASHFREE_SDK_URL;
      script.async = true;
      script.defer = true;
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    timeoutId = window.setTimeout(() => {
      fail("Cashfree checkout took too long to load. Please retry.");
    }, CASHFREE_LOAD_TIMEOUT_MS);

    if (shouldAppendScript) {
      document.head.appendChild(script);
    }

    // A script already present in the document may have completed just before
    // the listeners above were attached.
    if (window.Cashfree) {
      handleLoad();
    }
  });

  return cashfreeSdkPromise;
};

export const preloadCashfreeCheckout = () => {
  void loadCashfreeCheckout().catch(() => {
    // Preloading is best-effort. The payment click retries the load and shows
    // the actionable error if the network is still unavailable.
  });
};

const getCashfreeClient = (mode) => {
  const normalizedMode = mode === "production" ? "production" : "sandbox";

  if (!cashfreeClients.has(normalizedMode)) {
    cashfreeClients.set(
      normalizedMode,
      window.Cashfree({ mode: normalizedMode }),
    );
  }

  return cashfreeClients.get(normalizedMode);
};

const reconcileCheckoutAttempt = async (bookingId) => {
  try {
    const response = await api.post(
      "/payments/cancel",
      { bookingId },
      { skipErrorReporting: true },
    );
    const result = response.data?.data || {};
    const booking = result.booking || null;
    const payment = result.payment || booking?.payment || null;

    if (
      booking &&
      payment?.status === "PAID" &&
      booking.status !== "PENDING_PAYMENT"
    ) {
      return { paidBooking: booking, message: result.message || "" };
    }

    if (payment?.status === "REFUNDED") {
      const refundedError = new Error(
        result.message ||
          "The payment was safely credited to your Rovauto wallet. Please review the booking before retrying.",
      );
      refundedError.code = "PAYMENT_REFUNDED_TO_WALLET";
      throw refundedError;
    }

    return {
      paidBooking: null,
      message:
        result.message ||
        "Payment was not completed. Your booking remains available for retry.",
    };
  } catch (error) {
    if (error?.code === "PAYMENT_REFUNDED_TO_WALLET") {
      throw error;
    }

    return { paidBooking: null, message: "" };
  }
};

const verifyBookingPayment = async ({ bookingId, cashfreeOrderId }) => {
  let lastError = null;

  for (const delay of VERIFY_RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);

    try {
      const verifyRes = await api.post("/payments/verify", {
        bookingId,
        cashfreeOrderId,
      });

      return verifyRes.data?.data || {};
    } catch (error) {
      lastError = error;

      if (!isPaymentIncompleteError(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    lastError.code = PAYMENT_INCOMPLETE;
    throw lastError;
  }

  throw createPaymentIncompleteError();
};

export const payForBooking = async ({
  booking,
  useWallet = false,
  walletOnlyExpected = false,
  onProgress,
} = {}) => {
  if (!booking?.id) {
    throw new Error("Booking not found");
  }

  /*
   * Check operating hours before creating a Cashfree order. The SDK starts
   * loading immediately afterwards so network setup runs in parallel with the
   * backend order request instead of making the user wait for both serially.
   */
  assertServiceHoursOpen();
  reportPaymentProgress(
    onProgress,
    BOOKING_PAYMENT_PROGRESS.PREPARING_PAYMENT,
  );

  let sdkLoadError = null;
  let cashfreeReadyPromise = null;

  // A wallet-only payment is completed entirely by the backend. Avoid opening
  // or waiting for the Cashfree SDK unless the server reports that a remaining
  // gateway amount is still required (for example, after a wallet balance race).
  if (!walletOnlyExpected) {
    cashfreeReadyPromise = loadCashfreeCheckout().catch((error) => {
      sdkLoadError = error;
      return false;
    });
  }

  const result = await requestBookingPaymentOrder({
    bookingId: booking.id,
    useWallet,
  });
  const { cashfreeOrder, mode } = result;

  if (result.booking && result.payment?.status === "PAID") {
    reportPaymentProgress(
      onProgress,
      BOOKING_PAYMENT_PROGRESS.ACTIVATING_SEARCH,
    );
    return result.booking;
  }

  if (!cashfreeReadyPromise) {
    cashfreeReadyPromise = loadCashfreeCheckout().catch((error) => {
      sdkLoadError = error;
      return false;
    });
  }

  const cashfreeReady = await cashfreeReadyPromise;

  if (!cashfreeReady) {
    reportPaymentProgress(onProgress, null);
    throw sdkLoadError || new Error("Unable to load Cashfree checkout");
  }

  if (!cashfreeOrder?.paymentSessionId) {
    reportPaymentProgress(onProgress, null);
    throw createPaymentSessionPreparingError(
      "Cashfree did not return a usable payment session. No money was deducted; please try again.",
    );
  }

  const cashfree = getCashfreeClient(mode);
  let checkoutResult;
  reportPaymentProgress(onProgress, null);

  try {
    checkoutResult = await cashfree.checkout({
      paymentSessionId: cashfreeOrder.paymentSessionId,
      redirectTarget: "_modal",
    });
  } catch (checkoutError) {
    reportPaymentProgress(
      onProgress,
      BOOKING_PAYMENT_PROGRESS.RECONCILING_PAYMENT,
    );
    const reconciliation = await reconcileCheckoutAttempt(booking.id);

    if (reconciliation.paidBooking) {
      reportPaymentProgress(
        onProgress,
        BOOKING_PAYMENT_PROGRESS.ACTIVATING_SEARCH,
      );
      return reconciliation.paidBooking;
    }

    throw createPaymentIncompleteError(
      reconciliation.message ||
        checkoutError?.message ||
        "Cashfree checkout could not be opened. Please retry.",
    );
  }

  if (checkoutResult?.error) {
    // Cashfree reports both a user-closed modal and checkout errors through the
    // same field. Reconcile the order server-side before declaring failure so
    // a late successful payment is never shown as an unpaid booking.
    reportPaymentProgress(
      onProgress,
      BOOKING_PAYMENT_PROGRESS.RECONCILING_PAYMENT,
    );
    const reconciliation = await reconcileCheckoutAttempt(booking.id);

    if (reconciliation.paidBooking) {
      reportPaymentProgress(
        onProgress,
        BOOKING_PAYMENT_PROGRESS.ACTIVATING_SEARCH,
      );
      return reconciliation.paidBooking;
    }

    throw createPaymentIncompleteError(
      reconciliation.message ||
        checkoutResult.error.message ||
        "Payment was not completed. The same secure session can be retried.",
    );
  }

  reportPaymentProgress(
    onProgress,
    BOOKING_PAYMENT_PROGRESS.VERIFYING_PAYMENT,
  );
  const verification = await verifyBookingPayment({
    bookingId: booking.id,
    cashfreeOrderId: cashfreeOrder.id,
  });

  if (verification.payment?.status === "REFUNDED") {
    const refundedError = new Error(
      verification.message ||
        "The payment was safely credited to your Rovauto wallet. Please review the booking before retrying.",
    );
    refundedError.code = "PAYMENT_REFUNDED_TO_WALLET";
    throw refundedError;
  }

  reportPaymentProgress(
    onProgress,
    BOOKING_PAYMENT_PROGRESS.ACTIVATING_SEARCH,
  );
  return verification.booking;
};
