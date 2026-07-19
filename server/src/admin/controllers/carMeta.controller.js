const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/carMeta.service");

const parseModels = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const listBrands = asyncHandler(async (req, res) => {
  const brands = await service.listBrands(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Car brands fetched successfully", brands));
});

const getBrand = asyncHandler(async (req, res) => {
  const brand = await service.getBrand(req.params.brandId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Car brand fetched successfully", brand));
});

const createBrand = asyncHandler(async (req, res) => {
  const brand = await service.createBrand(
    { ...req.body, models: parseModels(req.body.models) },
    req.file,
  );

  return res
    .status(201)
    .json(new ApiResponse(201, "Car brand created successfully", brand));
});

const updateBrand = asyncHandler(async (req, res) => {
  const brand = await service.updateBrand(req.params.brandId, req.body, req.file);
  return res
    .status(200)
    .json(new ApiResponse(200, "Car brand updated successfully", brand));
});

const deactivateBrand = asyncHandler(async (req, res) => {
  const brand = await service.deactivateBrand(req.params.brandId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Car brand deactivated successfully", brand));
});

const createModel = asyncHandler(async (req, res) => {
  const model = await service.createModel(req.params.brandId, req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, "Car model created successfully", model));
});

const updateModel = asyncHandler(async (req, res) => {
  const model = await service.updateModel(req.params.modelId, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Car model updated successfully", model));
});

const deleteModel = asyncHandler(async (req, res) => {
  const model = await service.deleteModel(req.params.modelId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Car model deleted successfully", model));
});

module.exports = {
  createBrand,
  createModel,
  deactivateBrand,
  deleteModel,
  getBrand,
  listBrands,
  updateBrand,
  updateModel,
};
