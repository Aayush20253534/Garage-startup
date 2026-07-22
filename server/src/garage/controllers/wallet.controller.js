const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const walletService = require("../services/wallet.service");

const getWallet = asyncHandler(async (req, res) => {
  const result = await walletService.getGarageWalletForOwner(req.user);
  return res.status(200).json(new ApiResponse(200, "Garage wallet fetched successfully", result));
});

const getTransactions = asyncHandler(async (req, res) => {
  const result = await walletService.getGarageWalletTransactionsForOwner(req.user, req.query);
  return res.status(200).json(new ApiResponse(200, "Garage wallet transactions fetched successfully", result));
});

const createRechargeOrder = asyncHandler(async (req, res) => {
  const result = await walletService.createGarageWalletRechargeOrder(req.user, Number(req.body.amount));
  return res.status(201).json(new ApiResponse(201, "Garage wallet Cashfree order created", result));
});

const verifyRechargeOrder = asyncHandler(async (req, res) => {
  const result = await walletService.verifyGarageWalletRechargeOrder(req.user, req.body.cashfreeOrderId);
  return res.status(200).json(new ApiResponse(200, "Garage wallet recharge verified", result));
});

module.exports = {
  createRechargeOrder,
  getTransactions,
  getWallet,
  verifyRechargeOrder,
};
