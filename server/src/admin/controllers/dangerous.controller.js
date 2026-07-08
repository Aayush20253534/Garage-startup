const fs = require("fs");

const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/dangerous.service");

const cleanupBackup = async (paths = []) => {
  await Promise.allSettled(
    paths.map((targetPath) =>
      fs.promises.rm(targetPath, { recursive: true, force: true }),
    ),
  );
};

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

const downloadDbBackup = asyncHandler(async (req, res, next) => {
  const { filePath, filename, cleanupPaths } = await service.createSqliteBackupFile({
    command: req.params.command,
    confirmation: req.body.confirmation,
  });

  res.status(200);
  res.setHeader("Content-Type", "application/vnd.sqlite3");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");

  return res.sendFile(filePath, async (error) => {
    await cleanupBackup(cleanupPaths);

    if (error) {
      if (!res.headersSent) return next(error);
      return res.destroy(error);
    }

    return undefined;
  });
});

module.exports = {
  downloadDbBackup,
  listDangerousCommands,
  runDangerousCommand,
};
