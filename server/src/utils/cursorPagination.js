const ApiError = require("./apiError");

const parsePageLimit = (value, defaultLimit = 50, maxLimit = 100) => {
  if (value === undefined || value === null || value === "") return defaultLimit;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxLimit) {
    throw new ApiError(400, `limit must be an integer between 1 and ${maxLimit}`);
  }
  return parsed;
};

const encodeCursor = (value) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const decodeCursor = (value, timestampField) => {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const timestamp = new Date(decoded[timestampField]);
    if (!decoded.id || Number.isNaN(timestamp.getTime())) throw new Error("invalid");
    return { id: String(decoded.id), [timestampField]: timestamp };
  } catch {
    throw new ApiError(400, "Invalid pagination cursor");
  }
};

module.exports = { decodeCursor, encodeCursor, parsePageLimit };
