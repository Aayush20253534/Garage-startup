const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const paymentService = require("../services/payment.service");

const createPaymentOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.createPaymentOrder(req.user.id, req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, "Payment order created successfully", result));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyPayment(req.user.id, req.body);

  return res.status(200).json(
    new ApiResponse(
      200,
      "Payment verified and request sent to nearby garages",
      result
    )
  );
});

const cancelPaymentOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.cancelPaymentOrder(req.user.id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, "Payment cancelled successfully", result));
});

const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await paymentService.getMyPayments(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Payments fetched successfully", payments));
});
module.exports = {
  createPaymentOrder,
  verifyPayment,
  cancelPaymentOrder,
  getMyPayments,
};
