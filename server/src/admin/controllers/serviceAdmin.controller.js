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

const reorderCategoryServices = asyncHandler(async (req, res) => {
  const category = await service.reorderCategoryServices(
    req.params.categoryId,
    req.body.serviceIds,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, "Service order updated successfully", category));
});

const createService = asyncHandler(async (req, res) => {
  const created = await service.createService(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, "Service created successfully", created));
});

const updatePopularServices = asyncHandler(async (req, res) => {
  const services = await service.setPopularServices(req.body.serviceIds);
  return res
    .status(200)
    .json(new ApiResponse(200, "Popular services updated successfully", services));
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

const uploadCategoryThumbnail = asyncHandler(async (req, res) => {
  const category = await service.uploadCategoryThumbnail(
    req.params.categoryId,
    req.file
  );
  return res
    .status(201)
    .json(
      new ApiResponse(201, "Service category thumbnail uploaded successfully", category)
    );
});

module.exports = {
  createCategory,
  createService,
  deactivateCategory,
  deactivateService,
  listCategories,
  reorderCategoryServices,
  updateCategory,
  updatePopularServices,
  updateService,
  uploadCategoryThumbnail,
  uploadThumbnail,
};
