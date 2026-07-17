const prisma = require("../../config/prisma");
const { randomUUID } = require("crypto");
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
const {
  assertCashfreeOrderMatchesPayment,
  getCashfreePayableAmount,
} = require("../security/cashfreeVerification");
const {
  getCashfreeOrderStatus,
  isReconcilingCashfreeOrder,
  isReusableCashfreeOrder,
  isTerminalCashfreeOrder,
} = require("../security/cashfreeOrderStatus");
const {
  isSamePaymentSplit,
} = require("../security/cashfreePaymentSplit");
const { getCashfreeIdempotencyKey } = require("../security/cashfreeIdempotency");
const { buildOwnedResourceWhere } = require("../security/ownership");
const activityService = require("./activity.service");
const {
  getCashfreeOrderIdFromWebhook,
  verifyCashfreeWebhookSignature,
} = require("../security/cashfreeWebhook");
const {
  lockBookingFinance,
} = require("./bookingFinanceLock.service");
const {
  getBookingPaymentIdempotencyKey,
  getBookingRefundIdempotencyKey,
  getPaymentReference,
} = require("./bookingFinancialIdempotency");

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

const terminateCashfreeOrder = async (cashfreeOrderId) => {
  try {
    const cashfreeRes = await axios.patch(
      `${getCashfreeBaseUrl()}/orders/${cashfreeOrderId}`,
      { order_status: "TERMINATED" },
      { headers: getCashfreeHeaders() },
    );

    return cashfreeRes.data;
  } catch (error) {
    throw getCashfreeApiError(
      error,
      "Unable to close the previous Cashfree payment session",
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

const getWalletPaymentSplit = async (
  userId,
  totalAmount,
  useWallet,
  { tx = prisma } = {},
) => {
  const amount = toWholeRupee(totalAmount);

  if (!isWalletRequested(useWallet)) {
    return {
      walletAmountUsed: 0,
      upiAmountPaid: amount,
    };
  }

  const wallet = await tx.wallet.findUnique({
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

  const idempotencyKey = getBookingPaymentIdempotencyKey(
    booking.id,
    cashfreeOrderId || "wallet-only",
  );
  const existingDebit = await tx.walletTransaction.findUnique({
    where: { idempotencyKey },
  });

  if (existingDebit) return existingDebit;

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

  return tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId,
      bookingId: booking.id,
      idempotencyKey,
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

  const bookingId = booking?.id || payment?.bookingId;

  if (bookingId) {
    const idempotentDebit = await tx.walletTransaction.findUnique({
      where: {
        idempotencyKey: getBookingPaymentIdempotencyKey(
          bookingId,
          getPaymentReference(payment),
        ),
      },
    });

    if (idempotentDebit) return idempotentDebit;
  }

  // Legacy fallback for payments created before idempotency keys existed.
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

  const bookingId = booking?.id || payment?.bookingId;

  if (bookingId) {
    const idempotentRefund = await tx.walletTransaction.findUnique({
      where: {
        idempotencyKey: getBookingRefundIdempotencyKey(
          bookingId,
          getPaymentReference(payment),
        ),
      },
    });

    if (idempotentRefund) return idempotentRefund;
  }

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
      bookingId: booking?.id || payment.bookingId,
      idempotencyKey: getBookingRefundIdempotencyKey(
        booking?.id || payment.bookingId,
        getPaymentReference(payment),
      ),
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
  recordFailureActivity = true,
}) => {
  const result = await prisma.$transaction(async (tx) => {
    await lockBookingFinance(bookingId, { tx });

    const payment = await tx.payment.findFirst({
      where: {
        bookingId,
        status: "CREATED",
        ...(cashfreeOrderId ? { cashfreeOrderId } : {}),
      },
      include: { booking: true },
    });

    if (!payment) return null;

    const claim = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: "CREATED",
        ...(cashfreeOrderId ? { cashfreeOrderId } : {}),
      },
      data: { status: "FAILED" },
    });

    if (claim.count !== 1) return null;

    const booking = payment.booking;

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

  if (result?.booking?.userId && recordFailureActivity) {
    await activityService.createActivitySafely(
      result.booking.userId,
      {
        type: "PAYMENT_FAILED",
        title: "Booking payment failed",
        detail: `The booking-fee payment for ${result.booking.bookingCode || result.booking.id} did not complete. You can retry securely.`,
        path: "/dashboard/pending-bookings",
        metadata: {
          bookingId: result.booking.id,
          bookingCode: result.booking.bookingCode,
          paymentId: result.payment.id,
          cashfreeOrderId: result.payment.cashfreeOrderId,
          amount: result.payment.amount,
        },
      },
      { eventKey: `booking:${result.booking.id}:payment:failed` },
    );

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
    if (isTerminalCashfreeOrder(orderStatus)) {
      await failCreatedPaymentAndReleaseWallet({
        bookingId: booking.id,
        cashfreeOrderId: booking.payment.cashfreeOrderId,
      });
    }

    throw new ApiError(
      400,
      "Cashfree payment is not completed yet",
      "PAYMENT_INCOMPLETE",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockBookingFinance(booking.id, { tx });

    const currentBooking = await tx.booking.findUnique({
      where: { id: booking.id },
      include: {
        payment: true,
        services: true,
      },
    });

    if (!currentBooking?.payment) {
      throw new ApiError(404, "Payment order not found");
    }

    assertCashfreeOrderMatchesPayment(
      cashfreeOrder,
      currentBooking.payment,
    );

    if (
      currentBooking.payment.status === "PAID" ||
      currentBooking.payment.status === "REFUNDED"
    ) {
      return {
        payment: currentBooking.payment,
        booking: await tx.booking.findUnique({
          where: { id: booking.id },
          include: bookingInclude,
        }),
        completedNow: false,
      };
    }

    if (currentBooking.payment.status !== "CREATED") {
      throw new ApiError(409, "This payment attempt is no longer active");
    }

    if (currentBooking.status === "CANCELLED") {
      const existingWalletDebit = await findWalletPaymentDebitTx(tx, {
        payment: currentBooking.payment,
        booking: currentBooking,
        userId: currentBooking.userId,
      });
      const refundAmount =
        getCashfreePayableAmount(currentBooking.payment) +
        (existingWalletDebit
          ? toWholeRupee(currentBooking.payment.walletAmountUsed)
          : 0);

      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: currentBooking.payment.id,
          bookingId: currentBooking.id,
          cashfreeOrderId: currentBooking.payment.cashfreeOrderId,
          status: "CREATED",
        },
        data: {
          status: "REFUNDED",
          cashfreePaymentId: cashfreeOrder.cf_order_id
            ? String(cashfreeOrder.cf_order_id)
            : currentBooking.payment.cashfreePaymentId,
        },
      });

      if (paymentClaim.count !== 1) {
        throw new ApiError(409, "Late payment was handled by another request");
      }

      if (refundAmount > 0) {
        const idempotencyKey = getBookingRefundIdempotencyKey(
          currentBooking.id,
          getPaymentReference(currentBooking.payment),
        );
        const existingRefund = await tx.walletTransaction.findUnique({
          where: { idempotencyKey },
        });

        if (!existingRefund) {
          const wallet = await tx.wallet.upsert({
            where: { userId: currentBooking.userId },
            update: { balance: { increment: refundAmount } },
            create: {
              userId: currentBooking.userId,
              type: "CUSTOMER",
              balance: refundAmount,
            },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              userId: currentBooking.userId,
              bookingId: currentBooking.id,
              idempotencyKey,
              type: "BOOKING_REFUND",
              status: "SUCCESS",
              amount: refundAmount,
              balanceAfter: wallet.balance,
              cashfreeOrderId: currentBooking.payment.cashfreeOrderId,
              cashfreePaymentId: cashfreeOrder.cf_order_id
                ? String(cashfreeOrder.cf_order_id)
                : currentBooking.payment.cashfreePaymentId,
              description: `Late payment refund for cancelled booking ${
                currentBooking.bookingCode || currentBooking.id
              }`,
            },
          });
        }
      }

      return {
        payment: await tx.payment.findUnique({
          where: { bookingId: currentBooking.id },
        }),
        booking: await tx.booking.findUnique({
          where: { id: currentBooking.id },
          include: bookingInclude,
        }),
        completedNow: false,
        latePaymentRefunded: true,
      };
    }

    if (currentBooking.status !== "PENDING_PAYMENT") {
      throw new ApiError(409, "Booking is no longer awaiting payment");
    }

    try {
      await applyWalletPaymentIfNeededTx(tx, {
        payment: currentBooking.payment,
        booking: currentBooking,
        userId: currentBooking.userId,
      });
    } catch (error) {
      const walletBalanceChanged =
        error instanceof ApiError &&
        error.statusCode === 400 &&
        /wallet balance changed/i.test(error.message);

      if (!walletBalanceChanged) throw error;

      const refundAmount = getCashfreePayableAmount(
        currentBooking.payment,
      );
      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: currentBooking.payment.id,
          bookingId: currentBooking.id,
          cashfreeOrderId: currentBooking.payment.cashfreeOrderId,
          status: "CREATED",
        },
        data: {
          status: "REFUNDED",
          cashfreePaymentId: cashfreeOrder.cf_order_id
            ? String(cashfreeOrder.cf_order_id)
            : currentBooking.payment.cashfreePaymentId,
        },
      });

      if (paymentClaim.count !== 1) {
        throw new ApiError(409, "Payment was handled by another request");
      }

      if (refundAmount > 0) {
        const idempotencyKey = getBookingRefundIdempotencyKey(
          currentBooking.id,
          getPaymentReference(currentBooking.payment),
        );
        const existingRefund = await tx.walletTransaction.findUnique({
          where: { idempotencyKey },
        });

        if (!existingRefund) {
          const wallet = await tx.wallet.upsert({
            where: { userId: currentBooking.userId },
            update: { balance: { increment: refundAmount } },
            create: {
              userId: currentBooking.userId,
              type: "CUSTOMER",
              balance: refundAmount,
            },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              userId: currentBooking.userId,
              bookingId: currentBooking.id,
              idempotencyKey,
              type: "BOOKING_REFUND",
              status: "SUCCESS",
              amount: refundAmount,
              balanceAfter: wallet.balance,
              cashfreeOrderId: currentBooking.payment.cashfreeOrderId,
              cashfreePaymentId: cashfreeOrder.cf_order_id
                ? String(cashfreeOrder.cf_order_id)
                : currentBooking.payment.cashfreePaymentId,
              description: `Cashfree refund after wallet balance changed for booking ${
                currentBooking.bookingCode || currentBooking.id
              }`,
            },
          });
        }
      }

      await tx.booking.update({
        where: { id: currentBooking.id },
        data: {
          walletAmountUsed: 0,
          payableAmount: getBookingPaymentAmount(currentBooking),
        },
      });

      return {
        payment: await tx.payment.findUnique({
          where: { bookingId: currentBooking.id },
        }),
        booking: await tx.booking.findUnique({
          where: { id: currentBooking.id },
          include: bookingInclude,
        }),
        completedNow: false,
        walletChangedRefunded: true,
      };
    }

    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: currentBooking.payment.id,
        bookingId: currentBooking.id,
        cashfreeOrderId: currentBooking.payment.cashfreeOrderId,
        status: "CREATED",
      },
      data: {
        status: "PAID",
        cashfreePaymentId: cashfreeOrder.cf_order_id
          ? String(cashfreeOrder.cf_order_id)
          : currentBooking.payment.cashfreePaymentId,
      },
    });

    if (paymentUpdate.count !== 1) {
      throw new ApiError(409, "Payment was processed by another request");
    }

    await tx.booking.update({
      where: { id: currentBooking.id },
      data: {
        status: "SEARCHING_GARAGE",
        searchExpiresAt: null,
        expiredAt: null,
        garageSearchRound: 0,
        garageSearchCycle: 1,
        searchRadiusKm: null,
      },
    });

    return {
      payment: await tx.payment.findUnique({
        where: { bookingId: currentBooking.id },
      }),
      booking: await tx.booking.findUnique({
        where: { id: currentBooking.id },
        include: bookingInclude,
      }),
      completedNow: true,
    };
  });

  if (result.completedNow && result.booking) {
    await activityService.createActivitySafely(
      result.booking.userId,
      {
        type: "PAYMENT_PAID",
        title: "Booking fee paid",
        detail: `₹${result.payment.amount} was paid for booking ${result.booking.bookingCode || result.booking.id}. Garage matching started.`,
        path: "/dashboard/payments",
        metadata: {
          bookingId: result.booking.id,
          bookingCode: result.booking.bookingCode,
          paymentId: result.payment.id,
          amount: result.payment.amount,
        },
      },
      { eventKey: `booking:${result.booking.id}:payment:paid` },
    );
  }

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
    message: result.latePaymentRefunded
      ? "This booking was already cancelled. The late Cashfree payment was safely credited to your Rovauto wallet."
      : result.walletChangedRefunded
        ? "Your wallet balance changed during payment. The completed Cashfree amount was safely credited to your Rovauto wallet; retry the booking payment when ready."
        : result.completedNow
          ? "Payment verified. Searching verified garages in 5 km, 10 km, and 20 km rounds."
          : "Payment was already verified.",
  };
};

