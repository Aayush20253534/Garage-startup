const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const garageWalletService = require("../services/garageWallet.service");
const prisma = require("../config/prisma");

const getGarageIdForOwner = async (userId) => {
  const garage = await prisma.garage.findFirst({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
    },
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found for this owner");
  }

  return garage.id;
};

const getGarageWallet = asyncHandler(async (req, res) => {
  const garageId = await getGarageIdForOwner(req.user.id);

  const wallet = await garageWalletService.getGarageWallet(garageId);

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage wallet fetched successfully", wallet));
});

const getGarageWalletTransactions = asyncHandler(async (req, res) => {
  const garageId = await getGarageIdForOwner(req.user.id);

  const result = await garageWalletService.getGarageWalletTransactions(
    garageId,
    req.query
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      "Garage wallet transactions fetched successfully",
      result
    )
  );
});

const rechargeGarageWallet = asyncHandler(async (req, res) => {
  throw new ApiError(
    501,
    "Garage wallet recharge requires verified payment processing and is temporarily disabled"
  );
});

module.exports = {
  getGarageWallet,
  getGarageWalletTransactions,
  rechargeGarageWallet,
};
