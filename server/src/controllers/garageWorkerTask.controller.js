const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const garageWorkerTaskService = require("../services/garageWorkerTask.service");

const createTask = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.createTask({
    actor: req.user,
    bookingId: req.params.bookingId,
    input: req.body,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Worker task created and WhatsApp prepared", result));
});

const listTasks = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.listTasks({
    actor: req.user,
    bookingId: req.params.bookingId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Worker tasks fetched", result));
});

const resendTask = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.resendTask({
    actor: req.user,
    taskId: req.params.taskId,
    expiresInHours: req.body?.expiresInHours,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Worker task link regenerated", result));
});

const revokeTask = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.revokeTask({
    actor: req.user,
    taskId: req.params.taskId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Worker task revoked", result));
});

const getPublicTask = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.getPublicTask(req.params.token);
  return res
    .status(200)
    .json(new ApiResponse(200, "Worker task fetched", result));
});

const startTracking = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.startTracking({
    rawToken: req.params.token,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Live tracking started", result));
});

const addTrackingPoint = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.addTrackingPoint({
    rawToken: req.params.token,
    data: req.body,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, "Location updated", result));
});

const stopTracking = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.stopTracking({
    rawToken: req.params.token,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Live tracking stopped", result));
});

const completeHandoverJourney = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.completeHandoverJourney({
    rawToken: req.params.token,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Return journey completed", result));
});

const verifyHandover = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.verifyHandover({
    rawToken: req.params.token,
    otp: req.body?.otp,
    images: req.files?.images || [],
    video: req.files?.video?.[0] || null,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle handover completed", result));
});

const markArrivedAtCustomer = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.markArrivedAtCustomer({
    rawToken: req.params.token,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle arrival at customer confirmed", result));
});


const confirmFinalPayment = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.confirmFinalPayment({
    rawToken: req.params.token,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Payment confirmed and booking completed", result));
});

const markDelivered = asyncHandler(async (req, res) => {
  const result = await garageWorkerTaskService.markDelivered({
    rawToken: req.params.token,
    images: req.files?.images || [],
    video: req.files?.video?.[0] || null,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle delivery evidence submitted", result));
});

module.exports = {
  addTrackingPoint,
  completeHandoverJourney,
  confirmFinalPayment,
  createTask,
  getPublicTask,
  listTasks,
  markArrivedAtCustomer,
  markDelivered,
  resendTask,
  revokeTask,
  startTracking,
  stopTracking,
  verifyHandover,
};