const PAYMENT_ORDER_PREPARATION_GRACE_MS = 30 * 1000;
const CASHFREE_PAYMENT_SESSION_POLL_DELAYS_MS = [0, 200, 450, 800, 1_200];
const CASHFREE_TERMINATION_POLL_DELAYS_MS = [350, 800, 1_400];

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const getCashfreePaymentSessionId = (cashfreeOrder) => {
  const paymentSessionId = String(
    cashfreeOrder?.payment_session_id || "",
  ).trim();

  return paymentSessionId || null;
};

const fetchCashfreeOrderUntilSessionReady = async ({
  cashfreeOrderId,
  initialOrder = null,
  fallbackMessage,
  tolerateFreshNotFound = false,
}) => {
  let cashfreeOrder = initialOrder;
  let lastError = null;

  if (getCashfreePaymentSessionId(cashfreeOrder)) {
    return cashfreeOrder;
  }

  for (const delay of CASHFREE_PAYMENT_SESSION_POLL_DELAYS_MS) {
    if (delay > 0) await wait(delay);

    try {
      cashfreeOrder = await fetchCashfreeOrder(
        cashfreeOrderId,
        fallbackMessage || "Unable to prepare the Cashfree payment session",
      );
      lastError = null;
    } catch (error) {
      lastError = error;

      if (
        tolerateFreshNotFound &&
        [404, 409, 429, 500, 502, 503, 504].includes(error.statusCode)
      ) {
        continue;
      }

      throw error;
    }

    const orderStatus = getCashfreeOrderStatus(cashfreeOrder);

    if (
      getCashfreePaymentSessionId(cashfreeOrder) ||
      orderStatus === "PAID" ||
      isTerminalCashfreeOrder(orderStatus)
    ) {
      return cashfreeOrder;
    }
  }

  if (!cashfreeOrder && lastError) throw lastError;

  return cashfreeOrder;
};

