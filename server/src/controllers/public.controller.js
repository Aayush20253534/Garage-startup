const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const publicService = require("../services/public.service");
const independenceCampaignService = require("../admin/services/independenceCampaign.service");

const getStats = asyncHandler(async (req, res) => {
  const stats = await publicService.getStats();
  return res.status(200).json(new ApiResponse(200, "Public stats fetched successfully", stats));
});

const getIndependenceCampaign = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=30");
  return res.status(200).json(new ApiResponse(200, "Campaign status fetched", await independenceCampaignService.getPublicStatus()));
});

module.exports = {
  getIndependenceCampaign,
  getStats,
};
