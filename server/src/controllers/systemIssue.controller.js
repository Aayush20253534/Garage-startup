const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const systemIssueReporter = require("../services/systemIssueReporter.service");

const reportSystemIssue = asyncHandler(async (req, res) => {
  await systemIssueReporter.captureFrontendReport(req, req.body);

  return res
    .status(202)
    .json(new ApiResponse(202, "Issue report accepted"));
});

module.exports = {
  reportSystemIssue,
};
