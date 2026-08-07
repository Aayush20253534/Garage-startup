const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const vehicleService = require("../services/vehicle.service");

const createVehicle = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.createVehicle(req.user.id, req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, "Vehicle created successfully", vehicle));
});


const verifyVehicleRegistration = asyncHandler(async (req, res) => {
  const verification = await vehicleService.verifyVehicleRegistration(
    req.user.id,
    req.body,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Registration verification completed", verification));
});

const getMyVehicles = asyncHandler(async (req, res) => {
  const vehicles = await vehicleService.getMyVehicles(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicles fetched successfully", vehicles));
});

const getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.getVehicleById(
    req.user.id,
    req.params.id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle fetched successfully", vehicle));
});

const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.updateVehicle(
    req.user.id,
    req.params.id,
    req.body
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle updated successfully", vehicle));
});

const deleteVehicle = asyncHandler(async (req, res) => {
  const result = await vehicleService.deleteVehicle(req.user.id, req.params.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle deleted successfully", result));
});

const setDefaultVehicle = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.setDefaultVehicle(
    req.user.id,
    req.params.id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Default vehicle updated successfully", vehicle));
});

module.exports = {
  createVehicle,
  verifyVehicleRegistration,
  getMyVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  setDefaultVehicle,
};
