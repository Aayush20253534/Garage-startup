const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/controller.service");

const requestedGarageId = (req = {}) =>
  req.params?.garageId || req.query?.garageId || req.body?.garageId || null;

const requestBody = (req = {}) => req.body || {};

const list = asyncHandler(async (req, res) => {
  const result = await service.listControllers(req.user, requestedGarageId(req));
  res.status(200).json(new ApiResponse(200, "Garage controllers fetched", result));
});

const activity = asyncHandler(async (req, res) => {
  const result = await service.getControllerActivity(req.user, requestedGarageId(req), req.params.controllerId);
  res.status(200).json(new ApiResponse(200, "Controller activity fetched", result));
});

const create = asyncHandler(async (req, res) => {
  const result = await service.createController(req.user, requestedGarageId(req), requestBody(req));
  res.status(201).json(new ApiResponse(201, "Garage controller created", result));
});

const update = asyncHandler(async (req, res) => {
  const result = await service.updateController(req.user, requestedGarageId(req), req.params.controllerId, requestBody(req));
  res.status(200).json(new ApiResponse(200, "Garage controller updated", result));
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await service.resetControllerPassword(req.user, requestedGarageId(req), req.params.controllerId, requestBody(req).password);
  res.status(200).json(new ApiResponse(200, "Controller password reset and sessions revoked", result));
});

const revokeSessions = asyncHandler(async (req, res) => {
  const result = await service.revokeControllerSessions(req.user, requestedGarageId(req), req.params.controllerId);
  res.status(200).json(new ApiResponse(200, "Controller sessions revoked", result));
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteController(req.user, requestedGarageId(req), req.params.controllerId);
  res.status(200).json(new ApiResponse(200, "Garage controller deleted", result));
});

const setLimit = asyncHandler(async (req, res) => {
  const result = await service.setControllerLimit(req.user, req.params.garageId, requestBody(req).limit);
  res.status(200).json(new ApiResponse(200, "Controller limit updated", result));
});

const dashboard = asyncHandler(async (req, res) => {
  const result = await service.getControllerDashboard(req.user.id);
  res.status(200).json(new ApiResponse(200, "Controller dashboard fetched", result));
});

const availability = asyncHandler(async (req, res) => {
  const result = await service.setOwnAvailability(req.user.id, requestBody(req).availability);
  res.status(200).json(new ApiResponse(200, "Availability updated", result));
});

const transfer = asyncHandler(async (req, res) => {
  const result = await service.transferBooking(req.user, requestedGarageId(req), req.params.bookingId, requestBody(req).controllerId);
  res.status(200).json(new ApiResponse(200, "Booking transferred", result));
});

module.exports = { activity, availability, create, dashboard, list, remove, resetPassword, revokeSessions, setLimit, transfer, update };
