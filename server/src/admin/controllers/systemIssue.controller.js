const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/systemIssue.service");

const listIssues = asyncHandler(async (req, res) => {
  const result = await service.listIssues(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "System issues fetched successfully", result));
});

const getIssue = asyncHandler(async (req, res) => {
  const issue = await service.getIssue(req.params.issueId);
  return res
    .status(200)
    .json(new ApiResponse(200, "System issue fetched successfully", issue));
});

const getIssueStats = asyncHandler(async (req, res) => {
  const stats = await service.getIssueStats();
  return res
    .status(200)
    .json(new ApiResponse(200, "System issue stats fetched successfully", stats));
});

const updateIssueStatus = asyncHandler(async (req, res) => {
  const issue = await service.updateIssueStatus(
    req.params.issueId,
    req.body,
    req.user.id,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, "System issue updated successfully", issue));
});

const deleteIssue = asyncHandler(async (req, res) => {
  await service.deleteIssue(req.params.issueId);
  return res
    .status(200)
    .json(new ApiResponse(200, "System issue deleted successfully"));
});

const clearResolvedIssues = asyncHandler(async (req, res) => {
  const result = await service.clearResolvedIssues();
  return res
    .status(200)
    .json(new ApiResponse(200, "Resolved system issues cleared", result));
});

module.exports = {
  clearResolvedIssues,
  deleteIssue,
  getIssue,
  getIssueStats,
  listIssues,
  updateIssueStatus,
};
