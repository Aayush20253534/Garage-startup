const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");
const { deleteFromCloudinary } = require("../../utils/cloudinaryUpload");
const { Resend } = require("resend");

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  isOnboarded: true,
  createdAt: true,
  customerProfile: true,
  locations: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  },
  _count: {
    select: {
      bookings: true,
      vehicles: true,
    },
  },
};

const listCustomers = async (query = {}) => {
  const where = {
    role: "CUSTOMER",
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
      ],
    }),
    ...(query.city && {
      OR: [
        {
          customerProfile: {
            is: { address: { contains: query.city, mode: "insensitive" } },
          },
        },
        {
          locations: {
            some: { address: { contains: query.city, mode: "insensitive" } },
          },
        },
      ],
    }),
    ...(query.isActive !== undefined && {
      isActive: query.isActive === "true",
    }),
  };

  return prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
};

const listBookings = async (query = {}) => {
  const where = {
    ...(query.status && { status: query.status }),
    ...(query.garageId && { garageId: query.garageId }),
    ...(query.userId && { userId: query.userId }),
    ...(query.search && {
      OR: [
        { bookingCode: { contains: query.search, mode: "insensitive" } },
        {
          user: {
            is: { name: { contains: query.search, mode: "insensitive" } },
          },
        },
        {
          user: {
            is: { email: { contains: query.search, mode: "insensitive" } },
          },
        },
        {
          garage: {
            is: { name: { contains: query.search, mode: "insensitive" } },
          },
        },
      ],
    }),
  };

  return prisma.booking.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      vehicle: true,
      garage: true,
      payment: true,
      services: { include: { service: { include: { category: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
};


const PAYMENT_RECORD_TYPES = {
  CUSTOMER_PLATFORM_FEE: "CUSTOMER_PLATFORM_FEE",
  CUSTOMER_WALLET_RECHARGE: "CUSTOMER_WALLET_RECHARGE",
  CUSTOMER_WALLET_PAYMENT: "CUSTOMER_WALLET_PAYMENT",
  CUSTOMER_SOS_CHARGE: "CUSTOMER_SOS_CHARGE",
  GARAGE_WALLET_RECHARGE: "GARAGE_WALLET_RECHARGE",
  GARAGE_PLATFORM_FEE: "GARAGE_PLATFORM_FEE",
};

const PAYMENT_STATUSES = ["CREATED", "PAID", "FAILED", "REFUNDED"];
const WALLET_STATUSES = ["PENDING", "SUCCESS", "FAILED"];
const SUCCESS_STATUSES = new Set(["PAID", "SUCCESS"]);

const toDateRangeFilter = ({ from, to } = {}) => {
  const createdAt = {};

  if (from) {
    const startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
    createdAt.gte = startDate;
  }

  if (to) {
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
    createdAt.lte = endDate;
  }

  return Object.keys(createdAt).length ? { createdAt } : {};
};

const containsSearch = (search) => ({
  contains: search,
  mode: "insensitive",
});

const getBookingServiceNames = (booking = {}) =>
  (booking.services || [])
    .map((item) => item.service?.name || item.service?.category?.name)
    .filter(Boolean);

const getCustomerPaymentMethod = (payment = {}) => {
  const walletAmount = Number(payment.walletAmountUsed || 0);
  const upiAmount = Number(payment.upiAmountPaid || payment.amount || 0);

  if (walletAmount > 0 && upiAmount > 0) return "Wallet + Cashfree";
  if (walletAmount > 0) return "Wallet";
  return "Cashfree";
};

const normalizePaymentRecord = (payment) => ({
  id: `payment:${payment.id}`,
  source: "Payment",
  sourceId: payment.id,
  type: PAYMENT_RECORD_TYPES.CUSTOMER_PLATFORM_FEE,
  title: "Customer booking platform fee",
  amount: payment.amount || 0,
  currency: payment.currency || "INR",
  status: payment.status,
  method: getCustomerPaymentMethod(payment),
  cashfreeOrderId: payment.cashfreeOrderId,
  cashfreePaymentId: payment.cashfreePaymentId,
  walletAmountUsed: payment.walletAmountUsed || 0,
  upiAmountPaid: payment.upiAmountPaid || 0,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
  customer: payment.booking?.user
    ? {
        id: payment.booking.user.id,
        name: payment.booking.user.name,
        email: payment.booking.user.email,
        phone: payment.booking.user.phone,
      }
    : null,
  garage: payment.booking?.garage
    ? {
        id: payment.booking.garage.id,
        name: payment.booking.garage.name,
        city: payment.booking.garage.city,
        email: payment.booking.garage.email,
        phone: payment.booking.garage.phone,
      }
    : null,
  booking: payment.booking
    ? {
        id: payment.booking.id,
        code: payment.booking.bookingCode,
        status: payment.booking.status,
        totalServiceAmount: payment.booking.totalServiceAmount,
        payableAmount: payment.booking.payableAmount,
        services: getBookingServiceNames(payment.booking),
        vehicle: payment.booking.vehicle
          ? {
              brand: payment.booking.vehicle.brand,
              model: payment.booking.vehicle.model,
              registrationNumber: payment.booking.vehicle.registrationNumber,
            }
          : null,
      }
    : null,
});

const normalizeCustomerWalletRecord = (transaction) => {
  const typeMap = {
    RECHARGE: PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE,
    BOOKING_PAYMENT: PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT,
    SOS_DEDUCTION: PAYMENT_RECORD_TYPES.CUSTOMER_SOS_CHARGE,
  };

  return {
    id: `customer-wallet:${transaction.id}`,
    source: "WalletTransaction",
    sourceId: transaction.id,
    type: typeMap[transaction.type] || PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT,
    title: transaction.description || transaction.type,
    amount: transaction.amount || 0,
    currency: "INR",
    status: transaction.status,
    method: transaction.cashfreeOrderId ? "Cashfree" : "Customer Wallet",
    cashfreeOrderId: transaction.cashfreeOrderId,
    cashfreePaymentId: transaction.cashfreePaymentId,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description,
    createdAt: transaction.createdAt,
    updatedAt: transaction.createdAt,
    customer: transaction.user
      ? {
          id: transaction.user.id,
          name: transaction.user.name,
          email: transaction.user.email,
          phone: transaction.user.phone,
        }
      : null,
    garage: null,
    booking: null,
  };
};

const normalizeGarageWalletRecord = (transaction) => {
  const isRecharge = transaction.type === "RECHARGE";

  return {
    id: `garage-wallet:${transaction.id}`,
    source: "GarageWalletTransaction",
    sourceId: transaction.id,
    type: isRecharge
      ? PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE
      : PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE,
    title: transaction.description || transaction.type,
    amount: transaction.amount || 0,
    currency: "INR",
    status: transaction.status,
    method: isRecharge ? "Cashfree" : "Garage Wallet",
    cashfreeOrderId: transaction.cashfreeOrderId,
    cashfreePaymentId: transaction.cashfreePaymentId,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description,
    createdAt: transaction.createdAt,
    updatedAt: transaction.createdAt,
    customer: null,
    garage: transaction.garage
      ? {
          id: transaction.garage.id,
          name: transaction.garage.name,
          city: transaction.garage.city,
          email: transaction.garage.email,
          phone: transaction.garage.phone,
          ownerName: transaction.garage.owner?.name,
          ownerEmail: transaction.garage.owner?.email,
          ownerPhone: transaction.garage.owner?.phone,
        }
      : null,
    booking: null,
  };
};

const buildPaymentSearchWhere = (search) => {
  if (!search) return {};

  const match = containsSearch(search);

  return {
    OR: [
      { cashfreeOrderId: match },
      { cashfreePaymentId: match },
      {
        booking: {
          is: {
            bookingCode: match,
          },
        },
      },
      {
        booking: {
          is: {
            user: {
              is: { name: match },
            },
          },
        },
      },
      {
        booking: {
          is: {
            user: {
              is: { email: match },
            },
          },
        },
      },
      {
        booking: {
          is: {
            user: {
              is: { phone: match },
            },
          },
        },
      },
      {
        booking: {
          is: {
            garage: {
              is: { name: match },
            },
          },
        },
      },
    ],
  };
};

const buildCustomerWalletSearchWhere = (search) => {
  if (!search) return {};

  const match = containsSearch(search);

  return {
    OR: [
      { cashfreeOrderId: match },
      { cashfreePaymentId: match },
      { description: match },
      { user: { is: { name: match } } },
      { user: { is: { email: match } } },
      { user: { is: { phone: match } } },
    ],
  };
};

const buildGarageWalletSearchWhere = (search) => {
  if (!search) return {};

  const match = containsSearch(search);

  return {
    OR: [
      { cashfreeOrderId: match },
      { cashfreePaymentId: match },
      { description: match },
      { garage: { is: { name: match } } },
      { garage: { is: { email: match } } },
      { garage: { is: { phone: match } } },
      { garage: { is: { owner: { is: { name: match } } } } },
      { garage: { is: { owner: { is: { email: match } } } } },
      { garage: { is: { owner: { is: { phone: match } } } } },
    ],
  };
};

const getCustomerWalletTypeFilter = (paymentType) => {
  if (paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE) {
    return { type: "RECHARGE" };
  }

  if (paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT) {
    return { type: "BOOKING_PAYMENT" };
  }

  if (paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_SOS_CHARGE) {
    return { type: "SOS_DEDUCTION" };
  }

  return { type: { in: ["RECHARGE", "BOOKING_PAYMENT", "SOS_DEDUCTION"] } };
};

const getGarageWalletTypeFilter = (paymentType) => {
  if (paymentType === PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE) {
    return { type: "RECHARGE" };
  }

  if (paymentType === PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE) {
    return { type: "GARAGE_ACCEPT_FEE" };
  }

  return { type: { in: ["RECHARGE", "GARAGE_ACCEPT_FEE"] } };
};

const shouldFetchPaymentRows = (paymentType) =>
  !paymentType || paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_PLATFORM_FEE;

const shouldFetchCustomerWalletRows = (paymentType) =>
  !paymentType ||
  [
    PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE,
    PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT,
    PAYMENT_RECORD_TYPES.CUSTOMER_SOS_CHARGE,
  ].includes(paymentType);

const shouldFetchGarageWalletRows = (paymentType) =>
  !paymentType ||
  [
    PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE,
    PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE,
  ].includes(paymentType);

const getPaymentSummary = (records = []) =>
  records.reduce(
    (summary, record) => {
      const amount = Number(record.amount || 0);
      const isSuccessful = SUCCESS_STATUSES.has(record.status);

      summary.totalRecords += 1;

      if (!isSuccessful) {
        return summary;
      }

      summary.successfulAmount += amount;

      if (record.type === PAYMENT_RECORD_TYPES.CUSTOMER_PLATFORM_FEE) {
        summary.customerPlatformFee += amount;
      } else if (record.type === PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE) {
        summary.garagePlatformFee += amount;
      } else if (
        record.type === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE ||
        record.type === PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE
      ) {
        summary.walletRecharges += amount;
      }

      return summary;
    },
    {
      totalRecords: 0,
      successfulAmount: 0,
      customerPlatformFee: 0,
      garagePlatformFee: 0,
      walletRecharges: 0,
    },
  );

const emptyPaymentSummary = () => ({
  totalRecords: 0,
  successfulAmount: 0,
  customerPlatformFee: 0,
  garagePlatformFee: 0,
  walletRecharges: 0,
});

const getAggregateSum = (result) => Number(result?._sum?.amount || 0);

const getFullPaymentSummary = async ({
  type,
  status,
  search,
  dateRangeFilter,
  canFetchPaymentStatus,
  canFetchWalletStatus,
}) => {
  const summary = emptyPaymentSummary();
  const paymentWhere = {
    ...dateRangeFilter,
    ...(status && PAYMENT_STATUSES.includes(status) ? { status } : {}),
    ...buildPaymentSearchWhere(search),
  };
  const customerWalletWhere = {
    ...dateRangeFilter,
    ...getCustomerWalletTypeFilter(type),
    ...(status && WALLET_STATUSES.includes(status) ? { status } : {}),
    ...buildCustomerWalletSearchWhere(search),
  };
  const garageWalletWhere = {
    ...dateRangeFilter,
    ...getGarageWalletTypeFilter(type),
    ...(status && WALLET_STATUSES.includes(status) ? { status } : {}),
    ...buildGarageWalletSearchWhere(search),
  };

  const countPromises = [];

  if (shouldFetchPaymentRows(type) && canFetchPaymentStatus) {
    countPromises.push(prisma.payment.count({ where: paymentWhere }));
  }

  if (shouldFetchCustomerWalletRows(type) && canFetchWalletStatus) {
    countPromises.push(prisma.walletTransaction.count({ where: customerWalletWhere }));
  }

  if (shouldFetchGarageWalletRows(type) && canFetchWalletStatus) {
    countPromises.push(prisma.garageWalletTransaction.count({ where: garageWalletWhere }));
  }

  const counts = await Promise.all(countPromises);
  summary.totalRecords = counts.reduce((sum, count) => sum + Number(count || 0), 0);

  const sumPromises = [];
  const addSumPromise = (key, promise) => {
    sumPromises.push(
      promise.then((result) => ({ key, amount: getAggregateSum(result) })),
    );
  };

  if (shouldFetchPaymentRows(type) && (!status || status === "PAID")) {
    addSumPromise(
      "customerPlatformFee",
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: "PAID" },
        _sum: { amount: true },
      }),
    );
  }

  if (shouldFetchCustomerWalletRows(type) && (!status || status === "SUCCESS")) {
    addSumPromise(
      "customerWalletSuccessful",
      prisma.walletTransaction.aggregate({
        where: { ...customerWalletWhere, status: "SUCCESS" },
        _sum: { amount: true },
      }),
    );

    if (
      !type ||
      type === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE
    ) {
      addSumPromise(
        "walletRecharges",
        prisma.walletTransaction.aggregate({
          where: {
            ...dateRangeFilter,
            type: "RECHARGE",
            status: "SUCCESS",
            ...buildCustomerWalletSearchWhere(search),
          },
          _sum: { amount: true },
        }),
      );
    }
  }

  if (shouldFetchGarageWalletRows(type) && (!status || status === "SUCCESS")) {
    addSumPromise(
      "garageWalletSuccessful",
      prisma.garageWalletTransaction.aggregate({
        where: { ...garageWalletWhere, status: "SUCCESS" },
        _sum: { amount: true },
      }),
    );

    if (!type || type === PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE) {
      addSumPromise(
        "garagePlatformFee",
        prisma.garageWalletTransaction.aggregate({
          where: {
            ...dateRangeFilter,
            type: "GARAGE_ACCEPT_FEE",
            status: "SUCCESS",
            ...buildGarageWalletSearchWhere(search),
          },
          _sum: { amount: true },
        }),
      );
    }

    if (!type || type === PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE) {
      addSumPromise(
        "walletRecharges",
        prisma.garageWalletTransaction.aggregate({
          where: {
            ...dateRangeFilter,
            type: "RECHARGE",
            status: "SUCCESS",
            ...buildGarageWalletSearchWhere(search),
          },
          _sum: { amount: true },
        }),
      );
    }
  }

  const sums = await Promise.all(sumPromises);

  sums.forEach(({ key, amount }) => {
    if (key === "customerPlatformFee") {
      summary.customerPlatformFee += amount;
      summary.successfulAmount += amount;
    } else if (key === "garagePlatformFee") {
      summary.garagePlatformFee += amount;
    } else if (key === "walletRecharges") {
      summary.walletRecharges += amount;
    } else {
      summary.successfulAmount += amount;
    }
  });

  return summary;
};

const listPayments = async (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit || 250), 1), 500);
  const type = String(query.type || "").trim();
  const status = String(query.status || "").trim();
  const search = String(query.search || "").trim();
  const dateRangeFilter = toDateRangeFilter(query);
  const take = limit;
  const canFetchPaymentStatus = !status || PAYMENT_STATUSES.includes(status);
  const canFetchWalletStatus = !status || WALLET_STATUSES.includes(status);

  const paymentPromise = shouldFetchPaymentRows(type) && canFetchPaymentStatus
    ? prisma.payment.findMany({
        where: {
          ...dateRangeFilter,
          ...(status && PAYMENT_STATUSES.includes(status)
            ? { status }
            : {}),
          ...buildPaymentSearchWhere(search),
        },
        include: {
          booking: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
              garage: true,
              vehicle: true,
              services: { include: { service: { include: { category: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      })
    : Promise.resolve([]);

  const customerWalletPromise =
    shouldFetchCustomerWalletRows(type) && canFetchWalletStatus
      ? prisma.walletTransaction.findMany({
        where: {
          ...dateRangeFilter,
          ...getCustomerWalletTypeFilter(type),
          ...(status && WALLET_STATUSES.includes(status)
            ? { status }
            : {}),
          ...buildCustomerWalletSearchWhere(search),
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
      })
    : Promise.resolve([]);

  const garageWalletPromise =
    shouldFetchGarageWalletRows(type) && canFetchWalletStatus
      ? prisma.garageWalletTransaction.findMany({
        where: {
          ...dateRangeFilter,
          ...getGarageWalletTypeFilter(type),
          ...(status && WALLET_STATUSES.includes(status)
            ? { status }
            : {}),
          ...buildGarageWalletSearchWhere(search),
        },
        include: {
          garage: {
            include: {
              owner: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      })
    : Promise.resolve([]);

  const [payments, customerWalletTransactions, garageWalletTransactions] =
    await Promise.all([
      paymentPromise,
      customerWalletPromise,
      garageWalletPromise,
    ]);

  const records = [
    ...payments.map(normalizePaymentRecord),
    ...customerWalletTransactions.map(normalizeCustomerWalletRecord),
    ...garageWalletTransactions.map(normalizeGarageWalletRecord),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  return {
    records,
    summary: await getFullPaymentSummary({
      type,
      status,
      search,
      dateRangeFilter,
      canFetchPaymentStatus,
      canFetchWalletStatus,
    }),
  };
};

const getDashboardStats = async () => {
  const [
    garages,
    activeGarages,
    pendingApplications,
    priceRanges,
    customers,
    bookings,
    totalServiceCost,
    customerPlatformFeeRevenue,
    garagePlatformFeeRevenue,
    openSystemIssues,
    criticalSystemIssues,
    recentApplications,
  ] = await Promise.all([
    prisma.garage.count(),
    prisma.garage.count({ where: { isActive: true } }),
    prisma.garageApplication.count({ where: { status: "PENDING" } }),
    prisma.cityServicePriceRange.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.booking.count(),
    prisma.booking.aggregate({
      where: {
        status: "COMPLETED",
        customerAcceptedAt: { not: null },
      },
      _sum: { totalServiceAmount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.garageWalletTransaction.aggregate({
      where: {
        type: "GARAGE_ACCEPT_FEE",
        status: "SUCCESS",
      },
      _sum: { amount: true },
    }),
    prisma.systemIssue.count({
      where: { status: { in: ["OPEN", "INVESTIGATING"] } },
    }),
    prisma.systemIssue.count({
      where: {
        severity: "CRITICAL",
        status: { in: ["OPEN", "INVESTIGATING"] },
      },
    }),
    prisma.garageApplication.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        garageName: true,
        ownerName: true,
        city: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    stats: {
      garages,
      activeGarages,
      pendingApplications,
      priceRanges,
      customers,
      bookings,
      totalServiceCost: totalServiceCost._sum.totalServiceAmount || 0,
      customerPlatformFeeRevenue: customerPlatformFeeRevenue._sum.amount || 0,
      garagePlatformFeeRevenue: garagePlatformFeeRevenue._sum.amount || 0,
      openSystemIssues,
      criticalSystemIssues,
    },
    recentApplications,
  };
};

const invalidateUsersNotificationCache = async (userIds = []) => {
  await Promise.all(
    userIds.map((userId) => deletePattern(`customer:${userId}:notifications*`)),
  );
};

const getCityUsers = async (city) => {
  return prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      isActive: true,
      OR: [
        {
          customerProfile: {
            is: { address: { contains: city, mode: "insensitive" } },
          },
        },
        {
          locations: {
            some: { address: { contains: city, mode: "insensitive" } },
          },
        },
      ],
    },
    select: { id: true },
  });
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const searchEmailUsers = async (query = {}) => {
  const search = String(query.search || "").trim();

  return prisma.user.findMany({
    where: {
      ...(query.role && { role: query.role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
};

const sendUserEmail = async ({ userId, subject, message }) => {
  if (!process.env.RESEND_API_KEY || !resend) {
    throw new ApiError(500, "Resend API key missing");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user || !user.email) {
    throw new ApiError(404, "User email not found");
  }

  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Rovauto <onboarding@resend.dev>",
    to: user.email,
    replyTo: process.env.CONTACT_INBOX || "rovauto.offical@gmail.com",
    subject: cleanSubject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>${escapeHtml(cleanSubject)}</h2>
        <p>Hi ${escapeHtml(user.name || "there")},</p>
        <p>${escapeHtml(cleanMessage).replace(/\n/g, "<br/>")}</p>
        <p style="margin-top: 24px;">Regards,<br/>Rovauto Team</p>
      </div>
    `,
  });

  if (result.error) {
    throw new ApiError(500, result.error.message || "Failed to send email");
  }

  return {
    sent: true,
    recipient: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

const sendNotification = async ({
  audience,
  userId,
  city,
  title,
  message,
  type = "SYSTEM",
  link = null,
}) => {
  if (!title || !message)
    throw new ApiError(400, "Title and message are required");

  if (audience === "ALL") {
    return prisma.notification.create({
      data: {
        userId: null,
        title,
        message,
        type,
        link,
        metadata: { audience: "ALL" },
      },
    });
  }

  if (audience === "USER") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "User not found");

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
        metadata: { audience: "USER" },
      },
    });
    await invalidateUsersNotificationCache([userId]);
    return notification;
  }

  if (audience === "CITY") {
    if (!city) throw new ApiError(400, "City is required");
    const users = await getCityUsers(city);
    if (users.length === 0) {
      return {
        sent: 0,
        city,
        message: "No active customers found for this city",
      };
    }

    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title,
        message,
        type,
        link,
        metadata: { audience: "CITY", city },
      })),
    });
    await invalidateUsersNotificationCache(users.map((user) => user.id));
    return { sent: users.length, city };
  }

  throw new ApiError(400, "Audience must be ALL, CITY, or USER");
};


const CLEAR_BOOKINGS_CONFIRMATION = "CLEAR ALL BOOKINGS";
const CLOUDINARY_DELETE_BATCH_SIZE = 10;

const deleteInspectionImagesFromCloudinary = async (publicIds = []) => {
  const uniquePublicIds = [...new Set(publicIds.filter(Boolean))];

  let deleted = 0;
  let failed = 0;

  for (
    let index = 0;
    index < uniquePublicIds.length;
    index += CLOUDINARY_DELETE_BATCH_SIZE
  ) {
    const batch = uniquePublicIds.slice(
      index,
      index + CLOUDINARY_DELETE_BATCH_SIZE,
    );

    const results = await Promise.allSettled(
      batch.map((publicId) =>
        deleteFromCloudinary(publicId, "image"),
      ),
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        deleted += 1;
      } else {
        failed += 1;
      }
    });
  }

  return {
    requested: uniquePublicIds.length,
    deleted,
    failed,
  };
};

const clearAllBookings = async ({
  confirmation,
  requestedById = null,
} = {}) => {
  if (confirmation !== CLEAR_BOOKINGS_CONFIRMATION) {
    throw new ApiError(
      400,
      `Type ${CLEAR_BOOKINGS_CONFIRMATION} to continue`,
    );
  }

  const [
    bookingCount,
    payments,
    bookingServices,
    broadcasts,
    inspectionImageRecords,
    reviews,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.bookingService.count(),
    prisma.garageBroadcastRequest.count(),
    prisma.bookingInspectionImage.findMany({
      select: {
        publicId: true,
      },
    }),
    prisma.review.count(),
  ]);

  if (bookingCount === 0) {
    return {
      deletedBookings: 0,
      complaintsDetached: 0,
      deletedRelatedRecords: {
        payments: 0,
        bookingServices: 0,
        broadcasts: 0,
        inspectionImages: 0,
        reviews: 0,
      },
      cloudinaryInspectionImages: {
        requested: 0,
        deleted: 0,
        failed: 0,
      },
    };
  }

  const deletionResult = await prisma.$transaction(
    async (tx) => {
      const detachedComplaints =
        await tx.complaint.updateMany({
          where: {
            bookingId: {
              not: null,
            },
          },
          data: {
            bookingId: null,
          },
        });

      const deletedBookings =
        await tx.booking.deleteMany();

      return {
        deletedBookings: deletedBookings.count,
        complaintsDetached: detachedComplaints.count,
      };
    },
    {
      timeout: 60000,
    },
  );

  await Promise.allSettled([
    deletePattern("customer:*"),
  ]);

  const cloudinaryInspectionImages =
    await deleteInspectionImagesFromCloudinary(
      inspectionImageRecords.map((image) => image.publicId),
    );

  console.info("[admin] All bookings cleared", {
    requestedById,
    ...deletionResult,
  });

  return {
    ...deletionResult,
    deletedRelatedRecords: {
      payments,
      bookingServices,
      broadcasts,
      inspectionImages: inspectionImageRecords.length,
      reviews,
    },
    cloudinaryInspectionImages,
  };
};

module.exports = {
  clearAllBookings,
  getDashboardStats,
  listPayments,
  listBookings,
  listCustomers,
  searchEmailUsers,
  sendUserEmail,
  sendNotification,
};
