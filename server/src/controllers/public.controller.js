const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const publicService = require("../services/public.service");

const getStats = asyncHandler(async (req, res) => {
  const stats = await publicService.getStats();
  return res.status(200).json(new ApiResponse(200, "Public stats fetched successfully", stats));
});

module.exports = {
  getStats,
};
