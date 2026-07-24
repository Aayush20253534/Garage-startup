const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/subAdminAccount.service");

const listAccounts = asyncHandler(async (_req, res) => {
  const data = await service.listAccounts();
  return res.status(200).json(new ApiResponse(200, "Sub-admin accounts fetched successfully", data));
});
const createAccount = asyncHandler(async (req, res) => {
  const data = await service.createAccount(req.body, req.user);
  return res.status(201).json(new ApiResponse(201, "Sub-admin account created successfully", data));
});
const updateAccount = asyncHandler(async (req, res) => {
  const data = await service.updateAccount(req.params.accountId, req.body);
  return res.status(200).json(new ApiResponse(200, "Sub-admin account updated successfully", data));
});
const changePassword = asyncHandler(async (req, res) => {
  const data = await service.changePassword(req.params.accountId, req.body.password);
  return res.status(200).json(new ApiResponse(200, "Sub-admin password changed successfully", data));
});
module.exports = { listAccounts, createAccount, updateAccount, changePassword };
