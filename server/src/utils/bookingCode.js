const crypto = require("crypto");

const MAX_BOOKING_CODE_ATTEMPTS = 5;

const generateBookingCode = () => {
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `ROV-${time}-${random}`;
};

const isBookingCodeConflictError = (error) => {
  if (error?.code !== "P2002") return false;

  const target = error?.meta?.target;
  if (Array.isArray(target)) return target.includes("bookingCode");
  return String(target || "").includes("bookingCode");
};

const withUniqueBookingCode = async (
  createBooking,
  maxAttempts = MAX_BOOKING_CODE_ATTEMPTS,
) => {
  let lastConflict = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await createBooking(generateBookingCode());
    } catch (error) {
      if (!isBookingCodeConflictError(error)) throw error;
      lastConflict = error;
    }
  }

  throw lastConflict || new Error("Unable to allocate a unique booking code");
};

module.exports = generateBookingCode;
module.exports.generateBookingCode = generateBookingCode;
module.exports.isBookingCodeConflictError = isBookingCodeConflictError;
module.exports.withUniqueBookingCode = withUniqueBookingCode;
