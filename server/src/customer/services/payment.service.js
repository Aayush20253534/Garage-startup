const prisma = require("../../config/prisma");
const axios = require("axios");
const {
  getCashfreeBaseUrl,
  getCashfreeHeaders,
  getCashfreeMode,
  isCashfreeConfigured,
} = require("../../config/cashfree");
const ApiError = require("../../utils/apiError");
const garageRequestService = require("../../services/garageRequest.service");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const bookingLifecycleService = require("../../services/bookingLifecycle.service");

const bookingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  vehicle: true,
  garage: true,
  services: {
    include: {
      service: {
        include: {
          category: true,
          media: {
            orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
          },
        },
      },
    },
  },
  payment: true,
  broadcasts: true,
};

const getCashfreeCustomerPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return "9999999999";
};

const getCashfreeErrorMessage = (error, fallback) => {
  const cashfreeMessage =
    error.response?.data?.message ||
    error.response?.data?.error_description ||
    error.response?.data?.error;

  return cashfreeMessage || fallback;
};

const getCashfreeApiError = (error, fallback) => {
  const cashfreeStatus = error.response?.status;
  const message = getCashfreeErrorMessage(error, fallback);

  if (cashfreeStatus === 401 || cashfreeStatus === 403) {
    return new ApiError(
      502,
      "Cashfree rejected the payment gateway credentials. Please check CASHFREE_APP_ID, CASHFREE_SECRET_KEY, and CASHFREE_ENV on the backend."
    );
  }

  return new ApiError(cashfreeStatus || 502, message);
};

const getPaymentReturnBaseUrl = () => {
  const url =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "https://rovauto.vercel.app";

  const normalizedUrl = url.replace(/\/+$/, "");

  if (!normalizedUrl.startsWith("https://")) {
    throw new ApiError(
      500,
      "Cashfree return URL must use HTTPS. Set FRONTEND_URL to your deployed frontend URL."
    );
  }

  return normalizedUrl;
};

const assertCashfreeOrderMatchesPayment = (cashfreeOrder, payment) => {
  const cashfreeAmount = Number(cashfreeOrder.order_amount);
  const localAmount = Number(payment.amount);
  const cashfreeCurrency = String(cashfreeOrder.order_currency || "").toUpperCase();
  const localCurrency = String(payment.currency || "INR").toUpperCase();

  if (cashfreeOrder.order_id !== payment.cashfreeOrderId) {
    throw new ApiError(400, "Cashfree order ID mismatch");
  }

  if (!Number.isFinite(cashfreeAmount) || cashfreeAmount !== localAmount) {
    throw new ApiError(400, "Cashfree payment amount mismatch");
  }

  if (cashfreeCurrency !== localCurrency) {
    throw new ApiError(400, "Cashfree payment currency mismatch");
  }
};

