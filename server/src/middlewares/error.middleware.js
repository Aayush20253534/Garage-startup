const systemIssueReporter = require("../services/systemIssueReporter.service");

const errorMiddleware = (err, req, res, next) => {
  const isMulterError = err.name === "MulterError";
  const statusCode = err.statusCode || (isMulterError ? 400 : 500);

  if (
    statusCode >= 500 &&
    !String(req.originalUrl || "").includes("/system-issues/report")
  ) {
    void systemIssueReporter.captureRequestError(err, req, { statusCode });
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message: err.message || "Internal server error",
    code: err.code,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;
