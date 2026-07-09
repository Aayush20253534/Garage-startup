const prisma = require("../../config/prisma");
const crypto = require("crypto");
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

const DEFAULT_PAYMENT_SESSION_REUSE_MS = 10 * 60 * 1000;
const REUSABLE_CASHFREE_ORDER_STATUSES = new Set(["ACTIVE", "CREATED"]);
const TERMINAL_CASHFREE_ORDER_STATUSES = new Set([
  "EXPIRED",
  "TERMINATED",
  "FAILED",
  "CANCELLED",
  "CANCELED",
]);

const getPaymentSessionReuseMs = () => {
  const parsed = Number(process.env.CASHFREE_PAYMENT_SESSION_REUSE_MS);
  return Number.isFinite(parsed) && parsed >= 60 * 1000
    ? parsed
    : DEFAULT_PAYMENT_SESSION_REUSE_MS;
};

const getCashfreeOrderStatus = (cashfreeOrder) =>
  String(cashfreeOrder?.order_status || "").toUpperCase();

const isPaymentSessionFresh = (payment) => {
  const referenceDate = payment?.updatedAt || payment?.createdAt;
  const timestamp = referenceDate ? new Date(referenceDate).getTime() : 0;

  return Number.isFinite(timestamp) &&
    timestamp > 0 &&
    Date.now() - timestamp <= getPaymentSessionReuseMs();
};

const fetchCashfreeOrder = async (cashfreeOrderId, fallback) => {
  try {
    const cashfreeRes = await axios.get(
      `${getCashfreeBaseUrl()}/orders/${cashfreeOrderId}`,
      { headers: getCashfreeHeaders() },
    );

    return cashfreeRes.data;
  } catch (error) {
    throw getCashfreeApiError(
      error,
      fallback || "Unable to verify Cashfree payment",
    );
  }
};

const toWholeRupee = (value, fallback = 0) => {
  const amount = Math.round(Number(value));
  return Number.isFinite(amount) && amount > 0 ? amount : fallback;
};

const isWalletRequested = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const getBookingPaymentAmount = (booking) => {
  return (
    toWholeRupee(booking?.handlingFee) ||
    toWholeRupee(booking?.payment?.amount) ||
    toWholeRupee(booking?.payableAmount) ||
    1
  );
};

const getCashfreePayableAmount = (payment = {}) => {
  const upiAmount = Math.round(Number(payment.upiAmountPaid));

  if (Number.isFinite(upiAmount) && upiAmount > 0) {
    return upiAmount;
  }

  if (toWholeRupee(payment.walletAmountUsed) > 0) {
    return 0;
  }

  return toWholeRupee(payment.amount);
};

const getWalletPaymentSplit = async (userId, totalAmount, useWallet) => {
  const amount = toWholeRupee(totalAmount);

  if (!isWalletRequested(useWallet)) {
    return {
      walletAmountUsed: 0,
      upiAmountPaid: amount,
    };
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true },
  });

  const walletBalance = toWholeRupee(wallet?.balance);
  const walletAmountUsed = Math.min(walletBalance, amount);

  return {
    walletAmountUsed,
    upiAmountPaid: Math.max(amount - walletAmountUsed, 0),
  };
};

const reserveWalletForBookingPaymentTx = async (
  tx,
  { userId, booking, amount, cashfreeOrderId = null },
) => {
  const walletAmount = toWholeRupee(amount);

  if (walletAmount <= 0) return null;

  const debitResult = await tx.wallet.updateMany({
    where: {
      userId,
      balance: { gte: walletAmount },
    },
    data: {
      balance: { decrement: walletAmount },
    },
  });

  if (debitResult.count !== 1) {
    throw new ApiError(400, "Wallet balance changed. Please refresh and try again.");
  }

  const wallet = await tx.wallet.findUnique({
    where: { userId },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId,
      type: "BOOKING_PAYMENT",
      status: "SUCCESS",
      amount: walletAmount,
      balanceAfter: wallet.balance,
      cashfreeOrderId,
      description: `Wallet used for booking ${
        booking.bookingCode || booking.id
      }`,
    },
  });

  return wallet;
};

