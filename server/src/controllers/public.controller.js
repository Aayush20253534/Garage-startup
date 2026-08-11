const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const publicService = require("../services/public.service");
const homepageBannerService = require("../admin/services/homepageBanner.service");

const getStats = asyncHandler(async (req, res) => {
  const stats = await publicService.getStats();
  return res.status(200).json(new ApiResponse(200, "Public stats fetched successfully", stats));
});

const getHomepageBanners = asyncHandler(async (req, res) => {
  const banners = await homepageBannerService.listActiveBanners();
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  return res.status(200).json(new ApiResponse(200, "Homepage banners fetched", banners));
});

module.exports = {
  getHomepageBanners,
  getStats,
};
