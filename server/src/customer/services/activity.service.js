const prisma = require("../../config/prisma");

const MAX_ACTIVITY_LIMIT = 50;
const DEFAULT_ACTIVITY_LIMIT = 20;

const normalizeLimit = (limit) => {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ACTIVITY_LIMIT;
  return Math.min(Math.floor(parsed), MAX_ACTIVITY_LIMIT);
};

const cleanText = (value, maxLength) =>
  String(value || "").trim().slice(0, maxLength);

const formatAmount = (amount) => {
  const value = Number(amount || 0);
  return `₹${Number.isFinite(value) ? Math.round(value) : 0}`;
};

const bookingLabel = (booking) =>
  booking.bookingCode ? `Booking ${booking.bookingCode}` : "Your booking";

const bookingPath = (booking) =>
  booking.status === "PENDING_PAYMENT"
    ? "/dashboard/pending-bookings"
    : booking.status === "PENDING_VERIFICATION"
      ? `/booking/verification/${booking.id}`
    : `/tracking?bookingId=${booking.id}`;

const makeDerivedActivity = ({
  eventKey,
  userId,
  type,
  title,
  detail,
  path,
  metadata,
  createdAt,
}) => ({
  id: `derived:${eventKey}`,
  eventKey,
  userId,
  type,
  title,
  detail,
  path,
  metadata,
  createdAt,
  derived: true,
});

const buildBookingActivities = (booking) => {
  const activities = [];
  const baseMetadata = {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
  };
  const path = bookingPath(booking);
  const label = bookingLabel(booking);

  activities.push(
    makeDerivedActivity({
      eventKey: `booking:${booking.id}:created`,
      userId: booking.userId,
      type: "BOOKING_CREATED",
      title: "Booking created",
      detail: `${label} was created for ${booking.vehicle?.brand || "your vehicle"} ${booking.vehicle?.model || ""}.`.trim(),
      path,
      metadata: baseMetadata,
      createdAt: booking.createdAt,
    }),
  );

  if (booking.payment) {
    const payment = booking.payment;
    const amount = formatAmount(payment.amount || booking.handlingFee);

    if (payment.status === "PAID") {
      activities.push(
        makeDerivedActivity({
          eventKey: `booking:${booking.id}:payment:paid`,
          userId: booking.userId,
          type: "PAYMENT_PAID",
          title: "Booking fee paid",
          detail: `${amount} was paid for ${label.toLowerCase()}. Garage matching started.`,
          path: "/dashboard/payments",
          metadata: {
            ...baseMetadata,
            paymentId: payment.id,
            amount: payment.amount,
            status: payment.status,
          },
          createdAt: payment.updatedAt,
        }),
      );
    } else if (payment.status === "FAILED") {
      activities.push(
        makeDerivedActivity({
          eventKey: `booking:${booking.id}:payment:failed`,
          userId: booking.userId,
          type: "PAYMENT_FAILED",
          title: "Booking payment failed",
          detail: `The ${amount} booking-fee payment did not complete. You can retry securely.`,
          path: "/dashboard/pending-bookings",
          metadata: {
            ...baseMetadata,
            paymentId: payment.id,
            amount: payment.amount,
            status: payment.status,
          },
          createdAt: payment.updatedAt,
        }),
      );
    } else if (payment.status === "REFUNDED") {
      activities.push(
        makeDerivedActivity({
          eventKey: `booking:${booking.id}:payment:refunded`,
          userId: booking.userId,
          type: "PAYMENT_REFUNDED",
          title: "Booking fee refunded",
          detail: `${amount} for ${label.toLowerCase()} was marked refunded.`,
          path: "/dashboard/payments",
          metadata: {
            ...baseMetadata,
            paymentId: payment.id,
            amount: payment.amount,
            status: payment.status,
          },
          createdAt: payment.updatedAt,
        }),
      );
    }
  }

  if (
    booking.acceptedAt ||
    (booking.garageId && ["GARAGE_ASSIGNED", "CONFIRMED"].includes(booking.status))
  ) {
    activities.push(
      makeDerivedActivity({
        eventKey: `booking:${booking.id}:garage-accepted`,
        userId: booking.userId,
        type: "GARAGE_ACCEPTED",
        title: "Garage accepted booking",
        detail: booking.garage?.name
          ? `${booking.garage.name} accepted ${label.toLowerCase()}.`
          : `${label} was accepted by a garage.`,
        path,
        metadata: {
          ...baseMetadata,
          garageId: booking.garageId,
          garageName: booking.garage?.name || null,
        },
        createdAt: booking.acceptedAt || booking.updatedAt,
      }),
    );
  }

  if (booking.handoverOtpVerifiedAt || booking.status === "IN_PROGRESS") {
    activities.push(
      makeDerivedActivity({
        eventKey: `booking:${booking.id}:handover-verified`,
        userId: booking.userId,
        type: "SERVICE_STARTED",
        title: "Vehicle handover verified",
        detail: `${label} moved to service in progress.`,
        path,
        metadata: baseMetadata,
        createdAt: booking.handoverOtpVerifiedAt || booking.updatedAt,
      }),
    );
  }

  if (booking.deliveredAt) {
    activities.push(
      makeDerivedActivity({
        eventKey: `booking:${booking.id}:delivered`,
        userId: booking.userId,
        type: "READY_FOR_DELIVERY",
        title: "Vehicle ready for acceptance",
        detail: `${label} was marked ready by the garage. Review the delivery photos and accept the vehicle.`,
        path,
        metadata: baseMetadata,
        createdAt: booking.deliveredAt,
      }),
    );
  }

  if (booking.customerAcceptedAt || booking.status === "COMPLETED") {
    activities.push(
      makeDerivedActivity({
        eventKey: `booking:${booking.id}:completed`,
        userId: booking.userId,
        type: "BOOKING_COMPLETED",
        title: "Service completed",
        detail: `${label} was completed after you accepted delivery.`,
        path: "/dashboard/history",
        metadata: baseMetadata,
        createdAt: booking.customerAcceptedAt || booking.updatedAt,
      }),
    );
  }

  if (booking.status === "CANCELLED") {
    activities.push(
      makeDerivedActivity({
        eventKey: `booking:${booking.id}:cancelled`,
        userId: booking.userId,
        type: "BOOKING_CANCELLED",
        title: "Booking cancelled",
        detail: `${label} was cancelled.`,
        path: "/dashboard/bookings",
        metadata: baseMetadata,
        createdAt: booking.updatedAt,
      }),
    );
  }

  if (booking.status === "EXPIRED") {
    activities.push(
      makeDerivedActivity({
        eventKey: `booking:${booking.id}:expired`,
        userId: booking.userId,
        type: "BOOKING_EXPIRED",
        title: "Garage search expired",
        detail: `${label} expired before a garage could be assigned.`,
        path: "/dashboard/bookings",
        metadata: baseMetadata,
        createdAt: booking.expiredAt || booking.updatedAt,
      }),
    );
  }

  return activities;
};