const getPaymentAgeMs = (payment) => {
  const timestamp = new Date(
    payment?.updatedAt || payment?.createdAt || 0,
  ).getTime();

  return Number.isFinite(timestamp) && timestamp > 0
    ? Math.max(Date.now() - timestamp, 0)
    : Number.POSITIVE_INFINITY;
};

const buildCashfreeOrderResult = (payment, cashfreeOrder = null) => ({
  payment,
  walletAmountUsed: toWholeRupee(payment.walletAmountUsed),
  upiAmountPaid: getCashfreePayableAmount(payment),
  cashfreeOrder: {
    id: payment.cashfreeOrderId,
    cfOrderId:
      cashfreeOrder?.cf_order_id || payment.cashfreePaymentId,
    amount:
      cashfreeOrder?.order_amount || getCashfreePayableAmount(payment),
    currency: cashfreeOrder?.order_currency || payment.currency,
    paymentSessionId:
      cashfreeOrder?.payment_session_id ||
      payment.cashfreePaymentSessionId,
  },
  mode: getCashfreeMode(),
});

const tryReuseCreatedPaymentOrder = async (booking, amount) => {
  const payment = booking.payment;

  if (
    payment?.status !== "CREATED" ||
    payment.amount !== amount ||
    !payment.cashfreeOrderId
  ) {
    return null;
  }

  const paymentIsFresh =
    getPaymentAgeMs(payment) < PAYMENT_ORDER_PREPARATION_GRACE_MS;

  // A freshly created local session can be opened immediately. Avoiding an
  // unnecessary Cashfree status request makes retries noticeably faster while
  // webhook and post-checkout verification remain the source of truth.
  if (
    payment.cashfreePaymentSessionId &&
    getPaymentAgeMs(payment) < 15 * 60 * 1000
  ) {
    return buildCashfreeOrderResult(payment);
  }

  let cashfreeOrder;

  try {
    cashfreeOrder = await fetchCashfreeOrderUntilSessionReady({
      cashfreeOrderId: payment.cashfreeOrderId,
      fallbackMessage: "Unable to check existing Cashfree order",
      tolerateFreshNotFound: paymentIsFresh,
    });
  } catch (error) {
    if (
      !payment.cashfreePaymentSessionId &&
      error.statusCode === 404
    ) {
      await failCreatedPaymentAndReleaseWallet({
        bookingId: booking.id,
        cashfreeOrderId: payment.cashfreeOrderId,
      });
      return null;
    }

    throw error;
  }

  if (!cashfreeOrder) {
    throw new ApiError(
      409,
      "Cashfree did not return a usable payment order. No money was deducted; please try again.",
      "PAYMENT_SESSION_UNAVAILABLE",
    );
  }

  const orderStatus = getCashfreeOrderStatus(cashfreeOrder);

  assertCashfreeOrderMatchesPayment(cashfreeOrder, payment);

  if (orderStatus === "PAID") {
    return completePaidBookingPayment(booking, cashfreeOrder);
  }

  if (isReusableCashfreeOrder(orderStatus)) {
    const refreshedPayment = await prisma.$transaction(async (tx) => {
      await lockBookingFinance(booking.id, { tx });

      await tx.payment.updateMany({
        where: {
          id: payment.id,
          bookingId: booking.id,
          cashfreeOrderId: payment.cashfreeOrderId,
          status: "CREATED",
        },
        data: {
          cashfreePaymentId: cashfreeOrder.cf_order_id
            ? String(cashfreeOrder.cf_order_id)
            : payment.cashfreePaymentId,
          cashfreePaymentSessionId:
            cashfreeOrder.payment_session_id ||
            payment.cashfreePaymentSessionId,
        },
      });

      return tx.payment.findUnique({
        where: { bookingId: booking.id },
      });
    });

    if (!refreshedPayment?.cashfreePaymentSessionId) {
      throw new ApiError(
        409,
        "Cashfree has not finished preparing this payment session. Please retry shortly.",
        "PAYMENT_ORDER_PREPARING",
      );
    }

    return buildCashfreeOrderResult(
      refreshedPayment,
      cashfreeOrder,
    );
  }

  if (isTerminalCashfreeOrder(orderStatus)) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId: booking.id,
      cashfreeOrderId: payment.cashfreeOrderId,
    });
    return null;
  }

  if (isReconcilingCashfreeOrder(orderStatus)) {
    throw new ApiError(
      409,
      "Cashfree is closing the previous payment session. Please retry shortly.",
      "PAYMENT_ORDER_RECONCILING",
    );
  }

  throw new ApiError(
    409,
    "Cashfree is reconciling the previous payment session. Please retry shortly.",
    "PAYMENT_ORDER_RECONCILING",
  );
};

