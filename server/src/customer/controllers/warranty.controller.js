const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const warrantyService = require("../services/warranty.service");

const getMyWarranties = asyncHandler(async (req, res) => {
  const warranties = await warrantyService.getCustomerWarranties(req.user.id);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Customer warranties fetched successfully",
        warranties,
      ),
    );
});

module.exports = {
  getMyWarranties,
};