const WALLET_ACTIVITY_COPY = {
  BOOKING_PAYMENT: ["WALLET_PAYMENT", "Wallet used for booking fee"],
  BOOKING_REFUND: ["WALLET_REFUND", "Refund credited to wallet"],
  RECHARGE: ["WALLET_RECHARGE", "Wallet recharged"],
  REFUND: ["WALLET_REFUND", "Refund credited to wallet"],
  CASHBACK: ["WALLET_CASHBACK", "Cashback credited"],
  CREDIT: ["WALLET_CREDIT", "Wallet credited"],
  DEBIT: ["WALLET_DEBIT", "Wallet debited"],
  SOS_DEDUCTION: ["SOS_PAYMENT", "SOS charge paid"],
};

const buildWalletActivity = (transaction) => {
  const [successType, successTitle] = WALLET_ACTIVITY_COPY[transaction.type] || [
    "WALLET_ACTIVITY",
    "Wallet updated",
  ];
  const direction = [
    "BOOKING_REFUND",
    "RECHARGE",
    "REFUND",
    "CASHBACK",
    "CREDIT",
  ].includes(transaction.type)
    ? "credited"
    : "used";
  const status = String(transaction.status || "SUCCESS").toUpperCase();
  const type =
    status === "FAILED"
      ? "WALLET_FAILED"
      : status === "PENDING"
        ? "WALLET_PENDING"
        : successType;
  const title =
    status === "FAILED"
      ? "Wallet transaction failed"
      : status === "PENDING"
        ? "Wallet transaction pending"
        : successTitle;
  const fallbackDetail =
    status === "FAILED"
      ? `${formatAmount(transaction.amount)} did not complete.`
      : status === "PENDING"
        ? `${formatAmount(transaction.amount)} is still being processed.`
        : `${formatAmount(transaction.amount)} was ${direction} in your wallet.`;

  return makeDerivedActivity({
    eventKey: `wallet-transaction:${transaction.id}`,
    userId: transaction.userId,
    type,
    title,
    detail: transaction.description || fallbackDetail,
    path: "/dashboard/payments",
    metadata: {
      transactionId: transaction.id,
      bookingId: transaction.bookingId,
      amount: transaction.amount,
      transactionType: transaction.type,
      status,
    },
    createdAt: transaction.createdAt,
  });
};

const listActivities = async (userId, { limit } = {}) => {
  const safeLimit = normalizeLimit(limit);
  const sourceLimit = Math.max(safeLimit * 3, 30);

  const [savedActivities, bookings, walletTransactions] = await Promise.all([
    prisma.customerActivity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: sourceLimit,
    }),
    prisma.booking.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: sourceLimit,
      include: {
        payment: true,
        garage: { select: { id: true, name: true } },
        vehicle: { select: { brand: true, model: true } },
      },
    }),
    prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: sourceLimit,
    }),
  ]);

  const savedEventKeys = new Set(
    savedActivities.map((activity) => activity.eventKey).filter(Boolean),
  );
  const derivedActivities = [
    ...bookings.flatMap(buildBookingActivities),
    ...walletTransactions.map(buildWalletActivity),
  ].filter((activity) => !savedEventKeys.has(activity.eventKey));

  return [...savedActivities, ...derivedActivities]
    .filter((activity) => activity.createdAt)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, safeLimit);
};

const createActivity = async (
  userId,
  { type = "SYSTEM", title, detail = "", path = "", metadata = undefined },
  { client = prisma, eventKey = null } = {},
) => {
  const data = {
    userId,
    type: cleanText(type || "SYSTEM", 40) || "SYSTEM",
    title: cleanText(title, 120),
    detail: cleanText(detail, 300),
    path: cleanText(path, 160),
    metadata,
    eventKey: eventKey ? cleanText(eventKey, 190) : null,
  };

  if (!data.title) return null;

  if (data.eventKey) {
    return client.customerActivity.upsert({
      where: { eventKey: data.eventKey },
      update: {
        type: data.type,
        title: data.title,
        detail: data.detail,
        path: data.path,
        metadata: data.metadata,
      },
      create: data,
    });
  }

  return client.customerActivity.create({ data });
};

const createActivitySafely = async (...args) => {
  try {
    return await createActivity(...args);
  } catch (error) {
    console.error("[customer-activity] unable to record activity:", error.message);
    return null;
  }
};

module.exports = {
  createActivity,
  createActivitySafely,
  listActivities,
};
