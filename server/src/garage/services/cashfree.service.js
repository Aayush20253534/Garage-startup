const axios = require("axios");

const {
  getCashfreeBaseUrl,
  getCashfreeHeaders,
  getCashfreeMode,
  isCashfreeConfigured,
} = require("../../config/cashfree");
const ApiError = require("../../utils/apiError");

const getCashfreePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "9999999999";
};

const getCashfreeApiError = (error, fallback) => {
  const cashfreeStatus = error.response?.status;
  const message = error.response?.data?.message || error.response?.data?.error_description || error.response?.data?.error || fallback;

  if (cashfreeStatus === 401 || cashfreeStatus === 403) {
    return new ApiError(502, "Cashfree rejected the payment gateway credentials. Please check CASHFREE_APP_ID, CASHFREE_SECRET_KEY, and CASHFREE_ENV on the backend.");
  }

  return new ApiError(cashfreeStatus || 502, message);
};

const getReturnBaseUrl = () => {
  const url = process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://www.rovauto.com";
  const normalizedUrl = url.replace(/\/+$/, "");

  if (!normalizedUrl.startsWith("https://")) {
    throw new ApiError(500, "Cashfree return URL must use HTTPS. Set FRONTEND_URL to your deployed frontend URL.");
  }

  return normalizedUrl;
};

const getCashfreeNotifyUrl = () => {
  const explicitUrl = String(process.env.CASHFREE_NOTIFY_URL || "").trim();
  if (explicitUrl) return explicitUrl;

  const baseUrl = String(
    process.env.PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      process.env.BACKEND_URL ||
      "",
  )
    .trim()
    .replace(/\/+$/, "");

  if (!baseUrl || !baseUrl.startsWith("https://")) return undefined;

  if (baseUrl.endsWith("/api/v1")) {
    return `${baseUrl}/webhooks/cashfree`;
  }

  return `${baseUrl}/api/v1/webhooks/cashfree`;
};

const assertCashfreeOrderMatches = (cashfreeOrder, expected) => {
  const cashfreeAmount = Number(cashfreeOrder.order_amount);
  const localAmount = Number(expected.amount);
  const cashfreeCurrency = String(cashfreeOrder.order_currency || "").toUpperCase();
  const localCurrency = String(expected.currency || "INR").toUpperCase();

  if (cashfreeOrder.order_id !== expected.cashfreeOrderId) {
    throw new ApiError(400, "Cashfree order ID mismatch");
  }

  if (!Number.isFinite(cashfreeAmount) || cashfreeAmount !== localAmount) {
    throw new ApiError(400, "Cashfree payment amount mismatch");
  }

  if (cashfreeCurrency !== localCurrency) {
    throw new ApiError(400, "Cashfree payment currency mismatch");
  }
};

const createCashfreeOrder = async ({ orderId, amount, user, returnPath, note, tags }) => {
  if (!isCashfreeConfigured()) {
    throw new ApiError(500, "Cashfree payment gateway is not configured");
  }

  try {
    const response = await axios.post(
      `${getCashfreeBaseUrl()}/orders`,
      {
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: user.id,
          customer_name: user.name || "Rovauto Garage Partner",
          customer_email: user.email || undefined,
          customer_phone: getCashfreePhone(user.phone),
        },
        order_meta: {
          return_url: `${getReturnBaseUrl()}${returnPath}?cashfree_order_id={order_id}`,
          notify_url: getCashfreeNotifyUrl(),
        },
        order_note: note,
        order_tags: tags,
      },
      { headers: getCashfreeHeaders() }
    );

    return response.data;
  } catch (error) {
    throw getCashfreeApiError(error, "Unable to create Cashfree order");
  }
};

const fetchCashfreeOrder = async (cashfreeOrderId) => {
  if (!isCashfreeConfigured()) {
    throw new ApiError(500, "Cashfree payment gateway is not configured");
  }

  try {
    const response = await axios.get(`${getCashfreeBaseUrl()}/orders/${cashfreeOrderId}`, { headers: getCashfreeHeaders() });
    return response.data;
  } catch (error) {
    throw getCashfreeApiError(error, "Unable to verify Cashfree payment");
  }
};

module.exports = {
  assertCashfreeOrderMatches,
  createCashfreeOrder,
  fetchCashfreeOrder,
  getCashfreeMode,
};