const closeCashfreeOrderForPaymentSplitChange = async (reservation) => {
  const { booking, payment } = reservation;

  let cashfreeOrder = await fetchCashfreeOrder(
    payment.cashfreeOrderId,
    "Unable to check the previous Cashfree payment session",
  );

  assertCashfreeOrderMatchesPayment(cashfreeOrder, payment);

  let orderStatus = getCashfreeOrderStatus(cashfreeOrder);

  if (orderStatus === "PAID") {
    return completePaidBookingPayment(booking, cashfreeOrder);
  }

  if (isTerminalCashfreeOrder(orderStatus)) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId: booking.id,
      cashfreeOrderId: payment.cashfreeOrderId,
      recordFailureActivity: false,
    });

    return null;
  }

  if (isReusableCashfreeOrder(orderStatus)) {
    cashfreeOrder = await terminateCashfreeOrder(payment.cashfreeOrderId);
    assertCashfreeOrderMatchesPayment(cashfreeOrder, payment);
    orderStatus = getCashfreeOrderStatus(cashfreeOrder);
  }

  for (const delay of CASHFREE_TERMINATION_POLL_DELAYS_MS) {
    if (
      orderStatus === "PAID" ||
      isTerminalCashfreeOrder(orderStatus)
    ) {
      break;
    }

    if (!isReconcilingCashfreeOrder(orderStatus)) {
      break;
    }

    await wait(delay);
    cashfreeOrder = await fetchCashfreeOrder(
      payment.cashfreeOrderId,
      "Unable to confirm the previous Cashfree session was closed",
    );
    assertCashfreeOrderMatchesPayment(cashfreeOrder, payment);
    orderStatus = getCashfreeOrderStatus(cashfreeOrder);
  }

  if (orderStatus === "PAID") {
    return completePaidBookingPayment(booking, cashfreeOrder);
  }

  if (isTerminalCashfreeOrder(orderStatus)) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId: booking.id,
      cashfreeOrderId: payment.cashfreeOrderId,
      recordFailureActivity: false,
    });

    return null;
  }

  throw new ApiError(
    409,
    "Your wallet selection changed. Cashfree is closing the previous payment session; please tap Pay again in a few seconds.",
    "PAYMENT_ORDER_RECONCILING",
  );
};

