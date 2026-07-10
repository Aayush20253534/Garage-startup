const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/internAccount.service");

const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await service.listAccounts();
  return res
    .status(200)
    .json(new ApiResponse(200, "Intern accounts fetched successfully", accounts));
});

const createAccount = asyncHandler(async (req, res) => {
  const account = await service.createAccount(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, "Intern account created successfully", account));
});

const updateAccount = asyncHandler(async (req, res) => {
  const account = await service.updateAccount(req.params.accountId, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Intern account updated successfully", account));
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await service.changePassword(
    req.params.accountId,
    req.body.password,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, "Intern password changed successfully", result));
});

module.exports = {
  changePassword,
  createAccount,
  listAccounts,
  updateAccount,
};
