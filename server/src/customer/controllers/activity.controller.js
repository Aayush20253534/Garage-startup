const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/apiError");
const ApiResponse = require("../../utils/apiResponse");
const activityService = require("../services/activity.service");

const listActivities = asyncHandler(async (req, res) => {
  const activities = await activityService.listActivities(req.user.id, {
    limit: req.query.limit,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Activities fetched successfully", activities));
});

const createActivity = asyncHandler(async (req, res) => {
  if (!req.body?.title) {
    throw new ApiError(400, "Activity title is required");
  }

  const activity = await activityService.createActivity(req.user.id, req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, "Activity saved successfully", activity));
});

module.exports = {
  createActivity,
  listActivities,
};