const completeWalletOnlyBookingPayment = async (
  userId,
  booking,
  totalAmount,
  walletAmountUsed,
) => {
  const result = await prisma.$transaction(async (tx) => {
    await lockBookingFinance(booking.id, { tx });

    const currentBooking = await tx.booking.findFirst({
      where: buildOwnedResourceWhere({ id: booking.id, userId }),
      include: { payment: true },
    });

    if (!currentBooking) {
      throw new ApiError(404, "Booking not found");
    }

    if (currentBooking.payment?.status === "PAID") {
      return {
        payment: currentBooking.payment,
        booking: await tx.booking.findUnique({
          where: { id: booking.id },
          include: bookingInclude,
        }),
        completedNow: false,
      };
    }

    ensurePendingPaymentBooking(currentBooking);

    const split = await getWalletPaymentSplit(
      userId,
      totalAmount,
      true,
      { tx },
    );

    if (split.walletAmountUsed < totalAmount || split.upiAmountPaid > 0) {
      throw new ApiError(
        409,
        "Wallet balance changed. Please refresh and choose a payment method again.",
      );
    }

    await reserveWalletForBookingPaymentTx(tx, {
      userId,
      booking: currentBooking,
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

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "SEARCHING_GARAGE",
        walletAmountUsed,
        payableAmount: 0,
        searchExpiresAt: null,
        expiredAt: null,
        garageSearchRound: 0,
        garageSearchCycle: 1,
        searchRadiusKm: null,
      },
    });

    const updatedBooking = await tx.booking.findUnique({
      where: { id: booking.id },
      include: bookingInclude,
    });

    return { payment, booking: updatedBooking, completedNow: true };
  });

  if (result.completedNow && result.booking) {
    await activityService.createActivitySafely(
      userId,
      {
        type: "PAYMENT_PAID",
        title: "Booking fee paid",
        detail: `₹${result.payment.amount} was paid from your wallet for booking ${result.booking.bookingCode || result.booking.id}. Garage matching started.`,
        path: "/dashboard/payments",
        metadata: {
          bookingId: result.booking.id,
          bookingCode: result.booking.bookingCode,
          paymentId: result.payment.id,
          amount: result.payment.amount,
          walletAmountUsed,
        },
      },
      { eventKey: `booking:${result.booking.id}:payment:paid` },
    );
  }

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
    message: result.completedNow
      ? "Wallet payment completed. Searching verified garages in 5 km, 10 km, and 20 km rounds."
      : "Wallet payment was already completed.",
  };
};