const getWalletPaymentLookupFilters = ({ payment, booking } = {}) => {
  const filters = [];

  if (payment?.cashfreeOrderId) {
    filters.push({ cashfreeOrderId: payment.cashfreeOrderId });
  }

  if (payment?.cashfreePaymentId) {
    filters.push({ cashfreePaymentId: payment.cashfreePaymentId });
  }

  if (booking?.bookingCode) {
    filters.push({ description: { contains: booking.bookingCode } });
  }

  if (booking?.id || payment?.bookingId) {
    filters.push({
      description: { contains: booking?.id || payment.bookingId },
    });
  }

  return filters;
};

const findWalletPaymentDebitTx = async (tx, { payment, booking, userId }) => {
  const walletAmount = toWholeRupee(
    payment?.walletAmountUsed ?? booking?.walletAmountUsed,
  );

  if (walletAmount <= 0) return null;

  const filters = getWalletPaymentLookupFilters({ payment, booking });

  return tx.walletTransaction.findFirst({
    where: {
      userId,
      type: "BOOKING_PAYMENT",
      status: "SUCCESS",
      amount: walletAmount,
      ...(filters.length > 0 ? { OR: filters } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
};

const findWalletPaymentRefundTx = async (tx, { payment, booking, userId }) => {
  const walletAmount = toWholeRupee(payment?.walletAmountUsed);

  if (walletAmount <= 0) return null;

  const filters = getWalletPaymentLookupFilters({ payment, booking });

  return tx.walletTransaction.findFirst({
    where: {
      userId,
      type: "BOOKING_REFUND",
      status: "SUCCESS",
      amount: walletAmount,
      ...(filters.length > 0 ? { OR: filters } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
};

const applyWalletPaymentIfNeededTx = async (tx, { payment, booking, userId }) => {
  const walletAmount = toWholeRupee(payment?.walletAmountUsed);

  if (walletAmount <= 0) return null;

  const existingDebit = await findWalletPaymentDebitTx(tx, {
    payment,
    booking,
    userId,
  });

  if (existingDebit) return existingDebit;

  return reserveWalletForBookingPaymentTx(tx, {
    userId,
    booking,
    amount: walletAmount,
    cashfreeOrderId: payment.cashfreeOrderId || null,
  });
};

const refundWalletPaymentTx = async (
  tx,
  { payment, booking, userId, onlyIfDebited = false },
) => {
  const walletAmount = toWholeRupee(payment?.walletAmountUsed);

  if (walletAmount <= 0) return null;

  if (onlyIfDebited) {
    const existingDebit = await findWalletPaymentDebitTx(tx, {
      payment,
      booking,
      userId,
    });

    if (!existingDebit) return null;
  }

  const existingRefund = await findWalletPaymentRefundTx(tx, {
    payment,
    booking,
    userId,
  });

  if (existingRefund) return null;

  const wallet = await tx.wallet.upsert({
    where: { userId },
    update: {
      balance: { increment: walletAmount },
    },
    create: {
      userId,
      type: "CUSTOMER",
      balance: walletAmount,
    },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId,
      type: "BOOKING_REFUND",
      status: "SUCCESS",
      amount: walletAmount,
      balanceAfter: wallet.balance,
      cashfreeOrderId: payment.cashfreeOrderId || null,
      cashfreePaymentId: payment.cashfreePaymentId || null,
      description: `Wallet refund for booking ${
        booking?.bookingCode || booking?.id || payment.bookingId
      }`,
    },
  });

  return wallet;
};

const failCreatedPaymentAndReleaseWallet = async ({
  bookingId,
  cashfreeOrderId = null,
}) => {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        bookingId,
        status: "CREATED",
        ...(cashfreeOrderId ? { cashfreeOrderId } : {}),
      },
      include: { booking: true },
    });

    if (!payment) return null;

    const booking = payment.booking;

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });

    await refundWalletPaymentTx(tx, {
      payment,
      booking,
      userId: booking.userId,
      onlyIfDebited: true,
    });

    await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: "PENDING_PAYMENT",
      },
      data: {
        walletAmountUsed: 0,
        payableAmount: getBookingPaymentAmount(booking),
      },
    });

    return { payment, booking };
  });

  if (result?.booking?.userId) {
    await invalidatePaymentBookingCaches(result.booking.userId);
  }

  return result;
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

