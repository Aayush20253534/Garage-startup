const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/serviceAdmin.service");

const listCategories = asyncHandler(async (req, res) => {
  const categories = await service.listCategories(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Service categories fetched successfully", categories));
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await service.createCategory(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, "Service category created successfully", category));
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await service.updateCategory(req.params.categoryId, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Service category updated successfully", category));
});

const deactivateCategory = asyncHandler(async (req, res) => {
  const category = await service.deactivateCategory(req.params.categoryId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Service category deactivated successfully", category));
});

const createService = asyncHandler(async (req, res) => {
  const created = await service.createService(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, "Service created successfully", created));
});

const updateService = asyncHandler(async (req, res) => {
  const updated = await service.updateService(req.params.serviceId, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Service updated successfully", updated));
});

const deactivateService = asyncHandler(async (req, res) => {
  const updated = await service.deactivateService(req.params.serviceId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Service deactivated successfully", updated));
});

const uploadThumbnail = asyncHandler(async (req, res) => {
  const media = await service.uploadThumbnail(req.params.serviceId, req.file);
  return res
    .status(201)
    .json(new ApiResponse(201, "Service thumbnail uploaded successfully", media));
});

module.exports = {
  createCategory,
  createService,
  deactivateCategory,
  deactivateService,
  listCategories,
  updateCategory,
  updateService,
  uploadThumbnail,
};