const createCashfreeBookingOrderId = (booking) => {
  const bookingToken = String(booking.bookingCode || booking.id)
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 20);
  const randomToken = randomUUID().replace(/-/g, "").slice(0, 16);

  return `cf_${bookingToken}_${randomToken}`;
};

const reserveCashfreeOrderForBooking = async (
  userId,
  bookingId,
  useWallet,
) =>
  prisma.$transaction(async (tx) => {
    await lockBookingFinance(bookingId, { tx });

    const booking = await tx.booking.findFirst({
      where: buildOwnedResourceWhere({ id: bookingId, userId }),
      include: {
        payment: true,
        services: true,
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

    if (booking.payment?.status === "PAID") {
      return { kind: "PAID", booking, payment: booking.payment };
    }

    ensurePendingPaymentBooking(booking);

    const amount = getBookingPaymentAmount(booking);

    if (amount <= 0) {
      throw new ApiError(400, "No online payment required for this booking");
    }

    const split = await getWalletPaymentSplit(
      userId,
      amount,
      useWallet,
      { tx },
    );

    if (
      booking.payment?.status === "CREATED" &&
      booking.payment.cashfreeOrderId
    ) {
      if (!isSamePaymentSplit(booking.payment, split)) {
        return {
          kind: "SPLIT_CHANGED",
          booking,
          payment: booking.payment,
          amount,
          ...split,
        };
      }

      return {
        kind: "EXISTING",
        booking,
        payment: booking.payment,
        amount,
      };
    }

    if (
      split.walletAmountUsed >= amount &&
      split.upiAmountPaid <= 0
    ) {
      return {
        kind: "WALLET_ONLY",
        booking,
        amount,
        ...split,
      };
    }

    const cashfreeOrderId = createCashfreeBookingOrderId(booking);

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        walletAmountUsed: split.walletAmountUsed,
        payableAmount: split.upiAmountPaid,
      },
    });

    const payment = await tx.payment.upsert({
      where: { bookingId: booking.id },
      update: {
        amount,
        currency: "INR",
        status: "CREATED",
        cashfreeOrderId,
        cashfreePaymentId: null,
        cashfreePaymentSessionId: null,
        walletAmountUsed: split.walletAmountUsed,
        upiAmountPaid: split.upiAmountPaid,
      },
      create: {
        bookingId: booking.id,
        amount,
        currency: "INR",
        status: "CREATED",
        cashfreeOrderId,
        cashfreePaymentId: null,
        cashfreePaymentSessionId: null,
        walletAmountUsed: split.walletAmountUsed,
        upiAmountPaid: split.upiAmountPaid,
      },
    });

    return {
      kind: "CREATE",
      booking: { ...booking, payment },
      payment,
      amount,
      cashfreeOrderId,
      ...split,
    };
  });