const assertCashfreeOrderMatchesPayment = (
  cashfreeOrder,
  payment,
) => {
  const cashfreeAmount = Number(cashfreeOrder.order_amount);
  const localCashfreeAmount = getCashfreePayableAmount(payment);
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
    cashfreeAmount !== localCashfreeAmount
  ) {
    throw new ApiError(400, "Cashfree payment amount mismatch");
  }

  if (cashfreeCurrency !== localCurrency) {
    throw new ApiError(400, "Cashfree payment currency mismatch");
  }
};

const ensurePendingPaymentBooking = (booking) => {
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.status !== "PENDING_PAYMENT") {
    throw new ApiError(400, "Booking is no longer pending payment");
  }

  if (booking.payment?.status === "PAID") {
    throw new ApiError(400, "Payment already completed");
  }
};

const startGarageSearchAfterPayment = async (bookingId, userId) => {
  let broadcastRequests = [];

  try {
    broadcastRequests =
      await garageRequestService.broadcastBookingToNearbyGarages(bookingId);
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

  return broadcastRequests;
};

const completePaidBookingPayment = async (booking, cashfreeOrder) => {
  const orderStatus = getCashfreeOrderStatus(cashfreeOrder);

  assertCashfreeOrderMatchesPayment(cashfreeOrder, booking.payment);

  if (orderStatus !== "PAID") {
    if (TERMINAL_CASHFREE_ORDER_STATUSES.has(orderStatus)) {
      await failCreatedPaymentAndReleaseWallet({
        bookingId: booking.id,
        cashfreeOrderId: booking.payment.cashfreeOrderId,
      });
    }

    throw new ApiError(400, "Cashfree payment is not completed yet");
  }

  const result = await prisma.$transaction(async (tx) => {
    await applyWalletPaymentIfNeededTx(tx, {
      payment: booking.payment,
      booking,
      userId: booking.userId,
    });

    const paymentUpdate = await tx.payment.updateMany({
      where: {
        bookingId: booking.id,
        cashfreeOrderId: booking.payment.cashfreeOrderId,
        status: { not: "PAID" },
      },
      data: {
        status: "PAID",
        cashfreePaymentId: cashfreeOrder.cf_order_id
          ? String(cashfreeOrder.cf_order_id)
          : booking.payment.cashfreePaymentId,
      },
    });

    const payment = await tx.payment.findUnique({
      where: { bookingId: booking.id },
    });

    await tx.booking.updateMany({
      where: {
        id: booking.id,
        status: "PENDING_PAYMENT",
      },
      data: {
        status: "SEARCHING_GARAGE",
        searchExpiresAt: null,
        expiredAt: null,
      },
    });

    const updatedBooking = await tx.booking.findUnique({
      where: { id: booking.id },
      include: bookingInclude,
    });

    return {
      payment,
      booking: updatedBooking,
      completedNow: paymentUpdate.count > 0,
    };
  });

  let broadcastRequests = [];

  if (
    result.booking?.status === "SEARCHING_GARAGE" &&
    !result.booking?.garageId
  ) {
    broadcastRequests = await startGarageSearchAfterPayment(
      booking.id,
      booking.userId,
    );
  }

  await invalidatePaymentBookingCaches(booking.userId);

  return {
    payment: result.payment,
    booking: await prisma.booking.findUnique({
      where: { id: booking.id },
      include: bookingInclude,
    }),
    broadcastRequests,
    message: result.completedNow
      ? "Payment verified. Searching nearby garages in two-minute rounds."
      : "Payment was already verified.",
  };
};

const tryReuseCreatedPaymentOrder = async (booking, amount) => {
  const payment = booking.payment;

  if (
    payment?.status !== "CREATED" ||
    payment.amount !== amount ||
    !payment.cashfreeOrderId ||
    !payment.cashfreePaymentSessionId
  ) {
    return null;
  }

  if (!isPaymentSessionFresh(payment)) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId: booking.id,
      cashfreeOrderId: payment.cashfreeOrderId,
    });
    return null;
  }

  const cashfreeOrder = await fetchCashfreeOrder(
    payment.cashfreeOrderId,
    "Unable to check existing Cashfree order",
  );
  const orderStatus = getCashfreeOrderStatus(cashfreeOrder);

  assertCashfreeOrderMatchesPayment(cashfreeOrder, payment);

  if (orderStatus === "PAID") {
    await completePaidBookingPayment(booking, cashfreeOrder);
    throw new ApiError(
      409,
      "Payment is already completed. Refresh your booking status.",
    );
  }

  if (REUSABLE_CASHFREE_ORDER_STATUSES.has(orderStatus)) {
    return {
      payment,
      cashfreeOrder: {
        id: payment.cashfreeOrderId,
        cfOrderId: payment.cashfreePaymentId,
        amount: getCashfreePayableAmount(payment),
        currency: payment.currency,
        paymentSessionId: payment.cashfreePaymentSessionId,
      },
      mode: getCashfreeMode(),
    };
  }

  if (TERMINAL_CASHFREE_ORDER_STATUSES.has(orderStatus)) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId: booking.id,
      cashfreeOrderId: payment.cashfreeOrderId,
    });
  }

  return null;
};

