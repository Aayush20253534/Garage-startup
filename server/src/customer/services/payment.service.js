const prisma = require("../../config/prisma");
const systemIssueReporter = require("../../services/systemIssueReporter.service");
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
const { deletePattern } = require("../../utils/cache");
const {
  assertServiceHoursOpen,
} = require("../../utils/serviceHours");

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
  broadcasts: {
    include: { garage: true },
    orderBy: { updatedAt: "desc" },
  },
};

const invalidatePaymentBookingCaches = async (userId) => {
  await Promise.allSettled([
    invalidateCustomerCache(userId),
    deletePattern(`customer:${userId}:bookings:*`),
    deletePattern(`customer:${userId}:booking:*`),
  ]);
};

const getCashfreeCustomerPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  const localDigits = digits.length > 10 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
  const mobile = localDigits.slice(-10);

  if (/^[6-9]\d{9}$/.test(mobile)) {
    return mobile;
  }

  return null;
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
      "Cashfree rejected the payment gateway credentials. Please check CASHFREE_APP_ID, CASHFREE_SECRET_KEY, and CASHFREE_ENV on the backend.",
    );
  }

  return new ApiError(cashfreeStatus || 502, message);
};

const getPaymentReturnBaseUrl = () => {
  const url =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "https://www.rovauto.com";

  const normalizedUrl = url.replace(/\/+$/, "");

  if (!normalizedUrl.startsWith("https://")) {
    throw new ApiError(
      500,
      "Cashfree return URL must use HTTPS. Set FRONTEND_URL to your deployed frontend URL.",
    );
  }

  return normalizedUrl;
};

const assertCashfreeOrderMatchesPayment = (
  cashfreeOrder,
  payment,
) => {
  const cashfreeAmount = Number(cashfreeOrder.order_amount);
  const localAmount = Number(payment.amount);
  const cashfreeCurrency = String(
    cashfreeOrder.order_currency || "",
  ).toUpperCase();
  const localCurrency = String(
    payment.currency || "INR",
  ).toUpperCase();

  if (cashfreeOrder.order_id !== payment.cashfreeOrderId) {
    throw new ApiError(400, "Cashfree order ID mismatch");
  }

  if (
    !Number.isFinite(cashfreeAmount) ||
    cashfreeAmount !== localAmount
  ) {
    throw new ApiError(400, "Cashfree payment amount mismatch");
  }

  if (cashfreeCurrency !== localCurrency) {
    throw new ApiError(400, "Cashfree payment currency mismatch");
  }
};

