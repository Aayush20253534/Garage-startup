const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/homepageBanner.service");

const listBanners = asyncHandler(async (req, res) => {
  const banners = await service.listBanners();
  return res.status(200).json(new ApiResponse(200, "Homepage banners fetched", banners));
});

const createBanner = asyncHandler(async (req, res) => {
  const banner = await service.createBanner(req.body, req.file);
  return res.status(201).json(new ApiResponse(201, "Homepage banner created", banner));
});

const updateBanner = asyncHandler(async (req, res) => {
  const banner = await service.updateBanner(req.params.bannerId, req.body);
  return res.status(200).json(new ApiResponse(200, "Homepage banner updated", banner));
});

const reorderBanners = asyncHandler(async (req, res) => {
  const banners = await service.reorderBanners(req.body.bannerIds);
  return res.status(200).json(new ApiResponse(200, "Homepage banners reordered", banners));
});

const deleteBanner = asyncHandler(async (req, res) => {
  await service.deleteBanner(req.params.bannerId);
  return res.status(200).json(new ApiResponse(200, "Homepage banner deleted"));
});

module.exports = { createBanner, deleteBanner, listBanners, reorderBanners, updateBanner };