const createPaymentOrder = async (userId, { bookingId }) => {
  if (!isCashfreeConfigured()) {
    throw new ApiError(500, "Cashfree payment gateway is not configured");
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: {
      payment: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.status !== "PENDING_PAYMENT") {
    throw new ApiError(400, "Booking is not pending payment");
  }

  if (booking.payment?.status === "PAID") {
    throw new ApiError(400, "Payment already completed");
  }

  const amount = booking.payableAmount || booking.handlingFee || 1;

  if (amount <= 0) {
    throw new ApiError(400, "No online payment required for this booking");
  }

  const cashfreeOrderId = `cf_${booking.bookingCode}_${Date.now()}`;
  const frontendUrl = getPaymentReturnBaseUrl();

  let cashfreeOrder;

  try {
    const cashfreeRes = await axios.post(
      `${getCashfreeBaseUrl()}/orders`,
      {
        order_id: cashfreeOrderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: userId,
          customer_name: booking.user?.name || "Rovauto Customer",
          customer_email: booking.user?.email || undefined,
          customer_phone: getCashfreeCustomerPhone(booking.user?.phone),
        },
        order_meta: {
          return_url: `${frontendUrl}/dashboard/payments?cashfree_order_id={order_id}`,
          notify_url: process.env.CASHFREE_NOTIFY_URL || undefined,
        },
        order_note: `Booking ${booking.bookingCode}`,
        order_tags: {
          bookingId: booking.id,
          userId,
        },
      },
      { headers: getCashfreeHeaders() }
    );

    cashfreeOrder = cashfreeRes.data;
  } catch (error) {
    throw getCashfreeApiError(error, "Unable to create Cashfree order");
  }

  const payment = await prisma.payment.upsert({
    where: {
      bookingId: booking.id,
    },
    update: {
      amount,
      currency: "INR",
      status: "CREATED",
      cashfreeOrderId: cashfreeOrder.order_id,
      cashfreePaymentId: cashfreeOrder.cf_order_id
        ? String(cashfreeOrder.cf_order_id)
        : null,
      cashfreePaymentSessionId: cashfreeOrder.payment_session_id,
      upiAmountPaid: amount,
    },
    create: {
      bookingId: booking.id,
      amount,
      currency: "INR",
      status: "CREATED",
      cashfreeOrderId: cashfreeOrder.order_id,
      cashfreePaymentId: cashfreeOrder.cf_order_id
        ? String(cashfreeOrder.cf_order_id)
        : null,
      cashfreePaymentSessionId: cashfreeOrder.payment_session_id,
      walletAmountUsed: booking.walletAmountUsed || 0,
      upiAmountPaid: amount,
    },
  });

  return {
    payment,
    cashfreeOrder: {
      id: cashfreeOrder.order_id,
      cfOrderId: cashfreeOrder.cf_order_id,
      amount: cashfreeOrder.order_amount,
      currency: cashfreeOrder.order_currency,
      paymentSessionId: cashfreeOrder.payment_session_id,
    },
    mode: getCashfreeMode(),
  };
};

const verifyPayment = async (userId, { bookingId, cashfreeOrderId }) => {
  if (!isCashfreeConfigured()) {
    throw new ApiError(500, "Cashfree payment gateway is not configured");
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: {
      payment: true,
      services: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (!booking.payment) {
    throw new ApiError(404, "Payment order not found");
  }

  if (booking.payment.status === "PAID") {
    throw new ApiError(400, "Payment already verified");
  }

  if (booking.payment.cashfreeOrderId !== cashfreeOrderId) {
    throw new ApiError(400, "Invalid Cashfree order ID");
  }

  let cashfreeOrder;

  try {
    const cashfreeRes = await axios.get(
      `${getCashfreeBaseUrl()}/orders/${cashfreeOrderId}`,
      { headers: getCashfreeHeaders() }
    );

    cashfreeOrder = cashfreeRes.data;
  } catch (error) {
    throw getCashfreeApiError(error, "Unable to verify Cashfree payment");
  }
  const orderStatus = cashfreeOrder.order_status;

  assertCashfreeOrderMatchesPayment(cashfreeOrder, booking.payment);

  if (orderStatus !== "PAID") {
    if (["EXPIRED", "TERMINATED", "FAILED"].includes(orderStatus)) {
      await prisma.payment.update({
        where: { bookingId },
        data: {
          status: "FAILED",
        },
      });

      await invalidateCustomerCache(userId);
    }

    throw new ApiError(400, "Cashfree payment is not completed yet");
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: {
        bookingId,
      },
      data: {
        status: "PAID",
        cashfreePaymentId: cashfreeOrder.cf_order_id
          ? String(cashfreeOrder.cf_order_id)
          : booking.payment.cashfreePaymentId,
      },
    });

    const updatedBooking = await tx.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        status: "SEARCHING_GARAGE",
        searchExpiresAt: bookingLifecycleService.getSearchExpiresAt(),
      },
      include: bookingInclude,
    });

    return {
      payment,
      booking: updatedBooking,
    };
  });

  let broadcastRequests = [];

  try {
    broadcastRequests =
      await garageRequestService.broadcastBookingToNearbyGarages(bookingId);
  } catch (error) {
    await prisma.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        status: "EXPIRED",
        expiredAt: new Date(),
      },
    });

    await invalidateCustomerCache(userId);

    throw error;
  }

  await invalidateCustomerCache(userId);

  return {
    ...result,
    broadcastRequests,
    message: "Payment verified. Request sent to nearby garages.",
  };
};

const getMyPayments = async (userId) => {
  return prisma.payment.findMany({
    where: {
      booking: {
        userId,
      },
    },
    include: {
      booking: {
        include: {
          services: {
            include: {
              service: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getMyPayments,
};
