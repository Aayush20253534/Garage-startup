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

const downloadSqlBackup = asyncHandler(async (req, res, next) => {
  const { child, filename } = service.createSqlBackupProcess({
    command: req.params.command,
    confirmation: req.body.confirmation,
  });

  let stderr = "";
  let started = false;

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.once("spawn", () => {
    started = true;

    res.status(200);
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

    child.stdout.pipe(res);
  });

  child.once("error", (error) => {
    if (!res.headersSent) {
      return next(error);
    }

    return res.destroy(error);
  });

  child.once("close", (code) => {
    if (code === 0) return;

    const message =
      stderr.trim() ||
      (started
        ? "pg_dump failed while creating the SQL backup"
        : "pg_dump could not be started. Install PostgreSQL client tools or set PG_DUMP_BIN.");

    const error = new Error(message);
    error.statusCode = 500;

    if (!res.headersSent) {
      return next(error);
    }

    return res.destroy(error);
  });
});

module.exports = {
  downloadSqlBackup,
  listDangerousCommands,
  runDangerousCommand,
};
