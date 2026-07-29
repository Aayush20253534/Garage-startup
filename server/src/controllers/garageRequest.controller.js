const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const garageRequestService = require("../services/garageRequest.service");
const prisma = require("../config/prisma");
const bookingLifecycleService = require("../services/bookingLifecycle.service");

const getGarageAccess = async (user) => {
  if (user.accountType === "GARAGE_CONTROLLER") {
    return { garageId: user.garageId, controllerId: user.id };
  }
  const garage = await prisma.garage.findFirst({
    where: {
      ownerId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found for this owner");
  }

  return { garageId: garage.id, controllerId: null };
};

const getGarageRequests = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);

  const requests = await garageRequestService.getGarageRequests(
    garageId,
    req.query,
    controllerId,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage requests fetched successfully", requests));
});

const getGarageRequestById = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);

  const request = await garageRequestService.getGarageRequestById(
    garageId,
    req.params.requestId,
    controllerId,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage request fetched successfully", request));
});

const acceptGarageRequest = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);

  const request = await garageRequestService.acceptGarageRequest(
    garageId,
    req.params.requestId,
    req.body.note,
    controllerId,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage request accepted successfully", request));
});


const verifyHandoverOtp = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);
  if (controllerId) {
    await garageRequestService.getGarageRequestById(
      garageId,
      req.params.requestId,
      controllerId,
    );
  }
  const result = await bookingLifecycleService.verifyBookingHandoverOtp({
    garageId,
    requestId: req.params.requestId,
    otp: req.body.otp,
    images: req.files?.images || [],
    video: req.files?.video?.[0] || null,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Handover OTP verified successfully", result));
});


const confirmSelfDropArrival = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);
  if (controllerId) {
    await garageRequestService.getGarageRequestById(
      garageId,
      req.params.requestId,
      controllerId,
    );
  }

  const result = await bookingLifecycleService.confirmSelfDropArrivalByGarage({
    garageId,
    requestId: req.params.requestId,
    images: req.files?.images || [],
    video: req.files?.video?.[0] || null,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Self drop-off arrival confirmed", result));
});

const markArrivedAtGarage = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);
  if (controllerId) {
    await garageRequestService.getGarageRequestById(
      garageId,
      req.params.requestId,
      controllerId,
    );
  }
  const result = await bookingLifecycleService.markBookingArrivedAtGarageByGarage({
    garageId,
    requestId: req.params.requestId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle arrival at garage confirmed", result));
});

const markServiceCompleted = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);
  if (controllerId) {
    await garageRequestService.getGarageRequestById(
      garageId,
      req.params.requestId,
      controllerId,
    );
  }
  const result = await bookingLifecycleService.markBookingServiceCompletedByGarage({
    garageId,
    requestId: req.params.requestId,
    images: req.files?.images || [],
    video: req.files?.video?.[0] || null,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Service completed and delivery started", result));
});

const markArrivedAtCustomer = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);
  if (controllerId) {
    await garageRequestService.getGarageRequestById(
      garageId,
      req.params.requestId,
      controllerId,
    );
  }
  const result = await bookingLifecycleService.markBookingArrivedAtCustomerByGarage({
    garageId,
    requestId: req.params.requestId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle arrival at customer confirmed", result));
});

const confirmFinalPayment = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);
  if (controllerId) {
    await garageRequestService.getGarageRequestById(
      garageId,
      req.params.requestId,
      controllerId,
    );
  }
  const booking = await bookingLifecycleService.confirmFinalPaymentByGarage({
    garageId,
    requestId: req.params.requestId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Payment confirmed and booking completed", booking));
});
const markDelivered = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);
  if (controllerId) {
    await garageRequestService.getGarageRequestById(
      garageId,
      req.params.requestId,
      controllerId,
    );
  }
  const result = await bookingLifecycleService.markBookingServiceCompletedByGarage({
    garageId,
    requestId: req.params.requestId,
    images: req.files?.images || [],
    video: req.files?.video?.[0] || null,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Service completed and delivery started", result));
});
const rejectGarageRequest = asyncHandler(async (req, res) => {
  const { garageId, controllerId } = await getGarageAccess(req.user);

  if (controllerId) {
    const request = await garageRequestService.declineControllerRequest(
      garageId,
      req.params.requestId,
      controllerId,
      req.body.note,
    );
    return res
      .status(200)
      .json(new ApiResponse(200, "Controller request declined", request));
  }

  const request = await garageRequestService.rejectGarageRequest(
    garageId,
    req.params.requestId,
    req.body.note
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Garage request rejected successfully", request));
});

module.exports = {
  getGarageRequests,
  getGarageRequestById,
  acceptGarageRequest,
  verifyHandoverOtp,
  confirmSelfDropArrival,
  markArrivedAtGarage,
  markServiceCompleted,
  markArrivedAtCustomer,
  confirmFinalPayment,
  markDelivered,
  rejectGarageRequest,
};
