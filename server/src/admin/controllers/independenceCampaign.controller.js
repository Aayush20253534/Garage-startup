const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/independenceCampaign.service");

const getSettings = asyncHandler(async (req, res) =>
  res.status(200).json(new ApiResponse(200, "Independence campaign fetched", await service.getSettings())),
);

const updateSettings = asyncHandler(async (req, res) =>
  res.status(200).json(new ApiResponse(200, "Independence campaign updated", await service.updateSettings(req.body, req.user))),
);

module.exports = { getSettings, updateSettings };
