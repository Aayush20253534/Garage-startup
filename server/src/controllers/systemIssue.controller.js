const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const systemIssueReporter = require("../services/systemIssueReporter.service");

const reportSystemIssue = asyncHandler(async (req, res) => {
  const issue = await systemIssueReporter.captureFrontendReport(
    req,
    req.body,
  );

  if (!issue) {
    throw new ApiError(500, "System issue could not be recorded");
  }

  return res.status(202).json(
    new ApiResponse(202, "Issue report accepted", {
      issueId: issue.id,
    }),
  );
});

module.exports = {
  reportSystemIssue,
};