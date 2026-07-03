const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/garageAdmin.service");

const listGarages = asyncHandler(async (req, res) => {
  const garages = await service.listGarages(req.query);
  return res.status(200).json(new ApiResponse(200, "Admin garages fetched successfully", garages));
});

const getGarage = asyncHandler(async (req, res) => {
  const garage = await service.getGarage(req.params.garageId);
  return res.status(200).json(new ApiResponse(200, "Admin garage fetched successfully", garage));
});

const listAssignableServices = asyncHandler(async (req, res) => {
  const services = await service.listAssignableServices(req.query);
  return res.status(200).json(new ApiResponse(200, "Assignable services fetched successfully", services));
});

const upsertGarageService = asyncHandler(async (req, res) => {
  const garageService = await service.upsertGarageService(req.params.garageId, req.body);
  return res.status(200).json(new ApiResponse(200, "Garage service saved successfully", garageService));
});

const removeGarageService = asyncHandler(async (req, res) => {
  const garageService = await service.removeGarageService(req.params.garageId, req.params.serviceId);
  return res.status(200).json(new ApiResponse(200, "Garage service removed successfully", garageService));
});

const deleteGarages = asyncHandler(async (req, res) => {
  const result = await service.deleteGarages(req.body.garageIds);
  return res.status(200).json(new ApiResponse(200, "Garage data deleted successfully", result));
});

module.exports = {
  deleteGarages,
  getGarage,
  listAssignableServices,
  listGarages,
  removeGarageService,
  upsertGarageService,
};
