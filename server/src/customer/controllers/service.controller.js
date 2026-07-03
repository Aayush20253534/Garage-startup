const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const serviceService = require("../services/service.service");

const getServiceCategories = asyncHandler(async (req, res) => {
  const categories = await serviceService.getServiceCategories({
    userId: req.user?.role === "CUSTOMER" ? req.user.id : null,
    vehicleId: req.query.vehicleId,
    city: req.query.city,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Service categories fetched successfully", categories));
});

const getServices = asyncHandler(async (req, res) => {
  const services = await serviceService.getServices(req.query, {
    userId: req.user?.role === "CUSTOMER" ? req.user.id : null,
    vehicleId: req.query.vehicleId,
    city: req.query.city,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Services fetched successfully", services));
});

const getServiceById = asyncHandler(async (req, res) => {
  const service = await serviceService.getServiceById(req.params.id, {
    userId: req.user?.role === "CUSTOMER" ? req.user.id : null,
    vehicleId: req.query.vehicleId,
    city: req.query.city,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Service fetched successfully", service));
});

module.exports = {
  getServiceCategories,
  getServices,
  getServiceById,
};
