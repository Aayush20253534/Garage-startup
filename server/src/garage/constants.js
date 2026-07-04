const GARAGE_MINIMUM_ACTIVATION_RECHARGE = 1;
const GARAGE_MAXIMUM_IMAGES = 15;
const GARAGE_MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const REQUIRED_BOOKING_INSPECTION_IMAGES = 5;

const calculatePlatformFee = (totalServiceAmount, requestType = "NORMAL") => {
  if (requestType === "SOS") return 1;

  const amount = Number(totalServiceAmount) || 0;

  if (amount >= 300 && amount < 1000) return 1;
  if (amount >= 1000 && amount < 5000) return 1;
  if (amount >= 5000 && amount < 20000) return 1;
  if (amount >= 20000) return 1;

  return 1;
};

module.exports = {
  GARAGE_MINIMUM_ACTIVATION_RECHARGE,
  GARAGE_MAXIMUM_IMAGES,
  GARAGE_MAX_IMAGE_SIZE_BYTES,
  REQUIRED_BOOKING_INSPECTION_IMAGES,
  calculatePlatformFee,
};
