const crypto = require("crypto");
const systemIssueReporter = require("../services/systemIssueReporter.service");

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;

const getReferenceId = (req) =>
  req.requestId || crypto.randomUUID();

const errorMiddleware = (err, req, res, next) => {
  const isMulterError = err.name === "MulterError";
  const statusCode = err.statusCode || (isMulterError ? 400 : 500);
  const referenceId = getReferenceId(req);
  const isServerError = statusCode >= 500;
  const isSafeClientError = Boolean(err.isOperational || isMulterError);

  if (
    isServerError &&
    !String(req.originalUrl || "").includes("/system-issues/report")
  ) {
    void systemIssueReporter.captureRequestError(err, req, {
      statusCode,
      referenceId,
    });
  }

  if (!res.headersSent) {
    res.setHeader("X-Request-ID", referenceId);
  }

  const publicCode =
    !isServerError &&
    err.isOperational &&
    typeof err.code === "string" &&
    SAFE_ERROR_CODE.test(err.code)
      ? err.code
      : undefined;

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message:
      isServerError || !isSafeClientError
        ? `Request could not be completed. Please try again. Reference: ${referenceId}`
        : err.message || "Request could not be completed",
    code: publicCode,
    referenceId,
    stack:
      process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;