const completeWalletOnlyBookingPayment = async (
  userId,
  booking,
  totalAmount,
  walletAmountUsed,
) => {
  const result = await prisma.$transaction(async (tx) => {
    await reserveWalletForBookingPaymentTx(tx, {
      userId,
      booking,
      amount: walletAmountUsed,
    });

    const payment = await tx.payment.upsert({
      where: { bookingId: booking.id },
      update: {
        amount: totalAmount,
        currency: "INR",
        status: "PAID",
        cashfreeOrderId: null,
        cashfreePaymentId: null,
        cashfreePaymentSessionId: null,
        walletAmountUsed,
        upiAmountPaid: 0,
      },
      create: {
        bookingId: booking.id,
        amount: totalAmount,
        currency: "INR",
        status: "PAID",
        cashfreeOrderId: null,
        cashfreePaymentId: null,
        cashfreePaymentSessionId: null,
        walletAmountUsed,
        upiAmountPaid: 0,
      },
    });

    await tx.booking.updateMany({
      where: {
        id: booking.id,
        status: "PENDING_PAYMENT",
      },
      data: {
        status: "SEARCHING_GARAGE",
        walletAmountUsed,
        payableAmount: 0,
        searchExpiresAt: null,
        expiredAt: null,
      },
    });

    const updatedBooking = await tx.booking.findUnique({
      where: { id: booking.id },
      include: bookingInclude,
    });

    return { payment, booking: updatedBooking };
  });

  let broadcastRequests = [];

  if (
    result.booking?.status === "SEARCHING_GARAGE" &&
    !result.booking?.garageId
  ) {
    broadcastRequests = await startGarageSearchAfterPayment(
      booking.id,
      userId,
    );
  }

  await invalidatePaymentBookingCaches(userId);

  return {
    payment: result.payment,
    booking: await prisma.booking.findUnique({
      where: { id: booking.id },
      include: bookingInclude,
    }),
    broadcastRequests,
    walletAmountUsed,
    upiAmountPaid: 0,
    cashfreeOrder: null,
    mode: getCashfreeMode(),
    message: "Wallet payment completed. Searching nearby garages in two-minute rounds.",
  };
};

