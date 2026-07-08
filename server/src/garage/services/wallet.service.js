const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const {
  GARAGE_MINIMUM_ACTIVATION_RECHARGE,
} = require("../constants");
const {
  assertCashfreeOrderMatches,
  createCashfreeOrder,
  fetchCashfreeOrder,
  getCashfreeMode,
} = require("./cashfree.service");
const { activateGarageIfEligible, getGarageForOwner } = require("./garageOwner.service");

const TERMINAL_CASHFREE_ORDER_STATUSES = new Set([
  "EXPIRED",
  "TERMINATED",
  "FAILED",
  "CANCELLED",
  "CANCELED",
]);

const getCashfreeOrderStatus = (cashfreeOrder) =>
  String(cashfreeOrder?.order_status || "").toUpperCase();

const getOrCreateGarageWallet = async (garageId) => {
  const garage = await prisma.garage.findUnique({ where: { id: garageId } });
  if (!garage) throw new ApiError(404, "Garage not found");

  let wallet = await prisma.garageWallet.findUnique({ where: { garageId } });
  if (!wallet) wallet = await prisma.garageWallet.create({ data: { garageId, balance: 0 } });
  return wallet;
};

const getGarageWalletForOwner = async (userId) => {
  const garage = await getGarageForOwner(userId, { include: { wallet: true, images: true } });
  const wallet = garage.wallet || (await getOrCreateGarageWallet(garage.id));

  return {
    garage: { id: garage.id, name: garage.name, isActive: garage.isActive, isVerified: garage.isVerified },
    wallet,
    activation: {
      minimumBalance: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      minimumActivationAmount: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      isEligible:
        garage.isActive ||
        (garage.isVerified &&
          wallet.balance >= GARAGE_MINIMUM_ACTIVATION_RECHARGE),
      hasActivationBalance:
        garage.isActive ||
        wallet.balance >= GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      photoCount: garage.images?.length || 0,
      isActive: garage.isActive,
    },
  };
};

const getGarageWalletTransactionsForOwner = async (userId, query = {}) => {
  const garage = await getGarageForOwner(userId);
  const wallet = await getOrCreateGarageWallet(garage.id);
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const skip = (page - 1) * limit;
  const where = { garageWalletId: wallet.id, ...(query.type && { type: query.type }) };

  const [transactions, total] = await Promise.all([
    prisma.garageWalletTransaction.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.garageWalletTransaction.count({ where }),
  ]);

  return { wallet, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, transactions };
};

