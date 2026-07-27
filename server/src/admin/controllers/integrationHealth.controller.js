const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const integrationHealthService = require("../services/integrationHealth.service");

const getIntegrationHealth = asyncHandler(async (req, res) => {
  const report = await integrationHealthService.getIntegrationHealth({
    force: req.query.force,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Integration health report fetched", report));
});

module.exports = {
  getIntegrationHealth,
};