const createPaymentOrder = async (userId, { bookingId, useWallet = false }) => {
  assertServiceHoursOpen();

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

  ensurePendingPaymentBooking(booking);

  const amount = getBookingPaymentAmount(booking);

  if (amount <= 0) {
    throw new ApiError(
      400,
      "No online payment required for this booking",
    );
  }

  let split = await getWalletPaymentSplit(userId, amount, useWallet);

  if (booking.payment?.status === "CREATED") {
    const existingWalletAmount = toWholeRupee(
      booking.payment.walletAmountUsed,
    );
    const existingUpiAmount = getCashfreePayableAmount(booking.payment);
    const requestedWallet = isWalletRequested(useWallet);
    const canReuseExistingOrder =
      booking.payment.amount === amount &&
      ((requestedWallet && existingWalletAmount > 0) ||
        (!requestedWallet && existingWalletAmount === 0) ||
        (requestedWallet &&
          existingWalletAmount === 0 &&
          split.walletAmountUsed === 0)) &&
      existingUpiAmount > 0;

    if (canReuseExistingOrder) {
      const reusableOrder = await tryReuseCreatedPaymentOrder(
        booking,
        amount,
      );

      if (reusableOrder) {
        return reusableOrder;
      }
    } else {
      await failCreatedPaymentAndReleaseWallet({
        bookingId: booking.id,
        cashfreeOrderId: booking.payment.cashfreeOrderId,
      });
    }

    split = await getWalletPaymentSplit(userId, amount, useWallet);
  }

  const { walletAmountUsed, upiAmountPaid } = split;

  if (walletAmountUsed >= amount && upiAmountPaid <= 0) {
    return completeWalletOnlyBookingPayment(
      userId,
      booking,
      amount,
      walletAmountUsed,
    );
  }

  if (!isCashfreeConfigured()) {
    throw new ApiError(
      500,
      "Cashfree payment gateway is not configured",
    );
  }

  const customerPhone = getCashfreeCustomerPhone(booking.user?.phone);

  if (!customerPhone) {
    throw new ApiError(
      400,
      "Please add a valid Indian mobile number before payment.",
    );
  }

  const cashfreeOrderId = `cf_${booking.bookingCode}_${Date.now()}`;
  const frontendUrl = getPaymentReturnBaseUrl();

  let cashfreeOrder;

  try {
    const cashfreeRes = await axios.post(
      `${getCashfreeBaseUrl()}/orders`,
      {
        order_id: cashfreeOrderId,
        order_amount: upiAmountPaid,
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
          notify_url: getCashfreeNotifyUrl(),
        },
        order_note: `Booking ${booking.bookingCode}`,
        order_tags: {
          bookingId: booking.id,
          userId,
          walletAmountUsed: String(walletAmountUsed),
          upiAmountPaid: String(upiAmountPaid),
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

  const payment = await prisma.$transaction(async (tx) => {
    /*
     * For partial wallet + Cashfree payments, do not debit the wallet while
     * the Cashfree order is only CREATED. The wallet is applied atomically
     * only after Cashfree confirms PAID. This prevents balance from being
     * lost when the browser refreshes/closes before /payments/verify runs.
     */
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        walletAmountUsed,
        payableAmount: upiAmountPaid,
      },
    });

    return tx.payment.upsert({
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
        walletAmountUsed,
        upiAmountPaid,
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
        walletAmountUsed,
        upiAmountPaid,
      },
    });
  });

  return {
    payment,
    walletAmountUsed,
    upiAmountPaid,
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

  if (
    booking.status !== "PENDING_PAYMENT" &&
    booking.payment.status !== "PAID"
  ) {
    throw new ApiError(400, "Booking is no longer payable");
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

  const cashfreeOrder = await fetchCashfreeOrder(
    cashfreeOrderId,
    "Unable to verify Cashfree payment",
  );

  return completePaidBookingPayment(booking, cashfreeOrder);
};

const cancelPaymentOrder = async (userId, { bookingId }) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: {
      payment: true,
    },
  });

  ensurePendingPaymentBooking(booking);

  let payment = null;

  if (booking.payment?.status === "CREATED") {
    const releaseResult = await failCreatedPaymentAndReleaseWallet({
      bookingId,
      cashfreeOrderId: booking.payment.cashfreeOrderId,
    });

    payment = releaseResult?.payment
      ? { ...releaseResult.payment, status: "FAILED" }
      : null;
  }

  const payableBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });

  await invalidatePaymentBookingCaches(userId);

  return {
    booking: payableBooking,
    payment,
    message:
      "Payment attempt was cancelled. The booking is still pending payment and can be retried.",
  };
};

const getCashfreeWebhookSecret = () =>
  process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY;

