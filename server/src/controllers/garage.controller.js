const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const garageService = require("../services/garage.service");
const garageOwnerService = require("../garage/services/garageOwner.service");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  accessTokenClearCookieOptions,
} = require("../config/authCookie");

const getGarages = asyncHandler(async (req, res) => {
  const garages = await garageService.getGarages(req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, "Garages fetched successfully", garages));
});

const getNearbyGarages = asyncHandler(async (req, res) => {
  const garages = await garageService.getNearbyGarages(req.user.id, req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, "Nearby garages fetched successfully", garages));
});

const getMyGarage = asyncHandler(async (req, res) => {
  const garage = await garageOwnerService.getGarageOwnerProfile(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage owner profile fetched successfully", garage));
});

const getMyGarageServices = asyncHandler(async (req, res) => {
  const services = await garageOwnerService.getGarageOwnerServices(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage owner services fetched successfully", services));
});

const updateMyGarage = asyncHandler(async (req, res) => {
  const garage = await garageOwnerService.updateGarageOwnerProfile(req.user.id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage profile updated successfully", garage));
});

const requestGarageAccountDeletionOtp = asyncHandler(async (req, res) => {
  const result = await garageOwnerService.requestGarageAccountDeletionOtp(
    req.user.id,
  );

  res.set("Cache-Control", "no-store");
  return res
    .status(200)
    .json(new ApiResponse(200, "Account deletion OTP sent", result));
});

const deleteMyGarageAccount = asyncHandler(async (req, res) => {
  const result = await garageOwnerService.deleteGarageOwnerAccount(
    req.user.id,
    req.body,
  );

  res.clearCookie(
    ACCESS_TOKEN_COOKIE_NAME,
    accessTokenClearCookieOptions,
  );
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage account deleted successfully", result));
});

const getGarageById = asyncHandler(async (req, res) => {
  const garage = await garageService.getGarageById(req.params.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage fetched successfully", garage));
});

const getGarageServices = asyncHandler(async (req, res) => {
  const services = await garageService.getGarageServices(req.params.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage services fetched successfully", services));
});

module.exports = {
  deleteMyGarageAccount,
  requestGarageAccountDeletionOtp,
  getGarages,
  getNearbyGarages,
  getMyGarage,
  getMyGarageServices,
  updateMyGarage,
  getGarageById,
  getGarageServices,
};
