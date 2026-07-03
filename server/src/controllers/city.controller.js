const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const cityService = require("../services/city.service");

const listPublicCities = asyncHandler(async (req, res) => {
  const cities = await cityService.listCities();
  return res.status(200).json(new ApiResponse(200, "Cities fetched successfully", cities));
});

const listAdminCities = asyncHandler(async (req, res) => {
  const cities = await cityService.listCities({ includeInactive: req.query.includeInactive === "true" });
  return res.status(200).json(new ApiResponse(200, "Admin cities fetched successfully", cities));
});

const createCity = asyncHandler(async (req, res) => {
  const city = await cityService.createCity(req.body);
  return res.status(201).json(new ApiResponse(201, "City created successfully", city));
});

const updateCity = asyncHandler(async (req, res) => {
  const city = await cityService.updateCity(req.params.cityId, req.body);
  return res.status(200).json(new ApiResponse(200, "City updated successfully", city));
});

module.exports = {
  createCity,
  listAdminCities,
  listPublicCities,
  updateCity,
};
