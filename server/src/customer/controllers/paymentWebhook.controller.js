const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const paymentService = require("../services/payment.service");

const handleCashfreeWebhook = asyncHandler(async (req, res) => {
  const result = await paymentService.handleCashfreeWebhook(req);

  return res
    .status(200)
    .json(new ApiResponse(200, "Cashfree webhook processed", result));
});

module.exports = {
  handleCashfreeWebhook,
};