const createPaymentOrder = async (
  userId,
  { bookingId, useWallet = false },
  retryCount = 0,
) => {
  assertServiceHoursOpen();

  const reservation = await reserveCashfreeOrderForBooking(
    userId,
    bookingId,
    useWallet,
  );

  if (reservation.kind === "PAID") {
    return {
      payment: reservation.payment,
      booking: await prisma.booking.findUnique({
        where: { id: bookingId },
        include: bookingInclude,
      }),
      cashfreeOrder: null,
      mode: getCashfreeMode(),
      message: "Payment was already completed.",
    };
  }

  if (reservation.kind === "WALLET_ONLY") {
    return completeWalletOnlyBookingPayment(
      userId,
      reservation.booking,
      reservation.amount,
      reservation.walletAmountUsed,
    );
  }

  if (reservation.kind === "SPLIT_CHANGED") {
    if (retryCount >= 2) {
      throw new ApiError(
        409,
        "The previous payment session is still closing. Please tap Pay again in a few seconds.",
        "PAYMENT_ORDER_RECONCILING",
      );
    }

    const completedPayment =
      await closeCashfreeOrderForPaymentSplitChange(reservation);

    if (completedPayment) return completedPayment;

    return createPaymentOrder(
      userId,
      { bookingId, useWallet },
      retryCount + 1,
    );
  }

  if (reservation.kind === "EXISTING") {
    const reusableOrder = await tryReuseCreatedPaymentOrder(
      reservation.booking,
      reservation.amount,
    );

    if (reusableOrder) return reusableOrder;

    if (retryCount >= 1) {
      throw new ApiError(
        409,
        "The previous payment attempt ended. Please press Pay again.",
      );
    }

    return createPaymentOrder(
      userId,
      { bookingId, useWallet },
      retryCount + 1,
    );
  }

  if (!isCashfreeConfigured()) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId,
      cashfreeOrderId: reservation.cashfreeOrderId,
    });
    throw new ApiError(500, "Cashfree payment gateway is not configured");
  }

  const customerPhone = getCashfreeCustomerPhone(
    reservation.booking.user?.phone,
  );

  if (!customerPhone) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId,
      cashfreeOrderId: reservation.cashfreeOrderId,
    });
    throw new ApiError(
      400,
      "Please add a valid Indian mobile number before payment.",
    );
  }

  let frontendUrl;

  try {
    frontendUrl = getPaymentReturnBaseUrl();
  } catch (error) {
    await failCreatedPaymentAndReleaseWallet({
      bookingId,
      cashfreeOrderId: reservation.cashfreeOrderId,
    });
    throw error;
  }

  let cashfreeOrder;

  try {
    const cashfreeRes = await axios.post(
      `${getCashfreeBaseUrl()}/orders`,
      {
        order_id: reservation.cashfreeOrderId,
        order_amount: reservation.upiAmountPaid,
        order_currency: "INR",
        customer_details: {
          customer_id: userId,
          customer_name:
            reservation.booking.user?.name || "Rovauto Customer",
          customer_email:
            reservation.booking.user?.email || undefined,
          customer_phone: customerPhone,
        },
        order_meta: {
          return_url: `${frontendUrl}/dashboard/payments?cashfree_order_id={order_id}`,
          notify_url: getCashfreeNotifyUrl(),
        },
        order_note: `Booking ${reservation.booking.bookingCode}`,
        order_tags: {
          bookingId: reservation.booking.id,
          userId,
          walletAmountUsed: String(reservation.walletAmountUsed),
          upiAmountPaid: String(reservation.upiAmountPaid),
        },
      },
      {
        headers: {
          ...getCashfreeHeaders(),
          "x-idempotency-key": getCashfreeIdempotencyKey(
            reservation.cashfreeOrderId,
          ),
          "x-request-id": randomUUID(),
        },
      },
    );

    cashfreeOrder = cashfreeRes.data;
  } catch (createError) {
    // A timeout can happen after Cashfree accepted the order. Since the order
    // ID was persisted before this HTTP request, recover it instead of
    // creating a second order and orphaning the first one.
    try {
      cashfreeOrder = await fetchCashfreeOrder(
        reservation.cashfreeOrderId,
        "Unable to recover the Cashfree payment order",
      );
    } catch (recoveryError) {
      const createStatus = createError.response?.status;
      const definitelyRejected =
        Number.isInteger(createStatus) &&
        createStatus >= 400 &&
        createStatus < 500 &&
        createStatus !== 409;

      if (definitelyRejected) {
        await failCreatedPaymentAndReleaseWallet({
          bookingId,
          cashfreeOrderId: reservation.cashfreeOrderId,
        });
        throw getCashfreeApiError(
          createError,
          "Unable to create Cashfree order",
        );
      }

      throw new ApiError(
        409,
        "Cashfree is still confirming the payment session. Please retry in a few seconds; a second order will not be created.",
        "PAYMENT_ORDER_RECONCILING",
      );
    }
  }

  cashfreeOrder = await fetchCashfreeOrderUntilSessionReady({
    cashfreeOrderId: reservation.cashfreeOrderId,
    initialOrder: cashfreeOrder,
    fallbackMessage: "Unable to finish preparing the Cashfree payment session",
    tolerateFreshNotFound: true,
  });

  if (!cashfreeOrder) {
    throw new ApiError(
      409,
      "Cashfree did not return a usable payment order. No money was deducted; please try again.",
      "PAYMENT_SESSION_UNAVAILABLE",
    );
  }

  assertCashfreeOrderMatchesPayment(
    cashfreeOrder,
    reservation.payment,
  );

  const payment = await prisma.$transaction(async (tx) => {
    await lockBookingFinance(bookingId, { tx });

    await tx.payment.updateMany({
      where: {
        id: reservation.payment.id,
        bookingId,
        cashfreeOrderId: reservation.cashfreeOrderId,
        status: "CREATED",
      },
      data: {
        cashfreePaymentId: cashfreeOrder.cf_order_id
          ? String(cashfreeOrder.cf_order_id)
          : null,
        cashfreePaymentSessionId:
          cashfreeOrder.payment_session_id || null,
      },
    });

    return tx.payment.findUnique({ where: { bookingId } });
  });

  if (!payment || payment.cashfreeOrderId !== reservation.cashfreeOrderId) {
    throw new ApiError(
      409,
      "This payment order is no longer active. Refresh the booking before paying.",
    );
  }

  if (!payment.cashfreePaymentSessionId) {
    throw new ApiError(
      409,
      "Cashfree has not finished preparing this payment session. Please retry shortly.",
      "PAYMENT_ORDER_PREPARING",
    );
  }

  await invalidatePaymentBookingCaches(userId);

  return buildCashfreeOrderResult(payment, cashfreeOrder);
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
    where: buildOwnedResourceWhere({ id: bookingId, userId }),
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
    booking.payment.status !== "PAID" &&
    !(
      booking.status === "CANCELLED" &&
      booking.payment.status === "CREATED"
    )
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
    where: buildOwnedResourceWhere({ id: bookingId, userId }),
    include: {
      payment: true,
      services: true,
    },
  });

  ensurePendingPaymentBooking(booking);

  let payment = booking.payment || null;
  let message =
    "The checkout window was closed. Your booking is still pending payment.";

  if (booking.payment?.status === "CREATED") {
    if (booking.payment.cashfreeOrderId) {
      const cashfreeOrder = await fetchCashfreeOrder(
        booking.payment.cashfreeOrderId,
        "Unable to check the Cashfree order before closing checkout",
      );
      const orderStatus = getCashfreeOrderStatus(cashfreeOrder);

      if (orderStatus === "PAID") {
        return completePaidBookingPayment(booking, cashfreeOrder);
      }

      if (isTerminalCashfreeOrder(orderStatus)) {
        const releaseResult = await failCreatedPaymentAndReleaseWallet({
          bookingId,
          cashfreeOrderId: booking.payment.cashfreeOrderId,
        });

        payment = releaseResult?.payment
          ? { ...releaseResult.payment, status: "FAILED" }
          : booking.payment;
        message =
          "The previous payment session ended. A fresh session will be created when you retry.";
      } else if (isReconcilingCashfreeOrder(orderStatus)) {
        message =
          "Cashfree is closing the previous session. Wait a few seconds before retrying payment.";
      } else {
        // Do not mark an ACTIVE Cashfree order as failed locally. The same
        // order is reused on retry, so a late payment/webhook can always be
        // reconciled and can never become an orphaned charge.
        message =
          "The checkout window was closed. The same secure payment session will be reused when you retry.";
      }
    } else {
      const releaseResult = await failCreatedPaymentAndReleaseWallet({
        bookingId,
      });
      payment = releaseResult?.payment
        ? { ...releaseResult.payment, status: "FAILED" }
        : booking.payment;
    }
  }

  const payableBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });

  await invalidatePaymentBookingCaches(userId);

  return {
    booking: payableBooking,
    payment,
    message,
  };
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

      if (isTerminalCashfreeOrder(orderStatus)) {
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
  assertCashfreeOrderMatchesPayment,
  cancelPaymentOrder,
  createPaymentOrder,
  getMyPayments,
  handleCashfreeWebhook,
  syncUserPendingCashfreePayments,
  verifyPayment,
};
