const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/dangerous.service");

const listDangerousCommands = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Dangerous commands fetched successfully",
        service.listCommands(),
      ),
    );
});

const runDangerousCommand = asyncHandler(async (req, res) => {
  const result = await service.runCommand({
    command: req.params.command,
    confirmation: req.body.confirmation,
    payload: req.body.payload || {},
    requestedById: req.user.id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Dangerous command executed", result));
});

module.exports = {
  listDangerousCommands,
  runDangerousCommand,
};
