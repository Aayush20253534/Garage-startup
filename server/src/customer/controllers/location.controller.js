const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const locationService = require("../services/location.service");
const geocodingService = require("../services/geocoding.service");

const geocodeLocation = asyncHandler(async (req, res) => {
  const result = await geocodingService.geocodeAddress(req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, "Address geocoded successfully", result));
});

const reverseGeocodeLocation = asyncHandler(async (req, res) => {
  const result = await geocodingService.reverseGeocodeCoordinates({
    latitude: req.query.latitude,
    longitude: req.query.longitude,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Coordinates reverse geocoded successfully",
        result,
      ),
    );
});

const createLocation = asyncHandler(async (req, res) => {
  const location = await locationService.createLocation(req.user.id, req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, "Location created successfully", location));
});

const getMyLocations = asyncHandler(async (req, res) => {
  const locations = await locationService.getMyLocations(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Locations fetched successfully", locations));
});

const getLocationById = asyncHandler(async (req, res) => {
  const location = await locationService.getLocationById(
    req.user.id,
    req.params.id,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Location fetched successfully", location));
});

const updateLocation = asyncHandler(async (req, res) => {
  const location = await locationService.updateLocation(
    req.user.id,
    req.params.id,
    req.body,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Location updated successfully", location));
});

const deleteLocation = asyncHandler(async (req, res) => {
  const result = await locationService.deleteLocation(
    req.user.id,
    req.params.id,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Location deleted successfully", result));
});

const setDefaultLocation = asyncHandler(async (req, res) => {
  const location = await locationService.setDefaultLocation(
    req.user.id,
    req.params.id,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Default location updated successfully", location));
});

module.exports = {
  geocodeLocation,
  reverseGeocodeLocation,
  createLocation,
  getMyLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
  setDefaultLocation,
};