const verifyCashfreeWebhookSignature = (req) => {
  const required = !["0", "false", "no", "off"].includes(
    String(process.env.CASHFREE_WEBHOOK_SIGNATURE_REQUIRED || "true").toLowerCase(),
  );

  if (!required) return;

  const secret = getCashfreeWebhookSecret();
  const timestamp = req.get("x-webhook-timestamp");
  const signature = req.get("x-webhook-signature");
  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody.toString("utf8")
    : JSON.stringify(req.body || {});

  if (!secret) {
    throw new ApiError(500, "Cashfree webhook secret is not configured");
  }

  if (!timestamp || !signature) {
    throw new ApiError(400, "Missing Cashfree webhook signature headers");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new ApiError(401, "Invalid Cashfree webhook signature");
  }
};

const getCashfreeOrderIdFromWebhook = (payload = {}) => {
  const candidates = [
    payload.order_id,
    payload.cashfreeOrderId,
    payload.data?.order_id,
    payload.data?.order?.order_id,
    payload.data?.payment?.order_id,
    payload.order?.order_id,
    payload.payment?.order_id,
  ];

  return candidates
    .map((value) => String(value || "").trim())
    .find(Boolean);
};

const handleCashfreeWebhook = async (req) => {
  verifyCashfreeWebhookSignature(req);

  const cashfreeOrderId = getCashfreeOrderIdFromWebhook(req.body);

  if (!cashfreeOrderId) {
    throw new ApiError(400, "Cashfree order ID missing from webhook payload");
  }

  const payment = await prisma.payment.findUnique({
    where: { cashfreeOrderId },
    include: {
      booking: {
        include: {
          payment: true,
          services: true,
        },
      },
    },
  });

  if (payment?.booking) {
    const cashfreeOrder = await fetchCashfreeOrder(
      cashfreeOrderId,
      "Unable to verify Cashfree webhook payment",
    );

    return {
      kind: "BOOKING_PAYMENT",
      orderId: cashfreeOrderId,
      ...(await completePaidBookingPayment(payment.booking, cashfreeOrder)),
    };
  }

  const garageWalletService = require("../../garage/services/wallet.service");

  const garageWalletResult =
    await garageWalletService.verifyGarageWalletRechargeByCashfreeOrderId(
      cashfreeOrderId,
    );

  if (garageWalletResult) {
    return {
      kind: "GARAGE_WALLET_RECHARGE",
      orderId: cashfreeOrderId,
      ...garageWalletResult,
    };
  }

  return {
    kind: "UNKNOWN",
    orderId: cashfreeOrderId,
    processed: false,
    message: "No local payment record matched this Cashfree order.",
  };
};

const syncUserPendingCashfreePayments = async (userId) => {
  const pendingBookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "PENDING_PAYMENT",
      payment: {
        status: "CREATED",
        cashfreeOrderId: { not: null },
      },
    },
    include: {
      payment: true,
      services: true,
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  const results = await Promise.allSettled(
    pendingBookings.map(async (booking) => {
      const cashfreeOrder = await fetchCashfreeOrder(
        booking.payment.cashfreeOrderId,
        "Unable to sync pending Cashfree payment",
      );
      const orderStatus = getCashfreeOrderStatus(cashfreeOrder);

      if (orderStatus === "PAID") {
        return completePaidBookingPayment(booking, cashfreeOrder);
      }

      if (TERMINAL_CASHFREE_ORDER_STATUSES.has(orderStatus)) {
        return failCreatedPaymentAndReleaseWallet({
          bookingId: booking.id,
          cashfreeOrderId: booking.payment.cashfreeOrderId,
        });
      }

      return null;
    }),
  );

  results.forEach((result, index) => {
    if (result.status !== "rejected") return;

    const booking = pendingBookings[index];

    console.error(
      `[payment-sync] unable to sync pending payment for ${booking.id}:`,
      result.reason?.message || result.reason,
    );
    void systemIssueReporter.captureBackgroundError(result.reason, {
      title: "Unable to sync pending Cashfree payment",
      component: "Payment service",
      metadata: {
        bookingId: booking.id,
        userId,
        cashfreeOrderId: booking.payment?.cashfreeOrderId,
      },
    });
  });
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
  cancelPaymentOrder,
  createPaymentOrder,
  getMyPayments,
  handleCashfreeWebhook,
  syncUserPendingCashfreePayments,
  verifyPayment,
};
