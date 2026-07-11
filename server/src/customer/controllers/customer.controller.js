const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const customerService = require("../services/customer.service");
const authService = require("../services/auth.service");

const completeOnboarding = asyncHandler(async (req, res) => {
  const result = await customerService.completeOnboarding(req.user.id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "Onboarding completed successfully", result));
});
const getProfile = asyncHandler(async (req, res) => {
  const profile = await customerService.getProfile(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Profile fetched successfully", profile));
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await customerService.updateProfile(req.user.id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "Profile updated successfully", profile));
});
const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    req.user.id,
    req.user.accountType,
    req.body,
    req.authSessionId,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully", result));
});

const deleteAccount = asyncHandler(async (req, res) => {
  const result = await customerService.deleteAccount(req.user.id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "Account deleted successfully", result));
});
module.exports = {
  completeOnboarding,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
