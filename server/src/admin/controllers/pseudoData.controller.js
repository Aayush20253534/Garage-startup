const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const pseudoDataService = require("../services/pseudoData.service");

const getPseudoData = asyncHandler(async (req, res) => {
  const data = await pseudoDataService.getPseudoDataSettings();
  return res
    .status(200)
    .json(new ApiResponse(200, "Pseudo data settings fetched", data));
});

const updatePseudoData = asyncHandler(async (req, res) => {
  const data = await pseudoDataService.updatePseudoDataSettings(
    req.body,
    req.user,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, "Pseudo data settings updated", data));
});

module.exports = {
  getPseudoData,
  updatePseudoData,
};