const createPaymentOrder = async (userId, { bookingId }) => {
  assertServiceHoursOpen();

  if (!isCashfreeConfigured()) {
    throw new ApiError(
      500,
      "Cashfree payment gateway is not configured",
    );
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
    throw new ApiError(
      400,
      "No online payment required for this booking",
    );
  }

  const customerPhone = getCashfreeCustomerPhone(booking.user?.phone);

  if (!customerPhone) {
    throw new ApiError(
      400,
      "Please add a valid Indian mobile number before payment.",
    );
  }

  if (
    booking.payment?.status === "CREATED" &&
    booking.payment.amount === amount &&
    booking.payment.cashfreeOrderId &&
    booking.payment.cashfreePaymentSessionId
  ) {
    return {
      payment: booking.payment,
      cashfreeOrder: {
        id: booking.payment.cashfreeOrderId,
        cfOrderId: booking.payment.cashfreePaymentId,
        amount: booking.payment.amount,
        currency: booking.payment.currency,
        paymentSessionId: booking.payment.cashfreePaymentSessionId,
      },
      mode: getCashfreeMode(),
    };
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
          customer_name:
            booking.user?.name || "Rovauto Customer",
          customer_email: booking.user?.email || undefined,
          customer_phone: customerPhone,
        },
        order_meta: {
          return_url: `${frontendUrl}/dashboard/payments?cashfree_order_id={order_id}`,
          notify_url:
            process.env.CASHFREE_NOTIFY_URL || undefined,
        },
        order_note: `Booking ${booking.bookingCode}`,
        order_tags: {
          bookingId: booking.id,
          userId,
        },
      },
      { headers: getCashfreeHeaders() },
    );

    cashfreeOrder = cashfreeRes.data;
  } catch (error) {
    throw getCashfreeApiError(
      error,
      "Unable to create Cashfree order",
    );
  }

  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: {
      amount,
      currency: "INR",
      status: "CREATED",
      cashfreeOrderId: cashfreeOrder.order_id,
      cashfreePaymentId: cashfreeOrder.cf_order_id
        ? String(cashfreeOrder.cf_order_id)
        : null,
      cashfreePaymentSessionId:
        cashfreeOrder.payment_session_id,
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
      cashfreePaymentSessionId:
        cashfreeOrder.payment_session_id,
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

const verifyPayment = async (
  userId,
  { bookingId, cashfreeOrderId },
) => {
  if (!isCashfreeConfigured()) {
    throw new ApiError(
      500,
      "Cashfree payment gateway is not configured",
    );
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
    // Make verification idempotent. Browser payment callbacks are not famous
    // for arriving exactly once.
    const paidBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingInclude,
    });

    if (
      paidBooking.status === "SEARCHING_GARAGE" &&
      !paidBooking.garageId
    ) {
      await garageRequestService.ensureBookingSearchActive(bookingId);
    }

    return {
      payment: booking.payment,
      booking: await prisma.booking.findUnique({
        where: { id: bookingId },
        include: bookingInclude,
      }),
      broadcastRequests: [],
      message: "Payment was already verified.",
    };
  }

  if (booking.payment.cashfreeOrderId !== cashfreeOrderId) {
    throw new ApiError(400, "Invalid Cashfree order ID");
  }

  let cashfreeOrder;

  try {
    const cashfreeRes = await axios.get(
      `${getCashfreeBaseUrl()}/orders/${cashfreeOrderId}`,
      { headers: getCashfreeHeaders() },
    );

    cashfreeOrder = cashfreeRes.data;
  } catch (error) {
    throw getCashfreeApiError(
      error,
      "Unable to verify Cashfree payment",
    );
  }

  const orderStatus = cashfreeOrder.order_status;
  assertCashfreeOrderMatchesPayment(
    cashfreeOrder,
    booking.payment,
  );

  if (orderStatus !== "PAID") {
    if (["EXPIRED", "TERMINATED", "FAILED"].includes(orderStatus)) {
      await prisma.payment.update({
        where: { bookingId },
        data: { status: "FAILED" },
      });

      await invalidatePaymentBookingCaches(userId);
    }

    throw new ApiError(
      400,
      "Cashfree payment is not completed yet",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { bookingId },
      data: {
        status: "PAID",
        cashfreePaymentId: cashfreeOrder.cf_order_id
          ? String(cashfreeOrder.cf_order_id)
          : booking.payment.cashfreePaymentId,
      },
    });

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "SEARCHING_GARAGE",
        searchExpiresAt: null,
        expiredAt: null,
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
      await garageRequestService.broadcastBookingToNearbyGarages(
        bookingId,
      );
  } catch (error) {
    // Payment succeeded. Never destroy that booking merely because garage
    // notification delivery failed. Tracking polling will retry the search.
    console.error(
      `[booking-search] unable to start after payment for ${bookingId}:`,
      error.message,
    );
    void systemIssueReporter.captureBackgroundError(error, {
      title: "Unable to start garage search after payment",
      component: "Payment service",
      metadata: { bookingId, userId },
    });
  }

  await invalidatePaymentBookingCaches(userId);

  return {
    ...result,
    booking: await prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingInclude,
    }),
    broadcastRequests,
    message:
      "Payment verified. Searching nearby garages in two-minute rounds.",
  };
};

const getMyPayments = async (userId) => {
  return prisma.payment.findMany({
    where: {
      booking: { userId },
      status: { in: ["PAID", "REFUNDED"] },
    },
    include: {
      booking: {
        include: {
          services: {
            include: { service: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getMyPayments,
};
