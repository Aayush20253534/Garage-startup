const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/cityServicePriceRange.service");

const listPriceRanges = asyncHandler(async (req, res) => {
  const ranges = await service.listPriceRanges(req.query);
  return res.status(200).json(new ApiResponse(200, "Price ranges fetched successfully", ranges));
});

const getPriceRange = asyncHandler(async (req, res) => {
  const range = await service.getPriceRange(req.params.id);
  return res.status(200).json(new ApiResponse(200, "Price range fetched successfully", range));
});

const createPriceRange = asyncHandler(async (req, res) => {
  const range = await service.createPriceRange(req.body);
  return res.status(201).json(new ApiResponse(201, "Price range created successfully", range));
});

const updatePriceRange = asyncHandler(async (req, res) => {
  const range = await service.updatePriceRange(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, "Price range updated successfully", range));
});

const deletePriceRange = asyncHandler(async (req, res) => {
  const range = await service.deletePriceRange(req.params.id);
  return res.status(200).json(new ApiResponse(200, "Price range deleted successfully", range));
});

const deletePriceRanges = asyncHandler(async (req, res) => {
  const result = await service.deletePriceRanges(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Price ranges deleted successfully", result));
});

module.exports = {
  createPriceRange,
  deletePriceRange,
  deletePriceRanges,
  getPriceRange,
  listPriceRanges,
  updatePriceRange,
};
