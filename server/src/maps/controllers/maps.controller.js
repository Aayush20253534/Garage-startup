const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const googleMapsService = require("../services/googleMaps.service");
const bookingTrackingService = require("../services/bookingTracking.service");
const routeOptimizationService = require("../services/routeOptimization.service");

const getConfig = asyncHandler(async (_req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Google Maps configuration fetched successfully",
        googleMapsService.getBrowserConfig(),
      ),
    );
});

const autocomplete = asyncHandler(async (req, res) => {
  const suggestions = await googleMapsService.autocompletePlaces(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Address suggestions fetched successfully", suggestions));
});

const validateAddress = asyncHandler(async (req, res) => {
  const result = await googleMapsService.validateAddress(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Address validated successfully", result));
});

const placeDetails = asyncHandler(async (req, res) => {
  const place = await googleMapsService.getPlaceDetails({
    placeId: req.params.placeId,
    sessionToken: req.query.sessionToken,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Place details fetched successfully", place));
});

const computeRoute = asyncHandler(async (req, res) => {
  const route = await googleMapsService.computeRoute(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Driving route calculated successfully", route));
});

const computeRouteMatrix = asyncHandler(async (req, res) => {
  const matrix = await googleMapsService.computeRouteMatrix(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Driving-time matrix calculated successfully", matrix));
});

const snapToRoads = asyncHandler(async (req, res) => {
  const points = await googleMapsService.snapToRoads(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Tracking points aligned to roads", points));
});

const getBookingTracking = asyncHandler(async (req, res) => {
  const tracking = await bookingTrackingService.getTracking({
    bookingId: req.params.bookingId,
    account: req.user,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Booking tracking fetched successfully", tracking));
});

const startBookingTracking = asyncHandler(async (req, res) => {
  const tracking = await bookingTrackingService.startTracking({
    bookingId: req.params.bookingId,
    account: req.user,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Live location sharing started", tracking));
});

const addBookingTrackingPoint = asyncHandler(async (req, res) => {
  const tracking = await bookingTrackingService.addTrackingPoint({
    bookingId: req.params.bookingId,
    account: req.user,
    data: req.body,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, "Live location updated", tracking));
});

const stopBookingTracking = asyncHandler(async (req, res) => {
  const tracking = await bookingTrackingService.stopTracking({
    bookingId: req.params.bookingId,
    account: req.user,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Live location sharing stopped", tracking));
});

const optimizeActiveRoutes = asyncHandler(async (req, res) => {
  const result = await routeOptimizationService.optimizeActiveBookings(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Garage routes optimized successfully", result));
});

module.exports = {
  addBookingTrackingPoint,
  autocomplete,
  computeRoute,
  computeRouteMatrix,
  getBookingTracking,
  getConfig,
  optimizeActiveRoutes,
  placeDetails,
  snapToRoads,
  startBookingTracking,
  stopBookingTracking,
  validateAddress,
};