const createGarageWalletRechargeOrder = async (user, amount) => {
  if (!Number.isInteger(amount) || amount < GARAGE_MINIMUM_ACTIVATION_RECHARGE) {
    throw new ApiError(400, `Garage wallet recharge must be at least Rs. ${GARAGE_MINIMUM_ACTIVATION_RECHARGE}`);
  }

  const garage = await getGarageForOwner(user.id);
  const wallet = await getOrCreateGarageWallet(garage.id);
  const cashfreeOrderId = `garage_${garage.id.slice(0, 8)}_${Date.now()}`;

  const cashfreeOrder = await createCashfreeOrder({
    orderId: cashfreeOrderId,
    amount,
    user,
    returnPath: "/garage/wallet",
    note: `Garage wallet recharge for ${garage.name}`,
    tags: { garageId: garage.id, userId: user.id, type: "GARAGE_WALLET_RECHARGE" },
  });

  const transaction = await prisma.garageWalletTransaction.create({
    data: {
      garageWalletId: wallet.id,
      garageId: garage.id,
      type: "RECHARGE",
      status: "PENDING",
      amount,
      balanceAfter: wallet.balance,
      cashfreeOrderId: cashfreeOrder.order_id,
      cashfreePaymentId: cashfreeOrder.cf_order_id ? String(cashfreeOrder.cf_order_id) : null,
      description: "Garage wallet recharge pending Cashfree verification",
    },
  });

  return {
    transaction,
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

const buildRechargeResult = ({
  wallet,
  transaction,
  garage,
  message,
}) => ({
  wallet,
  transaction,
  garage,
  activation: {
    minimumBalance: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
    minimumActivationAmount: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
    hasActivationBalance:
      garage.isActive ||
      wallet.balance >= GARAGE_MINIMUM_ACTIVATION_RECHARGE,
    photoCount: garage.images?.length || 0,
    isActive: garage.isActive,
  },
  message,
});

const completePaidGarageWalletRecharge = async (transaction, cashfreeOrder) => {
  assertCashfreeOrderMatches(cashfreeOrder, {
    cashfreeOrderId: transaction.cashfreeOrderId,
    amount: transaction.amount,
    currency: "INR",
  });

  const orderStatus = getCashfreeOrderStatus(cashfreeOrder);

  if (orderStatus !== "PAID") {
    if (TERMINAL_CASHFREE_ORDER_STATUSES.has(orderStatus)) {
      await prisma.garageWalletTransaction.updateMany({
        where: { id: transaction.id, status: "PENDING" },
        data: {
          status: "FAILED",
          description: "Garage wallet recharge failed Cashfree verification",
        },
      });
    }

    throw new ApiError(400, "Cashfree payment is not completed yet");
  }

  return prisma.$transaction(async (tx) => {
    const claim = await tx.garageWalletTransaction.updateMany({
      where: { id: transaction.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        cashfreePaymentId: cashfreeOrder.cf_order_id
          ? String(cashfreeOrder.cf_order_id)
          : transaction.cashfreePaymentId,
        description: "Garage wallet recharge verified by Cashfree",
      },
    });

    if (claim.count === 0) {
      const existingTransaction = await tx.garageWalletTransaction.findUnique({
        where: { id: transaction.id },
      });
      const currentWallet = await tx.garageWallet.findUnique({
        where: { id: transaction.garageWalletId },
      });
      const currentGarage = await tx.garage.findUnique({
        where: { id: transaction.garageId },
        include: { images: true },
      });

      return buildRechargeResult({
        wallet: currentWallet,
        transaction: existingTransaction,
        garage: currentGarage,
        message: "Garage wallet recharge already verified",
      });
    }

    const updatedWallet = await tx.garageWallet.update({
      where: { id: transaction.garageWalletId },
      data: { balance: { increment: transaction.amount } },
    });

    const updatedTransaction = await tx.garageWalletTransaction.update({
      where: { id: transaction.id },
      data: { balanceAfter: updatedWallet.balance },
    });

    const updatedGarage = await activateGarageIfEligible(tx, transaction.garageId);

    return buildRechargeResult({
      wallet: updatedWallet,
      transaction: updatedTransaction,
      garage: updatedGarage,
      message: updatedGarage.isActive
        ? "Garage wallet recharge verified. Garage is active."
        : "Garage wallet recharge verified. Garage activation is pending verification or minimum balance.",
    });
  });
};

const findRechargeTransactionByCashfreeOrderId = async (cashfreeOrderId, where = {}) =>
  prisma.garageWalletTransaction.findFirst({
    where: {
      cashfreeOrderId,
      type: "RECHARGE",
      ...where,
    },
    orderBy: { createdAt: "desc" },
  });

const verifyGarageWalletRechargeByCashfreeOrderId = async (cashfreeOrderId) => {
  const transaction = await findRechargeTransactionByCashfreeOrderId(
    cashfreeOrderId,
  );

  if (!transaction) return null;

  if (transaction.status === "SUCCESS") {
    const [wallet, garage] = await Promise.all([
      prisma.garageWallet.findUnique({
        where: { id: transaction.garageWalletId },
      }),
      prisma.garage.findUnique({
        where: { id: transaction.garageId },
        include: { images: true },
      }),
    ]);

    return buildRechargeResult({
      wallet,
      transaction,
      garage,
      message: "Garage wallet recharge already verified",
    });
  }

  const cashfreeOrder = await fetchCashfreeOrder(cashfreeOrderId);
  return completePaidGarageWalletRecharge(transaction, cashfreeOrder);
};

const verifyGarageWalletRechargeOrder = async (userId, cashfreeOrderId) => {
  const garage = await getGarageForOwner(userId);
  const wallet = await getOrCreateGarageWallet(garage.id);
  const transaction = await findRechargeTransactionByCashfreeOrderId(
    cashfreeOrderId,
    { garageWalletId: wallet.id, garageId: garage.id },
  );

  if (!transaction) throw new ApiError(404, "Garage wallet recharge order not found");

  if (transaction.status === "SUCCESS") {
    const currentWallet = await prisma.garageWallet.findUnique({
      where: { id: wallet.id },
    });
    const currentGarage = await prisma.garage.findUnique({
      where: { id: garage.id },
      include: { images: true },
    });

    return buildRechargeResult({
      wallet: currentWallet,
      transaction,
      garage: currentGarage,
      message: "Garage wallet recharge already verified",
    });
  }

  const cashfreeOrder = await fetchCashfreeOrder(cashfreeOrderId);
  return completePaidGarageWalletRecharge(transaction, cashfreeOrder);
};

module.exports = {
  createGarageWalletRechargeOrder,
  getGarageWalletForOwner,
  getGarageWalletTransactionsForOwner,
  getOrCreateGarageWallet,
  verifyGarageWalletRechargeByCashfreeOrderId,
  verifyGarageWalletRechargeOrder,
};
